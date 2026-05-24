import { supabase } from '../supabase';
import { store } from '../store';

const PACK_DIMENSION_MAP = {
  0: ['apathy', 'stress'],
  1: ['burnout', 'apathy'],
  2: ['loneliness', 'social_anxiety'],
  3: ['self_esteem'],
  4: ['apathy'],
  5: ['anxiety', 'stress'],
  6: ['apathy'],
  7: ['anxiety'],
  8: ['apathy', 'burnout'],
  9: ['burnout', 'stress'],
};

const DIMENSION_WEIGHTS = {
  anxiety: 0.20, stress: 0.20, apathy: 0.15, loneliness: 0.15,
  burnout: 0.10, self_esteem: 0.10, social_anxiety: 0.05, attachment: 0.05,
};


function norm(value, min, max) {
  if (max === min) return 0;
  return Math.round(Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100)));
}

export function scoreToLevel(score) {
  if (score <= 33) return 'green';
  if (score <= 66) return 'yellow';
  return 'red';
}

function getTodayStr() {
  return new Date().toISOString().split('T')[0];
}

// updateLevel: true — после вычисления записать users.level + store.level
// saveMetrics: true — upsert в user_metrics (текущая неделя)
export async function computeLiveProfile(uid, { updateLevel = false, saveMetrics = false } = {}) {
  const now = Date.now();
  const sevenDaysAgo = new Date(now - 7 * 86400000).toISOString();
  const sevenDaysAgoStr = sevenDaysAgo.split('T')[0];
  const thirtyDaysAgo = new Date(now - 30 * 86400000).toISOString();

  const [
    { data: psychResults },
    { data: dmData },
    { data: messages },
    { data: checkinData },
    { data: dailyTests },
  ] = await Promise.all([
    // Валидированные психотесты за 30 дней
    supabase.from('psych_test_results')
      .select('dimension, normalized_score')
      .eq('user_id', uid).gte('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: false }).limit(100),
    // Уникальные DM-собеседники за 7 дней
    supabase.from('direct_messages')
      .select('conversation_id')
      .eq('sender_id', uid).gte('created_at', sevenDaysAgo).limit(500),
    // Все сообщения за 7 дней (для msgCount и ночной активности)
    supabase.from('messages')
      .select('created_at')
      .eq('sender_id', uid).gte('created_at', sevenDaysAgo).limit(500),
    // Чекины настроения за 7 дней
    supabase.from('mood_checkins')
      .select('score')
      .eq('user_id', uid).gte('checkin_date', sevenDaysAgoStr)
      .order('checkin_date', { ascending: true }).limit(30),
    // Ежедневные тесты за 7 дней
    supabase.from('test_results')
      .select('score, pack_id')
      .eq('user_id', uid).gte('created_at', sevenDaysAgo)
      .order('created_at', { ascending: false }).limit(20),
  ]);

  // ── Валидированные психотесты: последний результат по каждому измерению ──────
  const psychScores = {};
  for (const r of psychResults ?? []) {
    if (psychScores[r.dimension] === undefined && r.normalized_score !== null && r.normalized_score !== undefined) {
      psychScores[r.dimension] = r.normalized_score;
    }
  }

  // ── Сырые поведенческие данные ───────────────────────────────────────────────
  const msgCount = messages?.length ?? 0;
  const nightCount = (messages ?? []).filter(m => {
    const h = new Date(m.created_at).getHours();
    return h >= 0 && h < 5;
  }).length;
  const uniqueConvs = new Set((dmData ?? []).map(d => d.conversation_id)).size;
  const checkinScores = (checkinData ?? []).map(c => c.score);
  const avgCheckin = checkinScores.length > 0
    ? checkinScores.reduce((a, b) => a + b, 0) / checkinScores.length
    : null;
  // Тренд: последний чекин минус первый (скользящие 7 дней)
  const checkinTrend = checkinScores.length >= 2
    ? checkinScores[checkinScores.length - 1] - checkinScores[0]
    : null;

  // Признак «есть хоть какая-то активность за 7 дней»
  // Если нет — поведенческие сигналы дефолтятся в 50, а не в 100 (новый пользователь)
  const hasActivity = msgCount > 0 || checkinScores.length > 0 || uniqueConvs > 0 || (dailyTests?.length ?? 0) > 0;

  // ── Ежедневный тест → баллы по измерениям ────────────────────────────────────
  const dailyDimAccum = {};
  for (const t of dailyTests ?? []) {
    const packScore = Math.round((t.score / 10) * 100);
    for (const dim of PACK_DIMENSION_MAP[t.pack_id] ?? []) {
      if (!dailyDimAccum[dim]) dailyDimAccum[dim] = [];
      dailyDimAccum[dim].push(packScore);
    }
  }
  const dailyScores = {};
  for (const [dim, scores] of Object.entries(dailyDimAccum)) {
    dailyScores[dim] = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  }

  // ── Поведенческие сигналы ─────────────────────────────────────────────────────
  //
  // anxiety:  доля ночных сообщений (0-5 утра) как прокси инсомнии/тревоги
  // stress:   средний балл чекинов (низкий = плохое настроение = стресс)
  // loneliness: мало уникальных DM-собеседников
  // apathy:   мало сообщений в чатах
  // burnout:  тренд чекинов вниз = истощение; fallback через средний балл
  // self_esteem, social_anxiety, attachment: только через валидированные тесты
  //   (прокси через поведение ненадёжны или вводят дубли)
  const behavioral = {
    anxiety:        hasActivity ? norm(nightCount, 0, 10) : 50,
    stress:         avgCheckin !== null
                      ? Math.round(((10 - avgCheckin) / 9) * 100)
                      : 50,
    loneliness:     hasActivity ? norm(Math.max(0, 5 - uniqueConvs), 0, 5) : 50,
    apathy:         hasActivity ? norm(Math.max(0, 7 - Math.min(7, msgCount)), 0, 7) : 50,
    burnout:        checkinTrend !== null
                      // Непрерывная формула: тренд 0 → 45, -3 → 69, +3 → 21
                      ? Math.max(5, Math.min(90, 45 - Math.round(checkinTrend * 8)))
                      : avgCheckin !== null
                        // Нет тренда, но есть чекины: средний балл как слабый сигнал
                        ? Math.round(((10 - avgCheckin) / 9) * 70)
                        : 30,
    self_esteem:    50,
    social_anxiety: 50,
    attachment:     50,
  };

  // ── Итоговые баллы: psych > daily > behavioral ───────────────────────────────
  //
  // Веса источников:
  //   psych (30 дн)  + daily (7 дн)  + behavioral  →  итог
  //   есть           есть             —             →  ps*0.6 + ds*0.25 + bs*0.15
  //   есть           нет              —             →  ps*0.6 + bs*0.4
  //   нет            есть             —             →  ds*0.15 + bs*0.85
  //   нет            нет              —             →  bs
  const dimensionScores = {};
  for (const dim of Object.keys(DIMENSION_WEIGHTS)) {
    const ps = psychScores[dim];
    const ds = dailyScores[dim];
    const bs = behavioral[dim];

    const noRealBehavioral = new Set(['self_esteem', 'social_anxiety', 'attachment']);

    if (ps !== undefined) {
      if (noRealBehavioral.has(dim)) {
        dimensionScores[dim] = ds !== undefined
          ? Math.round(ps * 0.75 + ds * 0.25)
          : ps;
      } else {
        dimensionScores[dim] = ds !== undefined
          ? Math.round(ps * 0.6 + ds * 0.25 + bs * 0.15)
          : Math.round(ps * 0.6 + bs * 0.4);
      }
    } else if (ds !== undefined) {
      dimensionScores[dim] = Math.round(ds * 0.15 + bs * 0.85);
    } else {
      dimensionScores[dim] = bs;
    }
  }

  // ── Composite ─────────────────────────────────────────────────────────────────
  let composite = 0;
  for (const [dim, weight] of Object.entries(DIMENSION_WEIGHTS)) {
    composite += (dimensionScores[dim] ?? 50) * weight;
  }
  composite = Math.round(composite);

  const dominant = Object.entries(dimensionScores)
    .sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'stress';

  const level = scoreToLevel(composite);

  // ── Запись уровня (опционально) ───────────────────────────────────────────────
  if (updateLevel) {
    await supabase.from('users').update({ level }).eq('user_id', uid);
    store.level = level;
  }

  // ── Сохранение снапшота в user_metrics ────────────────────────────────────────
  if (saveMetrics || updateLevel) {
    const weekStart = getTodayStr();
    await supabase.from('user_metrics').upsert({
      user_id:              uid,
      week_start:           weekStart,
      anxiety_score:        dimensionScores.anxiety,
      stress_score:         dimensionScores.stress,
      apathy_score:         dimensionScores.apathy,
      loneliness_score:     dimensionScores.loneliness,
      burnout_score:        dimensionScores.burnout,
      self_esteem_score:    dimensionScores.self_esteem,
      social_anxiety_score: dimensionScores.social_anxiety,
      attachment_score:     dimensionScores.attachment,
      composite_score:      composite,
      dominant_dimension:   dominant,
      level,
    }, { onConflict: 'user_id,week_start' });
  }

  return {
    anxiety_score:        dimensionScores.anxiety,
    stress_score:         dimensionScores.stress,
    apathy_score:         dimensionScores.apathy,
    loneliness_score:     dimensionScores.loneliness,
    burnout_score:        dimensionScores.burnout,
    self_esteem_score:    dimensionScores.self_esteem,
    social_anxiety_score: dimensionScores.social_anxiety,
    attachment_score:     dimensionScores.attachment,
    composite_score:      composite,
    dominant_dimension:   dominant,
    week_start:           getTodayStr(),
    level,
  };
}
