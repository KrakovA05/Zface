import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';

const PHASES = [
  { label: 'Вдох',    duration: 4000, toScale: 1.35 },
  { label: 'Задержи', duration: 4000, toScale: 1.35 },
  { label: 'Выдох',   duration: 4000, toScale: 1.0  },
  { label: 'Пауза',   duration: 4000, toScale: 1.0  },
];

export default function BreathingScreen({ navigation }) {
  const [running, setRunning]   = useState(false);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [secs, setSecs]         = useState(PHASES[0].duration / 1000);
  const scale = useRef(new Animated.Value(1.0)).current;

  useEffect(() => {
    if (!running) return;
    const phase = PHASES[phaseIdx];
    setSecs(phase.duration / 1000);

    Animated.timing(scale, {
      toValue: phase.toScale,
      duration: phase.duration,
      useNativeDriver: true,
    }).start();

    let s = phase.duration / 1000;
    const interval = setInterval(() => {
      s -= 1;
      setSecs(s);
    }, 1000);

    const timeout = setTimeout(() => {
      clearInterval(interval);
      setPhaseIdx(i => (i + 1) % PHASES.length);
    }, phase.duration);

    return () => { clearInterval(interval); clearTimeout(timeout); };
  }, [running, phaseIdx]);

  const start = () => { setRunning(true); setPhaseIdx(0); };
  const stop  = () => {
    setRunning(false);
    setPhaseIdx(0);
    setSecs(PHASES[0].duration / 1000);
    Animated.timing(scale, { toValue: 1.0, duration: 400, useNativeDriver: true }).start();
  };

  const phase = PHASES[phaseIdx];

  return (
    <View style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => { stop(); navigation.goBack(); }} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Дыхание</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        <Text style={styles.hint}>4 · 4 · 4 · 4 — коробочное дыхание</Text>

        <View style={styles.circleArea}>
          <Animated.View style={[styles.outerRing, { transform: [{ scale }] }]} />
          <Animated.View style={[styles.circle, { transform: [{ scale }] }]}>
            <Text style={styles.phaseLabel}>{running ? phase.label : 'Готов'}</Text>
            {running && <Text style={styles.phaseSecs}>{secs}</Text>}
          </Animated.View>
        </View>

        <TouchableOpacity
          style={[styles.btn, running && styles.btnStop]}
          onPress={running ? stop : start}
          activeOpacity={0.8}
        >
          <Ionicons name={running ? 'stop' : 'play'} size={18} color="#fff" />
          <Text style={styles.btnText}>{running ? 'Остановить' : 'Начать'}</Text>
        </TouchableOpacity>

        <Text style={styles.description}>
          Снижает тревогу и активирует парасимпатическую нервную систему.{'\n'}
          Хорошо работает при панике, стрессе и перед сном.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 8,
  },
  backBtn: { padding: 4, width: 40 },
  headerTitle: { fontSize: 17, fontWeight: '600', color: colors.white },

  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  hint: { color: colors.muted, fontSize: 13, marginBottom: 56, letterSpacing: 0.5 },

  circleArea: { width: 240, height: 240, alignItems: 'center', justifyContent: 'center', marginBottom: 56 },
  outerRing: {
    position: 'absolute',
    width: 220, height: 220, borderRadius: 110,
    backgroundColor: colors.accent + '18',
  },
  circle: {
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: colors.accent + '2a',
    borderWidth: 2, borderColor: colors.accent + '55',
    alignItems: 'center', justifyContent: 'center',
    gap: 6,
  },
  phaseLabel: { color: colors.white, fontSize: 18, fontWeight: '600' },
  phaseSecs:  { color: colors.accent, fontSize: 28, fontWeight: '300' },

  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.accent,
    borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32,
    marginBottom: 32,
  },
  btnStop: { backgroundColor: '#555' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  description: {
    color: colors.muted, fontSize: 13, lineHeight: 20,
    textAlign: 'center',
  },
});
