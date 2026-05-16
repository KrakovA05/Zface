import {
  StyleSheet, Text, View, TouchableOpacity,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';
import { store } from '../store';
import { colors } from '../theme';

// ─── Константы ───────────────────────────────────────────────────────────────

const DIMENSION_LABELS = {
  anxiety:        'Тревога',
  stress:         'Стресс',
  apathy:         'Апатия',
  loneliness:     'Одиночество',
  burnout:        'Выгорание',
  self_esteem:    'Самооценка',
  social_anxiety: 'Соц. тревога',
  attachment:     'Привязанность',
};

const NEGATIVE_DIMS = ['anxiety', 'stress', 'apathy', 'loneliness', 'burnout', 'social_anxiety'];

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

function dimBarColor(dim, score) {
  if (NEGATIVE_DIMS.includes(dim)) return scoreColor(score);
  // Позитивные: self_esteem, attachment — инвертируем
  if (score >= 67) return LEVEL_COLORS.green;
  if (score >= 34) return LEVEL_COLORS.yellow;
  return LEVEL_COLORS.red;
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

function ProfileSection({ metrics }) {
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
        const barColor = dimBarColor(dim, score);
        return (
          <View key={dim} style={styles.dimRow}>
            <Text style={styles.dimLabel}>{DIMENSION_LABELS[dim]}</Text>
            <View style={styles.dimBarWrap}>
              <View style={[styles.dimBarFill, { width: `${score}%`, backgroundColor: barColor }]} />
            </View>
            <Text style={[styles.dimScore, { color: barColor }]}>{score}</Text>
          </View>
        );
      })}
    </SectionCard>
  );
}

// Секция 4: Тренд 4 недели
function TrendSection({ metricsHistory }) {
  if (!metricsHistory || metricsHistory.length === 0) {
    return (
      <SectionCard title="Тренд за 4 недели">
        <Text style={styles.emptyText}>
          Данные появятся после нескольких недель использования
        </Text>
      </SectionCard>
    );
  }

  // metricsHistory отсортирован desc, разворачиваем для отображения от старого к новому
  const ordered = [...metricsHistory].reverse();
  const maxScore = Math.max(...ordered.map(m => m.composite_score || 1), 1);
  const BAR_MAX_HEIGHT = 80;

  return (
    <SectionCard title="Тренд за 4 недели">
      <View style={styles.trendRow}>
        {ordered.map((m, i) => {
          const score = m.composite_score ?? 0;
          const barH = Math.max(6, Math.round((score / 100) * BAR_MAX_HEIGHT));
          const barColor = scoreColor(score);
          return (
            <View key={i} style={styles.trendCol}>
              <Text style={[styles.trendScore, { color: barColor }]}>{score}</Text>
              <View style={styles.trendBarWrap}>
                <View style={[styles.trendBar, { height: barH, backgroundColor: barColor }]} />
              </View>
              <Text style={styles.trendDate}>{formatDayMonth(m.week_start)}</Text>
            </View>
          );
        })}
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
        { data: latestMetrics },
        { data: mHistory },
        { data: tests },
        { data: userRow },
      ] = await Promise.all([
        supabase
          .from('user_metrics')
          .select('*')
          .eq('user_id', uid)
          .order('week_start', { ascending: false })
          .limit(1)
          .maybeSingle(),
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
      ]);

      if (!active) return;
      setMetrics(latestMetrics);
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
    <SafeAreaView style={styles.safeArea} edges={['top']}>
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
          <ProfileSection metrics={metrics} />
          <TrendSection metricsHistory={metricsHistory} />
          <ActivitySection userActivity={userActivity} />
          <View style={styles.bottomPad} />
        </ScrollView>
      )}
    </SafeAreaView>
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
    flexDirection: 'row',
    flexShrink: 0,
  },
  scoreNum: {
    fontSize: 32,
    fontWeight: '800',
    lineHeight: 36,
  },
  scoreOf: {
    fontSize: 13,
    color: '#A09080',
    alignSelf: 'flex-end',
    marginBottom: 4,
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
    overflow: 'hidden',
  },
  dimBarFill: {
    height: 6,
    borderRadius: 3,
  },
  dimScore: {
    width: 28,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
  },

  // Секция 4: Тренд
  trendRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    paddingBottom: 8,
  },
  trendCol: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  trendScore: {
    fontSize: 13,
    fontWeight: '700',
  },
  trendBarWrap: {
    width: '100%',
    alignItems: 'center',
    height: 84,
    justifyContent: 'flex-end',
  },
  trendBar: {
    width: '60%',
    borderRadius: 4,
  },
  trendDate: {
    fontSize: 10,
    color: '#A09080',
    textAlign: 'center',
  },
  trendHint: {
    fontSize: 11,
    color: '#A09080',
    marginTop: 8,
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
