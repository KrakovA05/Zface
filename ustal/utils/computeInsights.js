const DIMENSION_LABELS = {
  anxiety:        'Тревога',
  stress:         'Стресс',
  apathy:         'Апатия',
  loneliness:     'Одиночество',
  burnout:        'Выгорание',
  self_esteem:    'Нехватка уверенности',
  social_anxiety: 'Соц. тревога',
  attachment:     'Тревога привязанности',
};

const DIMENSIONS = [
  'anxiety', 'stress', 'apathy', 'loneliness',
  'burnout', 'self_esteem', 'social_anxiety', 'attachment',
];

function avg(arr) {
  const valid = arr.filter(v => v !== null && v !== undefined);
  if (!valid.length) return null;
  return valid.reduce((s, v) => s + v, 0) / valid.length;
}

function median(arr) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function weekKey(dateStr) {
  const d = new Date(dateStr);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

/**
 * Вычисляет до 3 инсайтов на основе данных пользователя.
 *
 * @param {Object} params
 * @param {Array}  params.metricsHistory  — [{week_start, composite_score, anxiety_score, ...}] ASC
 * @param {Array}  params.moodHistory28   — [{checkin_date, score}] за последние 28 дней
 * @param {Array}  params.messageCounts   — [{week, cnt}] за последние 8 недель
 * @returns {string[]} — 0–3 готовых строки инсайтов
 */
export function computeInsights({ metricsHistory, moodHistory28, messageCounts }) {
  const candidates = [];

  // Паттерн 1: тренд измерения за последний месяц
  if (metricsHistory.length >= 8) {
    const last4 = metricsHistory.slice(-4);
    const prev4 = metricsHistory.slice(-8, -4);
    let maxAbsDelta = 0;
    let bestInsight = null;

    for (const dim of DIMENSIONS) {
      const key = `${dim}_score`;
      const recentAvg = avg(last4.map(m => m[key]));
      const prevAvg   = avg(prev4.map(m => m[key]));
      if (recentAvg === null || prevAvg === null) continue;
      const delta    = Math.round(recentAvg - prevAvg);
      const absDelta = Math.abs(delta);
      if (absDelta < 8) continue;
      if (absDelta > maxAbsDelta) {
        maxAbsDelta = absDelta;
        const label = DIMENSION_LABELS[dim];
        bestInsight = delta < 0
          ? { text: `${label} снизилась на ${absDelta} пунктов за последний месяц — динамика положительная.`, delta: absDelta }
          : { text: `${label} выросла на ${absDelta} пунктов за последний месяц — стоит обратить внимание.`, delta: absDelta };
      }
    }
    if (bestInsight) candidates.push(bestInsight);
  }

  // Паттерн 2: активность в чатах и одиночество
  if (messageCounts.length >= 4 && metricsHistory.length >= 4) {
    const pairs = [];
    for (const mc of messageCounts) {
      const match = metricsHistory.find(m => weekKey(m.week_start) === mc.week);
      if (
        match &&
        match.loneliness_score !== null &&
        match.loneliness_score !== undefined
      ) {
        pairs.push({ count: mc.cnt, score: match.loneliness_score });
      }
    }
    if (pairs.length >= 4) {
      const med      = median(pairs.map(p => p.count));
      const highAct  = pairs.filter(p => p.count > med);
      const lowAct   = pairs.filter(p => p.count <= med);
      const highLone = avg(highAct.map(p => p.score));
      const lowLone  = avg(lowAct.map(p => p.score));
      if (highLone !== null && lowLone !== null) {
        const diff = Math.round(lowLone - highLone);
        if (diff >= 8) {
          candidates.push({
            text: `В недели когда ты больше общаешься, одиночество ниже — разница ${diff} пунктов.`,
            delta: diff,
          });
        }
      }
    }
  }

  // Паттерн 3: настроение в выходные vs будни
  if (moodHistory28.length >= 7) {
    const weekdayScores = moodHistory28
      .filter(m => { const d = new Date(m.checkin_date).getDay(); return d >= 1 && d <= 5; })
      .map(m => m.score);
    const weekendScores = moodHistory28
      .filter(m => { const d = new Date(m.checkin_date).getDay(); return d === 0 || d === 6; })
      .map(m => m.score);

    if (weekdayScores.length >= 5 && weekendScores.length >= 2) {
      const wdAvg = avg(weekdayScores);
      const weAvg = avg(weekendScores);
      const diff  = weAvg - wdAvg;
      if (diff >= 1.5) {
        candidates.push({
          text:  `В выходные настроение обычно выше — в среднем на ${diff.toFixed(1)} балла.`,
          delta: diff,
        });
      } else if (diff <= -1.5) {
        candidates.push({
          text:  `В выходные настроение ниже, чем в будни — в среднем на ${Math.abs(diff).toFixed(1)} балла.`,
          delta: Math.abs(diff),
        });
      }
    }
  }

  // Паттерн 4: общий прогресс с начала использования
  if (metricsHistory.length >= 4) {
    const first = metricsHistory[0].composite_score;
    const last  = metricsHistory[metricsHistory.length - 1].composite_score;
    if (first !== null && first !== undefined && last !== null && last !== undefined) {
      const delta = Math.round(last - first);
      if (delta <= -10) {
        candidates.push({
          text:  `С начала использования общий индекс снизился на ${Math.abs(delta)} — это положительная динамика.`,
          delta: Math.abs(delta),
        });
      } else if (delta >= 10) {
        candidates.push({
          text:  `Общий индекс вырос на ${delta} с начала использования.`,
          delta,
        });
      }
    }
  }

  return candidates
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 3)
    .map(c => c.text);
}
