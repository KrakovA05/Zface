import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';
import { store } from '../store';

const LEVEL_COLORS = { green: '#5DAA72', yellow: '#AA7C00', red: '#c0392b' };
const LEVEL_NAMES  = { green: 'Зелёный', yellow: 'Жёлтый', red: 'Красный' };
const LEVEL_PCT    = { green: '22%', yellow: '55%', red: '82%' };

const LOCKED_DIMS = [
  'Тревога', 'Стресс', 'Апатия', 'Одиночество',
  'Выгорание', 'Нехватка уверенности', 'Соц. тревога', 'Тревога привязанности',
];

export default function AnalyticsPreviewScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const level  = route.params?.level || store.level || 'green';
  const lColor = LEVEL_COLORS[level];

  const goToTest = () => {
    navigation.navigate('PsychTest', {
      testId: 'pss4',
      onComplete: () => navigation.replace('OnboardingMoment', { level }),
    });
  };

  const skip = () => navigation.replace('OnboardingMoment', { level });

  return (
    <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
      <Text style={styles.heading}>Твой профиль</Text>

      {/* Уровень — заполнен */}
      <View style={styles.card}>
        <View style={styles.levelRow}>
          <Text style={styles.dimLabel}>Уровень</Text>
          <Text style={[styles.levelValue, { color: lColor }]}>{LEVEL_NAMES[level]}</Text>
        </View>
        <View style={styles.barWrap}>
          <View style={[styles.barFill, { width: LEVEL_PCT[level], backgroundColor: lColor }]} />
        </View>
      </View>

      {/* Заблокированные измерения */}
      <View style={styles.card}>
        {LOCKED_DIMS.map((label, i) => (
          <View key={i} style={[styles.lockedRow, i > 0 && styles.lockedRowBorder]}>
            <Text style={styles.lockedLabel}>{label}</Text>
            <View style={styles.lockedBarWrap}>
              <View style={styles.lockedBarFill} />
            </View>
            <Ionicons name="lock-closed-outline" size={13} color={colors.muted} />
          </View>
        ))}
      </View>

      <Text style={styles.hint}>узнай подробнее — 4 вопроса</Text>

      <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: lColor }]} onPress={goToTest} activeOpacity={0.85}>
        <Text style={styles.primaryBtnText}>Узнать</Text>
        <Ionicons name="arrow-forward" size={18} color="#fff" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.skipBtn} onPress={skip} activeOpacity={0.7}>
        <Text style={styles.skipText}>Пропустить</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF7F2', paddingHorizontal: 20 },
  heading:   { fontSize: 22, fontWeight: '800', color: '#2C2420', marginBottom: 16 },

  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: '#E8DFD0', marginBottom: 10,
  },

  levelRow:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  dimLabel:   { fontSize: 13, color: '#2C2420' },
  levelValue: { fontSize: 13, fontWeight: '700' },
  barWrap:    { height: 5, backgroundColor: '#E8DFD0', borderRadius: 3 },
  barFill:    { height: 5, borderRadius: 3 },

  lockedRow:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10 },
  lockedRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E8DFD0' },
  lockedLabel:     { fontSize: 13, color: '#A09080', width: 130 },
  lockedBarWrap:   { flex: 1, height: 4, backgroundColor: '#E8DFD0', borderRadius: 2 },
  lockedBarFill:   { width: '40%', height: 4, backgroundColor: '#E8DFD0', borderRadius: 2 },

  hint: { fontSize: 12, color: '#A09080', textAlign: 'center', marginVertical: 16 },

  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: 14,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  skipBtn: { marginTop: 12, alignItems: 'center', paddingVertical: 10 },
  skipText: { fontSize: 14, color: '#A09080' },
});
