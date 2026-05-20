import { StyleSheet, Text, View, ScrollView, ActivityIndicator, TouchableOpacity, Dimensions } from 'react-native';
import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';
import { supabase } from '../supabase';
import { store } from '../store';
import { colors } from '../theme';
import { computeLiveProfile } from '../utils/computeLiveProfile';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_H = 180;
const CHART_PADDING = { top: 20, bottom: 36, left: 32, right: 16 };

const DIMENSION_DESCRIPTIONS = {
  anxiety:        'Уровень тревожности. Складывается из теста GAD-7 и ночной активности.',
  stress:         'Воспринимаемый стресс. Складывается из теста PSS-4 и среднего балла чекинов.',
  apathy:         'Апатия и потеря интереса. Складывается из теста и активности в чатах.',
  loneliness:     'Одиночество. Складывается из теста UCLA-3 и количества личных переписок.',
  burnout:        'Эмоциональное выгорание. Складывается из теста OLBI и тренда настроения.',
  self_esteem:    'Нехватка уверенности в себе. Основан на тесте Розенберга.',
  social_anxiety: 'Социальная тревожность. Основан на тесте Mini-SPIN.',
  attachment:     'Тревога привязанности. Основан на тесте ECR-Short.',
};

function scoreColor(score) {
  if (score <= 33) return '#5DAA72';
  if (score <= 66) return '#AA7C00';
  return '#c0392b';
}

function formatWeek(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const months = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

function LineChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <View style={styles.chartEmpty}>
        <Text style={styles.chartEmptyText}>Пройди тест ещё раз, чтобы увидеть динамику</Text>
      </View>
    );
  }

  const svgW = SCREEN_WIDTH - 32;
  const chartW = svgW - CHART_PADDING.left - CHART_PADDING.right;
  const innerH = CHART_H - CHART_PADDING.top - CHART_PADDING.bottom;

  const points = data.map((d, i) => ({
    x: CHART_PADDING.left + (data.length > 1 ? (i / (data.length - 1)) * chartW : chartW / 2),
    y: CHART_PADDING.top + innerH - (d.score / 100) * innerH,
    score: d.score,
    label: d.label,
    isLive: d.isLive,
  }));

  const y33 = CHART_PADDING.top + innerH - (33 / 100) * innerH;
  const y66 = CHART_PADDING.top + innerH - (66 / 100) * innerH;

  return (
    <View style={styles.chartWrap}>
      <Svg width={svgW} height={CHART_H}>
        {/* Зоны сетки */}
        <Line x1={CHART_PADDING.left} y1={y66} x2={svgW - CHART_PADDING.right} y2={y66}
          stroke="#E8DFD0" strokeWidth="1" strokeDasharray="4,4" />
        <Line x1={CHART_PADDING.left} y1={y33} x2={svgW - CHART_PADDING.right} y2={y33}
          stroke="#E8DFD0" strokeWidth="1" strokeDasharray="4,4" />
        <SvgText x={CHART_PADDING.left - 4} y={y66 + 4} fontSize="9" fill="#C8BFB0" textAnchor="end">66</SvgText>
        <SvgText x={CHART_PADDING.left - 4} y={y33 + 4} fontSize="9" fill="#C8BFB0" textAnchor="end">33</SvgText>

        {/* Цветные отрезки между точками */}
        {points.slice(0, -1).map((p, i) => {
          const next = points[i + 1];
          return (
            <Line key={i}
              x1={p.x} y1={p.y} x2={next.x} y2={next.y}
              stroke={scoreColor(p.score)} strokeWidth="2.5" strokeLinecap="round"
              opacity={0.85}
            />
          );
        })}

        {/* Точки */}
        {points.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={p.isLive ? 5 : 4}
            fill={scoreColor(p.score)}
            stroke={colors.background} strokeWidth="2"
          />
        ))}

        {/* Подписи дат — первая, последняя и каждая вторая при >5 точках */}
        {points.map((p, i) => {
          const isFirst = i === 0;
          const isLast = i === points.length - 1;
          if (!isFirst && !isLast && data.length > 5 && i % 2 !== 0) return null;
          if (!isFirst && !isLast && data.length <= 5) return null;
          return (
            <SvgText key={i} x={p.x} y={CHART_H - 2} fontSize="9" fill="#A09080"
              textAnchor={isFirst ? 'start' : isLast ? 'end' : 'middle'}>
              {p.label}
            </SvgText>
          );
        })}
      </Svg>
    </View>
  );
}

export default function DimensionHistoryScreen({ route, navigation }) {
  const { dimension, label } = route.params;
  const scoreKey = `${dimension}_score`;

  const [chartPoints, setChartPoints] = useState([]);
  const [liveScore, setLiveScore] = useState(null);
  const [testCount, setTestCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    let active = true;
    async function load() {
      setLoading(true);
      const uid = store.userId;
      if (!uid) { setLoading(false); return; }

      const [{ data: psychRows }, liveProfile] = await Promise.all([
        supabase
          .from('psych_test_results')
          .select('normalized_score, created_at')
          .eq('user_id', uid)
          .eq('dimension', dimension)
          .order('created_at', { ascending: true }),
        computeLiveProfile(uid),
      ]);

      if (!active) return;

      const live = liveProfile[scoreKey] ?? null;
      setLiveScore(live);
      setTestCount(psychRows?.length ?? 0);

      const points = (psychRows || []).map(r => ({
        score: r.normalized_score,
        label: formatWeek(r.created_at),
        isLive: false,
      }));

      // Добавляем текущий балл как последнюю точку если он отличается от последнего теста
      if (live !== null) {
        const lastTestScore = points.length > 0 ? points[points.length - 1].score : null;
        if (lastTestScore === null || lastTestScore !== live) {
          points.push({ score: live, label: 'сейчас', isLive: true });
        }
      }

      setChartPoints(points);
      setLoading(false);
    }
    load();
    return () => { active = false; };
  }, [dimension]));

  const current = liveScore;
  const firstScore = chartPoints.length > 1 ? chartPoints[0].score : null;
  const totalDelta = current !== null && firstScore !== null ? current - firstScore : null;

  return (
    <View style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{label}</Text>
        <View style={styles.backBtn} />
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

          {/* Текущий балл + общий тренд */}
          <View style={styles.card}>
            <View style={styles.summaryRow}>
              {current !== null && (
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryValue, { color: scoreColor(current) }]}>{current}</Text>
                  <Text style={styles.summaryCaption}>сейчас</Text>
                </View>
              )}
              {totalDelta !== null && (
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryValue, { color: totalDelta > 0 ? '#c0392b' : '#5DAA72' }]}>
                    {totalDelta > 0 ? `+${totalDelta}` : totalDelta}
                  </Text>
                  <Text style={styles.summaryCaption}>за всё время</Text>
                </View>
              )}
              {testCount > 0 && (
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{testCount}</Text>
                  <Text style={styles.summaryCaption}>{testCount === 1 ? 'тест' : testCount < 5 ? 'теста' : 'тестов'}</Text>
                </View>
              )}
            </View>

            {totalDelta !== null && (
              <View style={[styles.insightRow, { backgroundColor: totalDelta > 0 ? '#FFF0F0' : '#F0FAF3' }]}>
                <Ionicons
                  name={totalDelta > 0 ? 'trending-up' : 'trending-down'}
                  size={16}
                  color={totalDelta > 0 ? '#c0392b' : '#5DAA72'}
                />
                <Text style={[styles.insightText, { color: totalDelta > 0 ? '#c0392b' : '#5DAA72' }]}>
                  {totalDelta > 0
                    ? `Показатель вырос на ${totalDelta} пунктов — ситуация ухудшилась`
                    : `Показатель снизился на ${Math.abs(totalDelta)} пунктов — ситуация улучшилась`
                  }
                </Text>
              </View>
            )}
          </View>

          {/* График */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Динамика</Text>
            <LineChart data={chartPoints} />
            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#5DAA72' }]} />
                <Text style={styles.legendText}>норм (0–33)</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#AA7C00' }]} />
                <Text style={styles.legendText}>умеренно (34–66)</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#c0392b' }]} />
                <Text style={styles.legendText}>высокий (67+)</Text>
              </View>
            </View>
          </View>

          {/* Описание */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Что это измеряет</Text>
            <Text style={styles.descText}>{DIMENSION_DESCRIPTIONS[dimension]}</Text>
            <Text style={styles.descHint}>Высокий балл означает большую нагрузку по этому параметру.</Text>
          </View>

          <View style={styles.bottomPad} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E8DFD0',
    backgroundColor: colors.background,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: colors.white },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32, gap: 12 },
  bottomPad: { height: 80 },

  card: {
    backgroundColor: colors.card, borderRadius: 16,
    padding: 16, borderWidth: 1, borderColor: '#E8DFD0',
  },
  cardTitle: {
    fontSize: 12, fontWeight: '700', color: '#A09080',
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 14,
  },

  summaryRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 12 },
  summaryItem: { alignItems: 'center', gap: 2 },
  summaryValue: { fontSize: 28, fontWeight: '800', color: colors.white },
  summaryCaption: { fontSize: 11, color: '#A09080' },

  insightRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
  },
  insightText: { fontSize: 13, flex: 1, lineHeight: 18 },

  chartWrap: { alignItems: 'center' },
  chartEmpty: { height: CHART_H, alignItems: 'center', justifyContent: 'center' },
  chartEmptyText: { fontSize: 13, color: '#A09080', textAlign: 'center' },

  legendRow: { flexDirection: 'row', gap: 12, flexWrap: 'wrap', marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 10, color: '#A09080' },

  descText: { fontSize: 14, color: colors.white, lineHeight: 21, marginBottom: 8 },
  descHint: { fontSize: 12, color: '#A09080', lineHeight: 17 },
});
