import { StyleSheet, Text, View, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useState, useCallback, useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../supabase';
import { store } from '../store';
import { LEVEL_DATA, LEVEL_COLORS } from '../constants';
import { colors } from '../theme';

// Флаг чтобы алерт показывался только один раз за сессию
let testReminderShown = false;

function getDynamic(history) {
  if (history.length < 2) return null;
  const order = { green: 0, yellow: 1, red: 2 };
  const curr = order[history[0]?.level];
  const prev = order[history[1]?.level];
  if (curr < prev) return { label: '↑ Лучше чем раньше', color: '#4CAF50' };
  if (curr > prev) return { label: '↓ Хуже чем раньше', color: '#F44336' };
  return { label: '— Стабильно', color: '#FFC107' };
}

export default function HomeScreen({ navigation }) {
  const [level, setLevel] = useState(store.level || 'green');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data } = await supabase
            .from('test_results')
            .select('level, created_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(5);
          if (data?.length) {
            setLevel(data[0].level);
            store.level = data[0].level;
            setHistory(data);

            // Напоминание если не проходил тест больше 3 дней
            if (!testReminderShown) {
              const lastTest = new Date(data[0].created_at);
              const daysSince = (Date.now() - lastTest.getTime()) / (1000 * 60 * 60 * 24);
              if (daysSince > 3) {
                testReminderShown = true;
                Alert.alert(
                  'Как ты сейчас? 🖤',
                  `Последний раз ты проверял своё состояние ${Math.floor(daysSince)} дн. назад. Может, пройдём тест?`,
                  [
                    { text: 'Позже', style: 'cancel' },
                    { text: 'Пройти тест →', onPress: () => navigation.navigate('Test') },
                  ]
                );
              }
            }
          }
        }
        setLoading(false);
      };
      load();
    }, [])
  );

  const lvlData = LEVEL_DATA[level];
  const lvlColor = LEVEL_COLORS[level];
  const dynamic = getDynamic(history);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.greeting}>Привет, {store.username || 'друг'} 👋</Text>

        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginVertical: 24 }} />
        ) : (
          <View style={[styles.statusCard, { borderColor: lvlColor }]}>
            <Text style={styles.statusEmoji}>{lvlData.emoji}</Text>
            <View style={styles.statusInfo}>
              <Text style={[styles.statusLevel, { color: lvlColor }]}>{lvlData.label}</Text>
              <Text style={styles.statusDesc}>{lvlData.text}</Text>
              {dynamic && (
                <Text style={[styles.dynamicLabel, { color: dynamic.color }]}>{dynamic.label}</Text>
              )}
              {!history.length && (
                <Text style={styles.noTestHint}>Пройди тест чтобы узнать своё состояние</Text>
              )}
            </View>
          </View>
        )}

        <View style={styles.ctaRow}>
          <TouchableOpacity
            style={[styles.ctaPrimary, { backgroundColor: lvlColor }]}
            onPress={() => navigation.navigate('Test')}
          >
            <Text style={styles.ctaPrimaryText}>🧪 Пройти тест</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.ctaSecondary}
            onPress={() => navigation.navigate('Recommendations', { level })}
          >
            <Text style={styles.ctaSecondaryText}>💡 Рекомендации</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Модули</Text>

        <View style={styles.grid}>
          <ModuleButton icon="📰" label="Лента" onPress={() => navigation.navigate('Feed')} />
          <ModuleButton icon="💬" label="Чат" onPress={() => navigation.navigate('Chat')} />
          <ModuleButton icon="🚪" label="Комнаты" onPress={() => navigation.navigate('Rooms')} />
          <ModuleButton icon="🎧" label="Релакс" onPress={() => navigation.navigate('Relax')} />
          <ModuleButton icon="🎣" label="Рыбалка" onPress={() => navigation.navigate('Fishing')} />
          <ModuleButton icon="🍸" label="Бар" onPress={() => navigation.navigate('Bar')} />
        </View>

        {history.length >= 1 && <TestChart history={history} />}

        {history.length > 0 && (
          <View style={styles.historyBlock}>
            <Text style={styles.sectionTitle}>История тестов</Text>
            {history.map((r, i) => {
              const d = LEVEL_DATA[r.level];
              return (
                <View key={i} style={styles.historyRow}>
                  <Text style={styles.historyEmoji}>{d.emoji}</Text>
                  <Text style={[styles.historyLevel, { color: LEVEL_COLORS[r.level] }]}>{d.label}</Text>
                  <Text style={styles.historyDate}>
                    {new Date(r.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const LEVEL_TO_VAL = { green: 1, yellow: 0.5, red: 0 };
const CHART_H = 90;
const PAD_X = 16;
const PAD_Y = 14;

function TestChart({ history }) {
  const [chartWidth, setChartWidth] = useState(0);
  // history newest-first → разворачиваем для отображения слева направо
  const data = [...history].reverse();

  const innerW = chartWidth - PAD_X * 2;
  const innerH = CHART_H - PAD_Y * 2;

  const points = chartWidth > 0 ? data.map((item, i) => ({
    x: PAD_X + (data.length > 1 ? (i / (data.length - 1)) * innerW : innerW / 2),
    y: PAD_Y + (1 - LEVEL_TO_VAL[item.level]) * innerH,
    level: item.level,
    date: new Date(item.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }),
  })) : [];

  return (
    <View style={styles.chartCard}>
      <Text style={styles.sectionTitle}>Динамика состояния</Text>
      <View
        style={{ height: CHART_H, position: 'relative' }}
        onLayout={e => setChartWidth(e.nativeEvent.layout.width)}
      >
        {/* Горизонтальные линии-уровни */}
        {[0, 0.5, 1].map((val, i) => {
          const y = PAD_Y + (1 - val) * innerH;
          const levelColor = val === 1 ? '#4CAF5033' : val === 0.5 ? '#FFC10733' : '#F4433633';
          return (
            <View key={i} style={{
              position: 'absolute', left: 0, right: 0,
              top: y, height: 1, backgroundColor: levelColor,
            }} />
          );
        })}

        {/* Линии между точками */}
        {points.slice(0, -1).map((p, i) => {
          const next = points[i + 1];
          const dx = next.x - p.x;
          const dy = next.y - p.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          const angle = Math.atan2(dy, dx) * (180 / Math.PI);
          const midX = (p.x + next.x) / 2;
          const midY = (p.y + next.y) / 2;
          const fromColor = LEVEL_COLORS[p.level];
          const toColor = LEVEL_COLORS[next.level];
          return (
            <View key={i} style={{
              position: 'absolute',
              width: len,
              height: 2,
              backgroundColor: fromColor,
              left: midX - len / 2,
              top: midY - 1,
              transform: [{ rotate: `${angle}deg` }],
              opacity: 0.8,
            }} />
          );
        })}

        {/* Точки */}
        {points.map((p, i) => (
          <View key={i} style={{
            position: 'absolute',
            width: 12, height: 12, borderRadius: 6,
            backgroundColor: LEVEL_COLORS[p.level],
            left: p.x - 6,
            top: p.y - 6,
            borderWidth: 2,
            borderColor: colors.background,
          }} />
        ))}

        {/* Подписи дат */}
        {points.map((p, i) => (
          <Text key={i} style={{
            position: 'absolute',
            fontSize: 9,
            color: colors.muted,
            left: p.x - 18,
            top: CHART_H - 12,
            width: 36,
            textAlign: 'center',
          }}>
            {p.date}
          </Text>
        ))}

        {/* Подписи уровней слева */}
        {chartWidth > 0 && [
          { val: 1, label: '🟢', y: PAD_Y },
          { val: 0.5, label: '🟡', y: PAD_Y + innerH * 0.5 },
          { val: 0, label: '🔴', y: PAD_Y + innerH },
        ].map((item, i) => (
          <Text key={i} style={{
            position: 'absolute',
            fontSize: 10,
            right: 0,
            top: item.y - 7,
          }}>
            {item.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

function ModuleButton({ icon, label, onPress }) {
  return (
    <TouchableOpacity style={styles.moduleButton} onPress={onPress}>
      <Text style={styles.moduleIcon}>{icon}</Text>
      <Text style={styles.moduleLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: { padding: 24, paddingBottom: 40 },
  greeting: { fontSize: 24, fontWeight: 'bold', color: colors.white, marginBottom: 20 },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    borderLeftWidth: 4,
    marginBottom: 20,
    gap: 16,
  },
  statusEmoji: { fontSize: 36 },
  statusInfo: { flex: 1 },
  statusLevel: { fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  statusDesc: { fontSize: 14, color: colors.muted, lineHeight: 20, marginBottom: 6 },
  dynamicLabel: { fontSize: 13, fontWeight: '600' },
  noTestHint: { fontSize: 13, color: colors.muted, fontStyle: 'italic' },
  ctaRow: { flexDirection: 'row', gap: 12, marginBottom: 32 },
  ctaPrimary: {
    flex: 1,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  ctaPrimaryText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  ctaSecondary: {
    flex: 1,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ctaSecondaryText: { color: colors.white, fontWeight: '600', fontSize: 15 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: colors.muted, marginBottom: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 32 },
  moduleButton: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    width: '30%',
    flexGrow: 1,
  },
  moduleIcon: { fontSize: 28, marginBottom: 6 },
  moduleLabel: { color: colors.white, fontSize: 13, textAlign: 'center' },
  chartCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  historyBlock: { marginTop: 8 },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    gap: 12,
  },
  historyEmoji: { fontSize: 20 },
  historyLevel: { fontSize: 14, fontWeight: '600', flex: 1 },
  historyDate: { fontSize: 12, color: colors.muted },
});
