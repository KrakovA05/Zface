import { StyleSheet, Text, View, TouchableOpacity, Animated, ScrollView } from 'react-native';
import { useState, useRef, useEffect } from 'react';
import { colors } from '../theme';

const FISH = [
  { name: 'Карась', emoji: '🐟', rarity: 'common',   weight: () => (Math.random() * 0.8 + 0.2).toFixed(1) },
  { name: 'Окунь',  emoji: '🐠', rarity: 'common',   weight: () => (Math.random() * 1.2 + 0.4).toFixed(1) },
  { name: 'Щука',   emoji: '🐡', rarity: 'rare',     weight: () => (Math.random() * 3 + 1).toFixed(1) },
  { name: 'Сом',    emoji: '🦈', rarity: 'rare',     weight: () => (Math.random() * 5 + 2).toFixed(1) },
  { name: 'Золотая рыбка', emoji: '✨🐟', rarity: 'legendary', weight: () => (Math.random() * 0.3 + 0.1).toFixed(2) },
  { name: 'Старый ботинок', emoji: '👟', rarity: 'trash', weight: () => '—' },
  { name: 'Водоросли', emoji: '🌿', rarity: 'trash', weight: () => '—' },
];

const RARITY_COLORS = {
  common:    '#aaaaaa',
  rare:      '#4CAF50',
  legendary: '#FFC107',
  trash:     '#555',
};

const WAIT_MESSAGES = [
  'Ждём поклёвку...',
  'Рыба думает...',
  'Тишина над водой...',
  'Поплавок не шевелится...',
  'Кажется что-то есть...',
];

const MOODS = [
  'Вода спокойная, как твои мысли должны быть 🌊',
  'Рыбалка учит ждать. А ждать — это искусство.',
  'Здесь нет спешки. Только ты, вода и время.',
  'Каждая поклёвка — маленькая радость.',
];

export default function FishingScreen() {
  const [phase, setPhase] = useState('idle'); // idle | waiting | bite | result
  const [catchResult, setCatchResult] = useState(null);
  const [catches, setCatches] = useState([]);
  const [waitMsg, setWaitMsg] = useState('');
  const [mood] = useState(MOODS[Math.floor(Math.random() * MOODS.length)]);

  const bobAnim = useRef(new Animated.Value(0)).current;
  const biteAnim = useRef(new Animated.Value(1)).current;
  const waitTimer = useRef(null);
  const msgTimer = useRef(null);

  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      clearTimeout(waitTimer.current);
      clearInterval(msgTimer.current);
    };
  }, []);

  const startBobbing = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(bobAnim, { toValue: 8, duration: 1200, useNativeDriver: true }),
        Animated.timing(bobAnim, { toValue: -4, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  };

  const stopBobbing = () => {
    bobAnim.stopAnimation();
    bobAnim.setValue(0);
  };

  const startBiteAnim = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(biteAnim, { toValue: 1.3, duration: 150, useNativeDriver: true }),
        Animated.timing(biteAnim, { toValue: 0.8, duration: 150, useNativeDriver: true }),
        Animated.timing(biteAnim, { toValue: 1.2, duration: 150, useNativeDriver: true }),
        Animated.timing(biteAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
      ])
    ).start();
  };

  const cast = () => {
    if (phase !== 'idle') return;
    setPhase('waiting');
    setWaitMsg(WAIT_MESSAGES[0]);
    startBobbing();

    let i = 0;
    msgTimer.current = setInterval(() => {
      if (!isMounted.current) return;
      i = (i + 1) % WAIT_MESSAGES.length;
      setWaitMsg(WAIT_MESSAGES[i]);
    }, 2500);

    const delay = Math.random() * 7000 + 4000;
    waitTimer.current = setTimeout(() => {
      if (!isMounted.current) return;
      clearInterval(msgTimer.current);
      stopBobbing();
      biteAnim.setValue(1);
      setPhase('bite');
      setWaitMsg('🎣 КЛЮЁТ! Тяни!');
      startBiteAnim();
    }, delay);
  };

  const pull = () => {
    if (phase !== 'bite') return;
    biteAnim.stopAnimation();
    biteAnim.setValue(1);

    const roll = Math.random();
    let fish;
    if (roll < 0.01) fish = FISH[4];       // legendary
    else if (roll < 0.2) fish = FISH[Math.floor(Math.random() * 2) + 2]; // rare
    else if (roll < 0.35) fish = FISH[Math.floor(Math.random() * 2) + 5]; // trash
    else fish = FISH[Math.floor(Math.random() * 2)]; // common

    const result = { ...fish, weight: fish.weight(), time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) };
    setCatchResult(result);
    setCatches(prev => [result, ...prev].slice(0, 10));
    setPhase('result');
  };

  const reset = () => {
    setCatchResult(null);
    setPhase('idle');
  };

  return (
    <View style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>🎣 Рыбалка</Text>
        <Text style={styles.mood}>{mood}</Text>

        {/* Сцена */}
        <View style={styles.scene}>
          <View style={styles.sky}>
            <Text style={styles.cloud}>☁️</Text>
            <Text style={[styles.cloud, styles.cloud2]}>⛅</Text>
          </View>
          <View style={styles.water}>
            <Text style={styles.waterWave}>〰️〰️〰️〰️〰️</Text>

            {phase === 'idle' && (
              <Text style={styles.sceneTip}>Нажми "Забросить" чтобы начать</Text>
            )}

            {(phase === 'waiting' || phase === 'bite') && (
              <View style={styles.floatContainer}>
                <Animated.Text style={[
                  styles.float,
                  { transform: [{ translateY: phase === 'waiting' ? bobAnim : 0 }, { scale: phase === 'bite' ? biteAnim : 1 }] }
                ]}>
                  🔴
                </Animated.Text>
                <Text style={styles.line}>|{'\n'}|{'\n'}|</Text>
              </View>
            )}

            {phase === 'result' && catchResult && (
              <View style={styles.catchDisplay}>
                <Text style={styles.catchEmoji}>{catchResult.emoji}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Статус и кнопки */}
        <View style={styles.actionArea}>
          {phase === 'idle' && (
            <TouchableOpacity style={styles.castBtn} onPress={cast}>
              <Text style={styles.castBtnText}>🎣 Забросить удочку</Text>
            </TouchableOpacity>
          )}

          {phase === 'waiting' && (
            <View style={styles.waitArea}>
              <Text style={styles.waitText}>{waitMsg}</Text>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => {
                clearTimeout(waitTimer.current);
                clearInterval(msgTimer.current);
                stopBobbing();
                setPhase('idle');
              }}>
                <Text style={styles.cancelText}>Смотать удочку</Text>
              </TouchableOpacity>
            </View>
          )}

          {phase === 'bite' && (
            <TouchableOpacity style={styles.pullBtn} onPress={pull}>
              <Text style={styles.pullBtnText}>💪 ТЯНУТЬ!</Text>
            </TouchableOpacity>
          )}

          {phase === 'result' && catchResult && (
            <View style={styles.resultArea}>
              <View style={[styles.resultCard, { borderColor: RARITY_COLORS[catchResult.rarity] }]}>
                <Text style={styles.resultEmoji}>{catchResult.emoji}</Text>
                <Text style={[styles.resultName, { color: RARITY_COLORS[catchResult.rarity] }]}>
                  {catchResult.name}
                </Text>
                {catchResult.weight !== '—' && (
                  <Text style={styles.resultWeight}>{catchResult.weight} кг</Text>
                )}
                <Text style={[styles.resultRarity, { color: RARITY_COLORS[catchResult.rarity] }]}>
                  {catchResult.rarity === 'legendary' ? '✨ ЛЕГЕНДАРНАЯ!' :
                   catchResult.rarity === 'rare' ? '⭐ Редкая' :
                   catchResult.rarity === 'trash' ? '🗑 Мусор' : 'Обычная'}
                </Text>
              </View>
              <TouchableOpacity style={styles.castBtn} onPress={reset}>
                <Text style={styles.castBtnText}>🎣 Снова забросить</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Улов */}
        {catches.length > 0 && (
          <View style={styles.catchLog}>
            <Text style={styles.catchLogTitle}>Улов сегодня</Text>
            {catches.map((c, i) => (
              <View key={i} style={styles.catchRow}>
                <Text style={styles.catchRowEmoji}>{c.emoji}</Text>
                <Text style={[styles.catchRowName, { color: RARITY_COLORS[c.rarity] }]}>{c.name}</Text>
                <Text style={styles.catchRowWeight}>{c.weight !== '—' ? `${c.weight} кг` : '—'}</Text>
                <Text style={styles.catchRowTime}>{c.time}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { padding: 24, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: 'bold', color: colors.white, marginBottom: 6 },
  mood: { fontSize: 14, color: colors.muted, marginBottom: 24, lineHeight: 20 },
  scene: { borderRadius: 20, overflow: 'hidden', marginBottom: 24, height: 220 },
  sky: {
    backgroundColor: '#1a1a3e',
    height: 100,
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  cloud: { position: 'absolute', top: 16, left: 20, fontSize: 28 },
  cloud2: { left: undefined, right: 30, top: 30 },
  water: {
    backgroundColor: '#0d2137',
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
  },
  waterWave: { color: '#1e4d6b', fontSize: 16, marginBottom: 12 },
  sceneTip: { color: '#2a5a7a', fontSize: 14 },
  floatContainer: { alignItems: 'center' },
  float: { fontSize: 20 },
  line: { color: '#5a8fa8', fontSize: 10, textAlign: 'center', lineHeight: 10 },
  catchDisplay: { alignItems: 'center' },
  catchEmoji: { fontSize: 48 },
  actionArea: { alignItems: 'center', marginBottom: 24 },
  castBtn: {
    backgroundColor: '#1a4a6a',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderWidth: 1,
    borderColor: '#2a7aa8',
  },
  castBtnText: { color: colors.white, fontSize: 17, fontWeight: 'bold' },
  waitArea: { alignItems: 'center', gap: 16 },
  waitText: { color: colors.accent, fontSize: 16, fontWeight: '600' },
  cancelBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10 },
  cancelText: { color: colors.muted, fontSize: 14 },
  pullBtn: {
    backgroundColor: '#c0392b',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 40,
  },
  pullBtnText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  resultArea: { alignItems: 'center', gap: 16, width: '100%' },
  resultCard: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 24,
    borderWidth: 2,
    width: '100%',
    gap: 6,
  },
  resultEmoji: { fontSize: 52 },
  resultName: { fontSize: 22, fontWeight: 'bold' },
  resultWeight: { fontSize: 15, color: colors.muted },
  resultRarity: { fontSize: 14, fontWeight: '600', marginTop: 4 },
  catchLog: { backgroundColor: colors.card, borderRadius: 16, padding: 16 },
  catchLogTitle: { fontSize: 15, fontWeight: 'bold', color: colors.white, marginBottom: 12 },
  catchRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  catchRowEmoji: { fontSize: 18, width: 28 },
  catchRowName: { flex: 1, fontSize: 14 },
  catchRowWeight: { fontSize: 13, color: colors.muted, width: 50, textAlign: 'right' },
  catchRowTime: { fontSize: 12, color: colors.muted, width: 40, textAlign: 'right' },
});
