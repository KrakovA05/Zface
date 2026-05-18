import {
  StyleSheet, Text, View, TouchableOpacity,
  ScrollView, ActivityIndicator, Dimensions,
} from 'react-native';
import Svg, { Polyline, Circle } from 'react-native-svg';
import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
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

// Секция 3: Психометрический профиль
const DIMENSION_ORDER = ['anxiety', 'stress', 'apathy', 'loneliness', 'burnout', 'self_esteem', 'social_anxiety', 'attachment'];

function ProfileSection({ metrics, prevMetrics, navigation }) {
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
        const prevScore = prevMetrics?.[key];
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

  const ordered = [...metricsHistory].reverse();
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

// ─── Главный экран ────────────────────────────────────────────────────────────

export default function AnalyticsScreen({ navigation }) {
  const [metrics, setMetrics] = useState(null);
  const [prevMetrics, setPrevMetrics] = useState(null);
  const [metricsHistory, setMetricsHistory] = useState([]);
  const [testHistory, setTestHistory] = useState([]);
  const [userActivity, setUserActivity] = useState({ streak: 0, testCount: 0, lastTest: null });
  const [loading, setLoading] = useState(true);

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
        { data: prevMetricsRow },
      ] = await Promise.all([
        computeLiveProfile(uid, { updateLevel: true }),
        supabase
          .from('user_metrics')
          .select('composite_score, week_start')
          .eq('user_id', uid)
          .order('week_start', { ascending: false })
          .limit(4),
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
          .from('user_metrics')
          .select('*')
          .eq('user_id', uid)
          .order('week_start', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (!active) return;
      setMetrics(liveMetrics);
      setPrevMetrics(prevMetricsRow);
      setMetricsHistory(mHistory || []);
      setTestHistory(tests || []);
      setUserActivity({
        streak: userRow?.login_streak || 0,
        testCount: tests?.length || 0,
        lastTest: tests?.[0]?.created_at || null,
      });
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
        <View style={styles.backBtn} />
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
          <CompositeSection metrics={metrics} />
          <LevelHistorySection testHistory={testHistory} />
          <ProfileSection metrics={metrics} prevMetrics={prevMetrics} navigation={navigation} />
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
});
