import {
  StyleSheet, Text, View, TouchableOpacity,
  ScrollView, ActivityIndicator, Dimensions, Alert,
} from 'react-native';
import Svg, { Polyline, Circle } from 'react-native-svg';
import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '../supabase';
import { store } from '../store';
import { colors } from '../theme';
import { computeLiveProfile } from '../utils/computeLiveProfile';

// ─── Константы ───────────────────────────────────────────────────────────────

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

const WEEKLY_PHRASES = {
  anxiety:        'Эта неделя была напряжённой. Ты справляешься.',
  stress:         'Много всего навалилось. Дай себе передохнуть.',
  loneliness:     'Последнее время ты больше наблюдаешь. Это нормально.',
  burnout:        'Похоже, ты устал. Не от лени — просто устал.',
  apathy:         'Сейчас всё кажется серым. Это пройдёт.',
  social_anxiety: 'Общение даётся непросто. Ты не один такой.',
  self_esteem:    'Ты справился с кое-чем на этой неделе. Замечаешь?',
  attachment:     'Близость пугает. Это честно — и с этим можно работать.',
};

const LEVEL_COLORS = { green: '#5DAA72', yellow: '#AA7C00', red: '#c0392b' };

function getMoodColor(score) {
  if (score >= 8) return '#5DAA72';
  if (score >= 5) return '#AA7C00';
  return '#c0392b';
}

// ─── Хелперы ─────────────────────────────────────────────────────────────────

function scoreColor(score) {
  if (score <= 33) return LEVEL_COLORS.green;
  if (score <= 66) return LEVEL_COLORS.yellow;
  return LEVEL_COLORS.red;
}

// Все 8 измерений: выше = хуже
function dimBarColor(score) {
  return scoreColor(score);
}

function formatDayMonth(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const months = ['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  const months = ['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

// ─── Компоненты секций ───────────────────────────────────────────────────────

function SectionCard({ title, children }) {
  return (
    <View style={styles.card}>
      {title ? <Text style={styles.cardTitle}>{title}</Text> : null}
      {children}
    </View>
  );
}

// Секция 0: Присутствие
function PresenceSection({ presence }) {
  const { daysHere, helpedCount, answersGiven, invitedCount } = presence;
  const items = [
    { num: daysHere, label: `${daysHere === 1 ? 'день' : daysHere < 5 ? 'дня' : 'дней'}\nздесь` },
    { num: helpedCount, label: 'людей\nподдержал' },
    { num: answersGiven, label: `${answersGiven === 1 ? 'ответ' : answersGiven < 5 ? 'ответа' : 'ответов'}\nна вопрос дня` },
    { num: invitedCount, label: 'пригласил\nдрузей' },
  ];
  return (
    <SectionCard>
      <View style={styles.presenceRow}>
        {items.map((item, i) => (
          <View key={i} style={styles.presenceItem}>
            {i > 0 && <View style={styles.presenceDivider} />}
            <View style={styles.presenceStat}>
              <Text style={styles.presenceNum}>{item.num}</Text>
              <Text style={styles.presenceLabel}>{item.label}</Text>
            </View>
          </View>
        ))}
      </View>
    </SectionCard>
  );
}

// Секция 1: Индекс состояния
function CompositeSection({ metrics }) {
  if (!metrics) {
    return (
      <SectionCard title="Индекс состояния">
        <Text style={styles.emptyText}>
          Данные появятся после первого еженедельного теста
        </Text>
      </SectionCard>
    );
  }

  const score = metrics.composite_score ?? 0;
  const color = scoreColor(score);
  const phrase = metrics.dominant_dimension
    ? WEEKLY_PHRASES[metrics.dominant_dimension]
    : null;

  return (
    <SectionCard>
      <View style={styles.compositeRow}>
        <View style={[styles.scoreCircle, { borderColor: color }]}>
          <Text style={[styles.scoreNum, { color }]}>{score}</Text>
          <Text style={styles.scoreOf}>/100</Text>
        </View>
        <View style={styles.compositeRight}>
          <Text style={styles.compositeLabel}>Индекс состояния</Text>
          {phrase ? (
            <Text style={styles.compositePhrase}>{phrase}</Text>
          ) : null}
          <Text style={[styles.compositeHint, { color }]}>
            {score <= 33 ? 'Всё под контролем' : score <= 66 ? 'Умеренная нагрузка' : 'Нужно внимание'}
          </Text>
        </View>
      </View>
      {metrics.week_start ? (
        <Text style={styles.weekLabel}>Неделя от {formatDayMonth(metrics.week_start)}</Text>
      ) : null}
    </SectionCard>
  );
}

// Секция 2: История уровней (14 дней)
function LevelHistorySection({ testHistory }) {
  if (!testHistory || testHistory.length === 0) {
    return (
      <SectionCard title="История уровней">
        <Text style={styles.emptyText}>
          Проходи тест каждый день, чтобы видеть динамику
        </Text>
      </SectionCard>
    );
  }

  // Строим массив последних 14 дней
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    const dayNum = d.getDate();
    const match = testHistory.find(t => t.created_at && t.created_at.split('T')[0] === key);
    days.push({ key, dayNum, level: match?.level || null });
  }

  return (
    <SectionCard title="История уровней">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.levelHistoryScroll}>
        <View style={styles.levelHistoryRow}>
          {days.map(d => (
            <View key={d.key} style={styles.levelHistoryItem}>
              <View style={[
                styles.levelDot,
                { backgroundColor: d.level ? LEVEL_COLORS[d.level] : '#E8DFD0' },
              ]} />
              <Text style={styles.levelDotLabel}>{d.dayNum}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
      <View style={styles.levelLegend}>
        {Object.entries(LEVEL_COLORS).map(([key, col]) => (
          <View key={key} style={styles.levelLegendItem}>
            <View style={[styles.levelLegendDot, { backgroundColor: col }]} />
            <Text style={styles.levelLegendText}>
              {key === 'green' ? 'норм' : key === 'yellow' ? 'тяжело' : 'плохо'}
            </Text>
          </View>
        ))}
        <View style={styles.levelLegendItem}>
          <View style={[styles.levelLegendDot, { backgroundColor: '#E8DFD0' }]} />
          <Text style={styles.levelLegendText}>нет теста</Text>
        </View>
      </View>
    </SectionCard>
  );
}

// Секция 2б: Настроение за 7 дней
function MoodSection({ moodHistory }) {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-');
    const entry = moodHistory.find(h => h.checkin_date === dateStr);
    days.push({ score: entry?.score ?? null, dayNum: d.getDate() });
  }

  const hasSomeData = days.some(d => d.score !== null);

  return (
    <SectionCard title="Настроение за 7 дней">
      {!hasSomeData ? (
        <Text style={styles.emptyText}>Отмечай настроение каждый день, чтобы видеть динамику</Text>
      ) : (
        <View style={styles.moodRow}>
          {days.map((d, i) => (
            <View key={i} style={styles.moodItem}>
              <View style={[
                styles.moodBar,
                {
                  backgroundColor: d.score !== null ? getMoodColor(d.score) : colors.border,
                  height: d.score !== null ? Math.max(4, (d.score / 10) * 40) : 4,
                  opacity: d.score !== null ? 1 : 0.3,
                }
              ]} />
              {d.score !== null && (
                <Text style={[styles.moodScore, { color: getMoodColor(d.score) }]}>{d.score}</Text>
              )}
              <Text style={styles.moodDay}>{d.dayNum}</Text>
            </View>
          ))}
        </View>
      )}
    </SectionCard>
  );
}

// Секция 3: Психометрический профиль
const DIMENSION_ORDER = ['anxiety', 'stress', 'apathy', 'loneliness', 'burnout', 'self_esteem', 'social_anxiety', 'attachment'];

function ProfileSection({ metrics, prevDimScores, navigation }) {
  if (!metrics) {
    return (
      <SectionCard title="Психометрический профиль">
        <Text style={styles.emptyText}>
          Данные появятся после прохождения психологических тестов
        </Text>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Психометрический профиль">
      {DIMENSION_ORDER.map(dim => {
        const key = `${dim}_score`;
        const score = metrics[key];
        if (score === undefined || score === null) return null;
        const prevScore = prevDimScores?.[dim];
        const delta = prevScore !== undefined ? score - prevScore : 0;
        const barColor = dimBarColor(score);

        return (
          <TouchableOpacity
            key={dim}
            style={styles.dimRow}
            onPress={() => navigation.navigate('DimensionHistory', { dimension: dim, label: DIMENSION_LABELS[dim] })}
            activeOpacity={0.7}
          >
            <Text style={styles.dimLabel}>{DIMENSION_LABELS[dim]}</Text>
            <View style={styles.dimBarWrap}>
              <View style={[styles.dimBarFill, { width: `${score}%`, backgroundColor: barColor }]} />
              {delta !== 0 && (
                <View style={[
                  styles.dimDeltaSegment,
                  {
                    left: `${Math.min(score, prevScore)}%`,
                    width: `${Math.abs(delta)}%`,
                    backgroundColor: delta > 0 ? '#c0392b' : '#5DAA72',
                  }
                ]} />
              )}
            </View>
            <View style={styles.dimScoreWrap}>
              <Text style={[styles.dimScore, { color: barColor }]}>{score}</Text>
              {delta !== 0 && (
                <Text style={[styles.dimDelta, { color: delta > 0 ? '#c0392b' : '#5DAA72' }]}>
                  {delta > 0 ? `▲${delta}` : `▼${Math.abs(delta)}`}
                </Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={14} color="#C8BFB0" style={{ marginLeft: 2 }} />
          </TouchableOpacity>
        );
      })}
    </SectionCard>
  );
}

// Секция 4: Тренд
const SPARKLINE_W = Dimensions.get('window').width - 32 - 32; // card padding
const SPARKLINE_H = 48;

function TrendSection({ metricsHistory }) {
  // Меньше 2 точек — тренда нет, показываем заглушку
  if (!metricsHistory || metricsHistory.length < 2) {
    return (
      <SectionCard title="Тренд">
        <View style={styles.trendEmptyRow}>
          <Ionicons name="time-outline" size={16} color="#C8BFB0" />
          <Text style={styles.trendEmptyText}>
            Появится после второй недели использования
          </Text>
        </View>
      </SectionCard>
    );
  }

  const ordered = [...metricsHistory];
  const first = ordered[0].composite_score ?? 0;
  const last = ordered[ordered.length - 1].composite_score ?? 0;
  const delta = last - first;
  const improved = delta < 0;
  const deltaColor = improved ? '#5DAA72' : '#c0392b';
  const deltaText = improved
    ? `снизился на ${Math.abs(delta)} за ${ordered.length} нед.`
    : `вырос на ${Math.abs(delta)} за ${ordered.length} нед.`;

  // Спарклайн
  const pad = 6;
  const innerW = SPARKLINE_W - pad * 2;
  const innerH = SPARKLINE_H - pad * 2;
  const xStep = ordered.length > 1 ? innerW / (ordered.length - 1) : 0;
  const points = ordered.map((m, i) => {
    const s = m.composite_score ?? 0;
    return {
      x: pad + i * xStep,
      y: pad + innerH - (s / 100) * innerH,
      score: s,
    };
  });
  const polylineStr = points.map(p => `${p.x},${p.y}`).join(' ');

  return (
    <SectionCard title="Тренд">
      {/* Итоговая строка */}
      <View style={styles.trendSummaryRow}>
        <View style={styles.trendSummaryLeft}>
          <Text style={[styles.trendSummaryScore, { color: scoreColor(last) }]}>{last}</Text>
          <Text style={styles.trendSummaryLabel}>сейчас</Text>
        </View>
        <View style={styles.trendSummaryMid}>
          <Ionicons
            name={improved ? 'trending-down' : 'trending-up'}
            size={18}
            color={deltaColor}
          />
          <Text style={[styles.trendDeltaText, { color: deltaColor }]}>{deltaText}</Text>
        </View>
      </View>

      {/* Спарклайн */}
      <Svg width={SPARKLINE_W} height={SPARKLINE_H} style={styles.sparkline}>
        <Polyline
          points={polylineStr}
          fill="none"
          stroke={colors.accent}
          strokeWidth="2"
          strokeLinejoin="round"
        />
        {points.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={3}
            fill={scoreColor(p.score)} stroke={colors.background} strokeWidth="1.5" />
        ))}
      </Svg>

      {/* Даты под спарклайном */}
      <View style={styles.trendDatesRow}>
        <Text style={styles.trendDateLabel}>{formatDayMonth(ordered[0].week_start)}</Text>
        <Text style={styles.trendDateLabel}>{formatDayMonth(ordered[ordered.length - 1].week_start)}</Text>
      </View>
      <Text style={styles.trendHint}>Ниже — лучше. Индекс показывает общую нагрузку.</Text>
    </SectionCard>
  );
}

// Секция 5: Активность
function ActivitySection({ userActivity }) {
  const { streak, testCount, lastTest } = userActivity;
  const items = [
    { icon: 'flame-outline', label: 'Стрик входа', value: `${streak} ${streak === 1 ? 'день' : streak < 5 ? 'дня' : 'дней'}` },
    { icon: 'clipboard-outline', label: 'Тестов пройдено', value: String(testCount) },
    { icon: 'calendar-outline', label: 'Последний тест', value: lastTest ? formatDate(lastTest) : '—' },
  ];

  return (
    <SectionCard title="Активность">
      {items.map((item, i) => (
        <View key={i} style={[styles.activityRow, i < items.length - 1 && styles.activityRowBorder]}>
          <View style={styles.activityIconWrap}>
            <Ionicons name={item.icon} size={18} color={colors.accent} />
          </View>
          <Text style={styles.activityLabel}>{item.label}</Text>
          <Text style={styles.activityValue}>{item.value}</Text>
        </View>
      ))}
    </SectionCard>
  );
}

// ─── PDF-генерация ────────────────────────────────────────────────────────────

const DIMENSION_ORDER_PDF = ['anxiety', 'stress', 'apathy', 'loneliness', 'burnout', 'self_esteem', 'social_anxiety', 'attachment'];

function pdfColor(score) {
  return score <= 33 ? '#166534' : score <= 66 ? '#B45309' : '#B91C1C';
}

function makeSvgLine(points, w, h) {
  if (!points || points.length < 2) return '';
  const minT = points[0].t, maxT = points[points.length - 1].t;
  const rangeT = maxT - minT || 1;
  const pts = points.map(p => {
    const x = ((p.t - minT) / rangeT) * (w - 8) + 4;
    const y = h - 4 - ((p.v / 100) * (h - 8));
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const circles = points.map(p => {
    const x = ((p.t - minT) / rangeT) * (w - 8) + 4;
    const y = h - 4 - ((p.v / 100) * (h - 8));
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="${pdfColor(p.v)}"/>`;
  }).join('');
  const lastP = points[points.length - 1];
  const lx = ((lastP.t - minT) / rangeT) * (w - 8) + 4;
  const ly = h - 4 - ((lastP.v / 100) * (h - 8));
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" style="display:block">
    <polyline points="${pts}" fill="none" stroke="#BC8A72" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    ${circles}
    <text x="${lx > w - 28 ? lx - 28 : lx + 6}" y="${ly < 12 ? ly + 14 : ly - 4}" font-size="10" fill="${pdfColor(lastP.v)}" font-weight="700">${lastP.v}</text>
  </svg>`;
}

function buildPdfHtml({ metrics, prevDimScores, testHistory, moodHistory, metricsHistory, userActivity, presence }) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

  // Строим историю по каждому измерению из user_metrics (понедельные снапшоты, уже ASC)
  const dimHistory = {};
  for (const row of (metricsHistory || [])) {
    const t = new Date(row.week_start).getTime();
    for (const dim of DIMENSION_ORDER_PDF) {
      const v = row[`${dim}_score`];
      if (v === undefined || v === null) continue;
      if (!dimHistory[dim]) dimHistory[dim] = [];
      dimHistory[dim].push({ t, v });
    }
  }

  const dimBlocks = DIMENSION_ORDER_PDF.map(dim => {
    const score = metrics?.[`${dim}_score`];
    if (score === undefined || score === null) return '';
    const prev = prevDimScores?.[dim];
    const delta = prev !== undefined ? score - prev : null;
    const color = pdfColor(score);
    const deltaHtml = delta !== null && delta !== 0
      ? `<span style="color:${delta > 0 ? '#DC2626' : '#16A34A'};font-size:12px;margin-left:6px;font-weight:700">${delta > 0 ? '▲' : '▼'}${Math.abs(delta)}</span>`
      : '';
    const history = dimHistory[dim] || [];
    const sparkline = history.length >= 2 ? makeSvgLine(history, 220, 44) : '';
    return `
      <div style="padding:10px 0;border-bottom:1px solid #F0ECE6">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <span style="font-size:14px;color:#1a1a1a;font-weight:500">${DIMENSION_LABELS[dim]}</span>
          <span style="font-size:16px;font-weight:800;color:${color}">${score}${deltaHtml}</span>
        </div>
        <div style="background:#EDE8E0;border-radius:5px;height:8px;overflow:hidden;margin-bottom:${sparkline ? '8px' : '0'}">
          <div style="background:${color};width:${score}%;height:100%;border-radius:5px"></div>
        </div>
        ${sparkline ? `<div style="margin-top:2px">${sparkline}</div>` : ''}
      </div>`;
  }).join('');

  const moodChips = moodHistory.map(m => {
    const c = m.score >= 8 ? '#16A34A' : m.score >= 5 ? '#D97706' : '#DC2626';
    return `<span style="display:inline-block;margin:3px 4px 3px 0;background:${c};color:#fff;border-radius:20px;padding:4px 12px;font-size:13px;font-weight:600">${m.checkin_date?.slice(5)} · ${m.score}/10</span>`;
  }).join('');

  const testRows = testHistory.slice(0, 10).map((t, i) => {
    const lvl = t.level === 'green' ? 'Зелёный' : t.level === 'yellow' ? 'Жёлтый' : 'Красный';
    const c = t.level === 'green' ? '#16A34A' : t.level === 'yellow' ? '#D97706' : '#DC2626';
    const bg = i % 2 === 0 ? '#FAFAFA' : '#fff';
    return `<tr style="background:${bg}">
      <td style="padding:7px 8px;font-size:13px;color:#555">${new Date(t.created_at).toLocaleDateString('ru-RU')}</td>
      <td style="padding:7px 8px;font-weight:700;color:${c}">${lvl}</td>
      <td style="padding:7px 8px;text-align:right;color:#1a1a1a;font-size:13px;font-weight:600">${t.score ?? '—'}</td>
    </tr>`;
  }).join('');

  const trendRows = [...metricsHistory].map((m, i) => {
    const c = pdfColor(m.composite_score);
    const bg = i % 2 === 0 ? '#FAFAFA' : '#fff';
    return `<tr style="background:${bg}">
      <td style="padding:7px 8px;font-size:13px;color:#555">${new Date(m.week_start).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</td>
      <td style="padding:7px 16px;width:180px">
        <div style="background:#EDE8E0;border-radius:5px;height:8px;overflow:hidden">
          <div style="background:${c};width:${m.composite_score}%;height:100%;border-radius:5px"></div>
        </div>
      </td>
      <td style="padding:7px 8px;text-align:right;font-weight:800;color:${c};font-size:14px">${m.composite_score}</td>
    </tr>`;
  }).join('');

  const compositeColor = metrics?.composite_score !== undefined ? pdfColor(metrics.composite_score) : '#1a1a1a';

  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, Helvetica Neue, Arial, sans-serif; background: #F5F0EB; color: #1a1a1a; padding: 28px; }
  h1 { font-size: 24px; font-weight: 900; color: #1a1a1a; margin-bottom: 3px; }
  .subtitle { font-size: 13px; color: #888; margin-bottom: 24px; }
  .card { background: #fff; border-radius: 16px; padding: 18px 20px; margin-bottom: 14px; box-shadow: 0 1px 4px rgba(0,0,0,0.07); }
  .card-title { font-size: 11px; font-weight: 800; color: #555; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 14px; }
  .stat-row { display: flex; }
  .stat-cell { flex: 1; text-align: center; }
  .stat-num { font-size: 30px; font-weight: 900; color: #1a1a1a; line-height: 1; }
  .stat-label { font-size: 11px; color: #888; margin-top: 4px; line-height: 1.4; }
  .vdiv { width: 1px; background: #ECEAE6; flex-shrink: 0; margin: 0 4px; }
  .composite-num { font-size: 56px; font-weight: 900; text-align: center; line-height: 1; padding: 8px 0 4px; }
  .composite-sub { text-align: center; font-size: 13px; color: #888; }
  table { width: 100%; border-collapse: collapse; border-radius: 8px; overflow: hidden; }
  .note { font-size: 11px; color: #AAA; margin-top: 12px; text-align: center; }
  .dim-block:last-child { border-bottom: none !important; }
  .footer { font-size: 11px; color: #BBB; text-align: center; margin-top: 20px; padding-top: 16px; border-top: 1px solid #E8E0D8; }
</style>
</head>
<body>
  <h1>Психоаналитика — ${store.username}</h1>
  <div class="subtitle">Сформировано ${dateStr}</div>

  <div class="card">
    <div class="card-title">Присутствие в приложении</div>
    <div class="stat-row">
      <div class="stat-cell"><div class="stat-num">${presence.daysHere}</div><div class="stat-label">дней<br>здесь</div></div>
      <div class="vdiv"></div>
      <div class="stat-cell"><div class="stat-num">${presence.helpedCount}</div><div class="stat-label">людей<br>поддержал</div></div>
      <div class="vdiv"></div>
      <div class="stat-cell"><div class="stat-num">${presence.answersGiven}</div><div class="stat-label">ответов на<br>вопрос дня</div></div>
      <div class="vdiv"></div>
      <div class="stat-cell"><div class="stat-num">${presence.invitedCount}</div><div class="stat-label">пригласил<br>друзей</div></div>
    </div>
  </div>

  ${metrics?.composite_score !== undefined ? `
  <div class="card">
    <div class="card-title">Индекс состояния</div>
    <div class="composite-num" style="color:${compositeColor}">${metrics.composite_score}</div>
    <div class="composite-sub">из 100 · выше = хуже</div>
  </div>` : ''}

  ${dimBlocks ? `
  <div class="card">
    <div class="card-title">Психометрический профиль</div>
    ${dimBlocks}
    <div class="note">0–33 = норма &nbsp;·&nbsp; 34–66 = умеренно &nbsp;·&nbsp; 67–100 = выражено</div>
  </div>` : ''}

  ${trendRows ? `
  <div class="card">
    <div class="card-title">Тренд состояния по неделям</div>
    <table>${trendRows}</table>
  </div>` : ''}

  ${moodChips ? `
  <div class="card">
    <div class="card-title">Чекин настроения — последние 7 дней</div>
    <div>${moodChips}</div>
  </div>` : ''}

  ${testRows ? `
  <div class="card">
    <div class="card-title">История тестов уровня</div>
    <table style="border-radius:8px;overflow:hidden">${testRows}</table>
  </div>` : ''}

  <div class="card">
    <div class="card-title">Активность</div>
    <table>
      <tr><td style="padding:7px 0;font-size:14px;color:#333">Стрик входа</td><td style="text-align:right;font-weight:800;font-size:14px;color:#1a1a1a">${userActivity.streak} дн.</td></tr>
      <tr><td style="padding:7px 0;font-size:14px;color:#333;border-top:1px solid #F0ECE6">Тестов пройдено</td><td style="text-align:right;font-weight:800;font-size:14px;color:#1a1a1a;border-top:1px solid #F0ECE6">${userActivity.testCount}</td></tr>
      ${userActivity.lastTest ? `<tr><td style="padding:7px 0;font-size:14px;color:#333;border-top:1px solid #F0ECE6">Последний тест</td><td style="text-align:right;font-weight:800;font-size:14px;color:#1a1a1a;border-top:1px solid #F0ECE6">${new Date(userActivity.lastTest).toLocaleDateString('ru-RU')}</td></tr>` : ''}
    </table>
  </div>

  <div class="footer">Данные из приложения «не один» · Только для личного использования</div>
</body>
</html>`;
}

// ─── Главный экран ────────────────────────────────────────────────────────────

export default function AnalyticsScreen({ navigation }) {
  const [metrics, setMetrics] = useState(null);
  const [prevDimScores, setPrevDimScores] = useState({});
  const [metricsHistory, setMetricsHistory] = useState([]);
  const [testHistory, setTestHistory] = useState([]);
  const [moodHistory, setMoodHistory] = useState([]);
  const [userActivity, setUserActivity] = useState({ streak: 0, testCount: 0, lastTest: null });
  const [presence, setPresence] = useState({ daysHere: 0, helpedCount: 0, answersGiven: 0, invitedCount: 0 });
  const [allPsychRows, setAllPsychRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const exportPdf = async () => {
    setExporting(true);
    try {
      const html = buildPdfHtml({ metrics, prevDimScores, testHistory, moodHistory, metricsHistory, userActivity, presence });
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const filename = `аналитика_${store.username}.pdf`;
      const namedUri = FileSystem.cacheDirectory + filename;
      await FileSystem.copyAsync({ from: uri, to: namedUri });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(namedUri, { mimeType: 'application/pdf', dialogTitle: 'Психоаналитика', UTI: 'com.adobe.pdf' });
      } else {
        Alert.alert('Готово', `Файл сохранён: ${namedUri}`);
      }
    } catch {
      Alert.alert('Ошибка', 'Не удалось создать PDF');
    } finally {
      setExporting(false);
    }
  };

  useFocusEffect(useCallback(() => {
    let active = true;

    async function load() {
      setLoading(true);
      const uid = store.userId;
      if (!uid) { setLoading(false); return; }

      const [
        liveMetrics,
        { data: mHistory },
        { data: tests },
        { data: userRow },
        { data: psychRows },
        { data: prevMetricsRow },
        { data: moodRows },
        { count: helpCount },
        { count: ansCount },
        { data: firstTest },
        { count: invitedCount },
      ] = await Promise.all([
        computeLiveProfile(uid, { updateLevel: true }),
        supabase
          .from('user_metrics')
          .select('composite_score, anxiety_score, stress_score, apathy_score, loneliness_score, burnout_score, self_esteem_score, social_anxiety_score, attachment_score, week_start')
          .eq('user_id', uid)
          .order('week_start', { ascending: true })
          .limit(16),
        supabase
          .from('test_results')
          .select('level, score, created_at')
          .eq('user_id', uid)
          .order('created_at', { ascending: false })
          .limit(14),
        supabase
          .from('users')
          .select('login_streak')
          .eq('user_id', uid)
          .maybeSingle(),
        supabase
          .from('psych_test_results')
          .select('dimension, normalized_score, created_at')
          .eq('user_id', uid)
          .order('created_at', { ascending: false })
          .limit(32),
        supabase
          .from('user_metrics')
          .select('*')
          .eq('user_id', uid)
          .order('week_start', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('mood_checkins')
          .select('score, checkin_date')
          .eq('user_id', uid)
          .gte('checkin_date', (() => {
            const d = new Date(); d.setDate(d.getDate() - 6);
            return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-');
          })())
          .order('checkin_date', { ascending: true }),
        supabase.from('user_helps').select('*', { count: 'exact', head: true }).eq('helper_id', uid),
        supabase.from('daily_answers').select('*', { count: 'exact', head: true }).eq('user_id', uid),
        supabase.from('test_results').select('created_at').eq('user_id', uid)
          .order('created_at', { ascending: true }).limit(1).maybeSingle(),
        supabase.from('users').select('user_id', { count: 'exact', head: true }).eq('referred_by', uid),
      ]);

      // Измерения без реального поведенческого сигнала — только психотест
      const noRealBehavioral = new Set(['self_esteem', 'social_anxiety', 'attachment']);

      // Для каждого измерения строим prevScores:
      //   - если ≥2 психотеста → сравниваем с предыдущим психотестом
      //   - если 1 психотест и dim из noRealBehavioral → сравниваем с базовым значением (50)
      //   - иначе → сравниваем с предыдущим user_metrics снэпшотом
      const seenDims = new Set();
      const hasPsychTest = new Set();
      const prevPsychScores = {};
      for (const r of psychRows ?? []) {
        if (!seenDims.has(r.dimension)) {
          seenDims.add(r.dimension);
          hasPsychTest.add(r.dimension);
        } else if (prevPsychScores[r.dimension] === undefined) {
          prevPsychScores[r.dimension] = r.normalized_score;
        }
      }

      const prevScores = {};
      for (const dim of Object.keys({
        anxiety: 1, stress: 1, apathy: 1, loneliness: 1,
        burnout: 1, self_esteem: 1, social_anxiety: 1, attachment: 1,
      })) {
        const key = `${dim}_score`;
        if (prevPsychScores[dim] !== undefined) {
          // Есть второй психотест — точное сравнение
          prevScores[dim] = prevPsychScores[dim];
        } else if (noRealBehavioral.has(dim) && hasPsychTest.has(dim)) {
          // Первый психотест по этому измерению — сравниваем с базовым (50)
          prevScores[dim] = 50;
        } else if (prevMetricsRow?.[key] !== undefined) {
          // Поведенческое измерение — сравниваем с предыдущим снэпшотом
          prevScores[dim] = prevMetricsRow[key];
        }
      }

      if (!active) return;
      setMetrics(liveMetrics);
      setPrevDimScores(prevScores);
      setMetricsHistory(mHistory || []);
      setTestHistory(tests || []);
      setMoodHistory(moodRows || []);
      setUserActivity({
        streak: userRow?.login_streak || 0,
        testCount: tests?.length || 0,
        lastTest: tests?.[0]?.created_at || null,
      });
      const daysHere = firstTest
        ? Math.max(1, Math.floor((Date.now() - new Date(firstTest.created_at)) / 86400000) + 1)
        : 1;
      setPresence({ daysHere, helpedCount: helpCount || 0, answersGiven: ansCount || 0, invitedCount: invitedCount || 0 });
      setAllPsychRows(psychRows || []);
      setLoading(false);
    }

    load();
    return () => { active = false; };
  }, []));

  return (
    <View style={styles.safeArea}>
      {/* Шапка */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Моя аналитика</Text>
        <TouchableOpacity onPress={exportPdf} style={styles.backBtn} activeOpacity={0.7} disabled={exporting || loading}>
          {exporting
            ? <ActivityIndicator size="small" color={colors.accent} />
            : <Ionicons name="share-outline" size={22} color={loading ? colors.muted : colors.accent} />
          }
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <PresenceSection presence={presence} />
          <CompositeSection metrics={metrics} />
          <LevelHistorySection testHistory={testHistory} />
          <MoodSection moodHistory={moodHistory} />
          <ProfileSection metrics={metrics} prevDimScores={prevDimScores} navigation={navigation} />
          <TrendSection metricsHistory={metricsHistory} />
          <ActivitySection userActivity={userActivity} />
          <View style={styles.bottomPad} />
        </ScrollView>
      )}
    </View>
  );
}

// ─── Стили ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E8DFD0',
    backgroundColor: colors.background,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
    color: colors.white,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
    gap: 12,
  },
  bottomPad: { height: 80 },

  // Карточка
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8DFD0',
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#A09080',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 14,
  },
  emptyText: {
    fontSize: 14,
    color: '#A09080',
    lineHeight: 20,
    textAlign: 'center',
    paddingVertical: 8,
  },

  // Секция 1: Composite
  compositeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  scoreCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  scoreNum: {
    fontSize: 32,
    fontWeight: '800',
    lineHeight: 34,
  },
  scoreOf: {
    fontSize: 12,
    color: '#A09080',
    lineHeight: 14,
  },
  compositeRight: {
    flex: 1,
    gap: 4,
  },
  compositeLabel: {
    fontSize: 14,
    color: '#A09080',
    fontWeight: '600',
  },
  compositePhrase: {
    fontSize: 14,
    color: '#2C2420',
    lineHeight: 20,
  },
  compositeHint: {
    fontSize: 12,
    fontWeight: '600',
  },
  weekLabel: {
    fontSize: 11,
    color: '#A09080',
    marginTop: 10,
    textAlign: 'right',
  },

  // Секция 2: История уровней
  levelHistoryScroll: {
    marginBottom: 12,
  },
  levelHistoryRow: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  levelHistoryItem: {
    alignItems: 'center',
    gap: 4,
  },
  levelDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  levelDotLabel: {
    fontSize: 10,
    color: '#A09080',
  },
  levelLegend: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  levelLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  levelLegendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  levelLegendText: {
    fontSize: 11,
    color: '#A09080',
  },

  // Секция 3: Профиль
  dimRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  dimLabel: {
    width: 96,
    fontSize: 13,
    color: '#2C2420',
    flexShrink: 0,
  },
  dimBarWrap: {
    flex: 1,
    height: 6,
    backgroundColor: '#E8DFD0',
    borderRadius: 3,
    position: 'relative',
  },
  dimBarFill: {
    height: 6,
    borderRadius: 3,
  },
  dimDeltaSegment: {
    position: 'absolute',
    height: 6,
    borderRadius: 2,
    opacity: 0.6,
  },
  dimScoreWrap: {
    width: 44,
    alignItems: 'flex-end',
  },
  dimScore: {
    fontSize: 12,
    fontWeight: '700',
  },
  dimDelta: {
    fontSize: 9,
    fontWeight: '600',
  },

  // Секция 4: Тренд
  trendEmptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  trendEmptyText: {
    fontSize: 13,
    color: '#A09080',
    flex: 1,
  },
  trendSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  trendSummaryLeft: {
    alignItems: 'center',
    minWidth: 40,
  },
  trendSummaryScore: {
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 28,
  },
  trendSummaryLabel: {
    fontSize: 10,
    color: '#A09080',
  },
  trendSummaryMid: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trendDeltaText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  sparkline: {
    marginBottom: 4,
  },
  trendDatesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  trendDateLabel: {
    fontSize: 10,
    color: '#A09080',
  },
  trendHint: {
    fontSize: 11,
    color: '#A09080',
    textAlign: 'center',
  },

  // Секция 5: Активность
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  activityRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E8DFD0',
  },
  activityIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: '#8B735522',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityLabel: {
    flex: 1,
    fontSize: 14,
    color: '#2C2420',
  },
  activityValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8B7355',
  },

  // Секция настроения
  moodRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 4 },
  moodItem: { alignItems: 'center', gap: 3, flex: 1 },
  moodBar:  { width: 8, borderRadius: 4 },
  moodScore: { fontSize: 11, fontWeight: '700' },
  moodDay:  { fontSize: 11, color: '#A09080' },
  presenceRow: { flexDirection: 'row', alignItems: 'center' },
  presenceItem: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  presenceStat: { flex: 1, alignItems: 'center', gap: 4 },
  presenceNum: { fontSize: 26, fontWeight: '700', color: colors.white },
  presenceLabel: { fontSize: 11, color: colors.muted, textAlign: 'center', lineHeight: 15 },
  presenceDivider: { width: 1, height: 36, backgroundColor: '#E8DFD0' },
});
