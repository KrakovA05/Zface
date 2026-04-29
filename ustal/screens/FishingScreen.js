import { StyleSheet, Text, View, TouchableOpacity, Animated, ScrollView, Dimensions } from 'react-native';
import { useState, useRef, useEffect } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';

const { width: SW } = Dimensions.get('window');

// ─── Точки сцены ──────────────────────────────────────────────
const SC_H      = 300;
const WATER_TOP = 185;
const GRIP      = { x: 30,        y: 262 };
const TIP       = { x: SW * 0.47, y: 58  };
const FLOAT_X   = SW * 0.55;
const FLOAT_Y   = 208;   // ниже холма, в воде

// dx/dy вектор удочки
const ROD_DX = TIP.x - GRIP.x;
const ROD_DY = TIP.y - GRIP.y;

// Точка на удочке по параметру t ∈ [0..1]
const rodP = (t) => ({ x: GRIP.x + t * ROD_DX, y: GRIP.y + t * ROD_DY });

// Функция — стиль для диагонального отрезка между двумя точками
const seg = (x1, y1, x2, y2, h, color, extra = {}) => {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;
  return {
    position: 'absolute',
    width: len, height: h,
    left: (x1 + x2) / 2 - len / 2,
    top:  (y1 + y2) / 2 - h  / 2,
    backgroundColor: color,
    borderRadius: h / 2,
    transform: [{ rotate: `${angle}deg` }],
    ...extra,
  };
};

// Позиция катушки (на 28% от ручки)
const REEL_P = rodP(0.28);

// ─── Время суток ──────────────────────────────────────────────
const getTimePeriod = () => {
  const h = new Date().getHours();
  if (h >= 6 && h < 11) return 'morning';
  if (h >= 11 && h < 18) return 'day';
  if (h >= 18 && h < 22) return 'evening';
  return 'night';
};

const SCENE = {
  morning: { sky: ['#FF9966', '#FFB347', '#FFEAA0'], water: ['#3A9090', '#1A6070'], hill: '#7A4A2E', label: 'Утро',  icon: '🌅' },
  day:     { sky: ['#74B9E8', '#A8D8F0', '#D4EFFF'], water: ['#1A7A9A', '#0D5070'], hill: '#2E6040', label: 'День',  icon: '☀️'  },
  evening: { sky: ['#2D1B4E', '#8B3A6B', '#E8604A'], water: ['#1A2A50', '#0D1830'], hill: '#1A0D2E', label: 'Вечер', icon: '🌆' },
  night:   { sky: ['#050510', '#0D0D2E', '#1A1A4A'], water: ['#0A1520', '#060D15'], hill: '#0D0D20', label: 'Ночь',  icon: '🌙' },
};

// ─── Рыбы ─────────────────────────────────────────────────────
const FISH = [
  { name: 'Тихий карась',      emoji: '🐟', rarity: 'common',    min: 0.2, max: 0.9,  times: null },
  { name: 'Задумчивый окунь',  emoji: '🐠', rarity: 'common',    min: 0.3, max: 1.2,  times: null },
  { name: 'Мелкий ёрш',        emoji: '🐟', rarity: 'common',    min: 0.05,max: 0.3,  times: ['day','evening'] },
  { name: 'Дремлющий лещ',     emoji: '🐡', rarity: 'common',    min: 0.5, max: 1.8,  times: ['morning','night'] },
  { name: 'Неспешный судак',   emoji: '🐟', rarity: 'uncommon',  min: 0.8, max: 2.5,  times: ['morning','evening'] },
  { name: 'Молчаливый линь',   emoji: '🐠', rarity: 'uncommon',  min: 0.6, max: 2.0,  times: ['day','evening'] },
  { name: 'Серебряный карп',   emoji: '🐡', rarity: 'rare',      min: 2.0, max: 5.0,  times: ['morning','day'] },
  { name: 'Ночная щука',       emoji: '🐟', rarity: 'rare',      min: 1.5, max: 4.5,  times: ['evening','night'] },
  { name: 'Глубокий сом',      emoji: '🦈', rarity: 'rare',      min: 4.0, max: 12.0, times: ['night'] },
  { name: 'Золотая рыбка',     emoji: '✨',  rarity: 'legendary', min: 0.1, max: 0.3,  times: null },
  { name: 'Лунная форель',     emoji: '🌟', rarity: 'legendary', min: 1.0, max: 3.0,  times: ['night'] },
  { name: 'Старый ботинок',    emoji: '👟', rarity: 'trash',     min: 0,   max: 0,    times: null },
  { name: 'Консервная банка',  emoji: '🥫', rarity: 'trash',     min: 0,   max: 0,    times: null },
  { name: 'Записка в бутылке', emoji: '📜', rarity: 'special',   min: 0,   max: 0,    times: ['evening','night'] },
];

const BOTTLE_NOTES = [
  'Ты не один. Кто-то сейчас тоже не спит.',
  'Всё проходит. Даже это.',
  'Иногда достаточно просто сидеть у воды.',
  'Завтра будет немного легче.',
  'Тот, кто умеет ждать — умеет и находить.',
];

const RARITY = {
  common:    { color: '#8B7B6B', label: 'Обычная' },
  uncommon:  { color: '#4CAF50', label: 'Необычная' },
  rare:      { color: '#5b9bd5', label: 'Редкая' },
  legendary: { color: '#FFC107', label: 'Легендарная' },
  special:   { color: '#9B6B9B', label: 'Особая находка' },
  trash:     { color: '#666',    label: 'Мусор' },
};

const WAIT = {
  morning: ['Утренний туман над водой...', 'Рыба ещё не проснулась...', 'Где-то поёт птица...', 'Тихо. Очень тихо.'],
  day:     ['Ждём поклёвку...', 'Рыба думает...', 'Поплавок не шевелится...', 'Кажется, что-то есть...'],
  evening: ['Закат отражается в воде...', 'Рыба выходит на кормёжку...', 'Тёплый вечер...', 'Чуть-чуть подождём...'],
  night:   ['Ночная тишина...', 'В глубине что-то движется...', 'Глубины просыпаются...', 'Луна смотрит в воду...'],
};

const MOODS = {
  morning: 'Раннее утро. Только ты и вода.',
  day:     'Здесь нет спешки. Только вода и время.',
  evening: 'Вечер у воды — про то, чтобы отпустить.',
  night:   'Ночью рыба крупнее. И мысли тоже.',
};

const rollFish = (period) => {
  const r = Math.random();
  let pool;
  if (r < 0.01)      pool = FISH.filter(f => f.rarity === 'legendary' && (!f.times || f.times.includes(period)));
  else if (r < 0.07) pool = FISH.filter(f => f.rarity === 'rare'      && (!f.times || f.times.includes(period)));
  else if (r < 0.13) pool = FISH.filter(f => f.rarity === 'special'   && (!f.times || f.times.includes(period)));
  else if (r < 0.23) pool = FISH.filter(f => f.rarity === 'trash');
  else if (r < 0.45) pool = FISH.filter(f => f.rarity === 'uncommon'  && (!f.times || f.times.includes(period)));
  else               pool = FISH.filter(f => f.rarity === 'common'    && (!f.times || f.times.includes(period)));
  if (!pool?.length) pool = FISH.filter(f => f.rarity === 'common');
  return pool[Math.floor(Math.random() * pool.length)];
};

// ─── Компонент ────────────────────────────────────────────────
export default function FishingScreen() {
  const [period] = useState(getTimePeriod());
  const sc = SCENE[period];

  const [phase, setPhase] = useState('idle');
  const [result, setResult] = useState(null);
  const [catches, setCatches] = useState([]);
  const [waitMsg, setWaitMsg] = useState('');

  const bobAnim    = useRef(new Animated.Value(0)).current;
  const biteAnim   = useRef(new Animated.Value(1)).current;
  const wave1      = useRef(new Animated.Value(0)).current;
  const wave2      = useRef(new Animated.Value(0)).current;
  const resultAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim  = useRef(new Animated.Value(1)).current;
  const ripple1    = useRef(new Animated.Value(0)).current;
  const ripple2    = useRef(new Animated.Value(0)).current;

  const waitTimer = useRef(null);
  const msgTimer  = useRef(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    Animated.loop(Animated.timing(wave1, { toValue: 1, duration: 3500, useNativeDriver: true })).start();
    Animated.loop(Animated.timing(wave2, { toValue: 1, duration: 5200, useNativeDriver: true })).start();
    return () => {
      isMounted.current = false;
      clearTimeout(waitTimer.current);
      clearInterval(msgTimer.current);
    };
  }, []);

  const w1x = wave1.interpolate({ inputRange: [0, 1], outputRange: [0, -130] });
  const w2x = wave2.interpolate({ inputRange: [0, 1], outputRange: [-50, 80] });

  const startBobbing = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(bobAnim, { toValue: 8, duration: 900, useNativeDriver: true }),
        Animated.timing(bobAnim, { toValue: -4, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  };
  const stopBobbing = () => { bobAnim.stopAnimation(); bobAnim.setValue(0); };

  const startBite = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(biteAnim, { toValue: 1.6, duration: 90,  useNativeDriver: true }),
        Animated.timing(biteAnim, { toValue: 0.6, duration: 90,  useNativeDriver: true }),
        Animated.timing(biteAnim, { toValue: 1.4, duration: 90,  useNativeDriver: true }),
        Animated.timing(biteAnim, { toValue: 1.0, duration: 120, useNativeDriver: true }),
      ])
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.07, duration: 480, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.0,  duration: 480, useNativeDriver: true }),
      ])
    ).start();
    const doRipple = (anim) => {
      anim.setValue(0);
      Animated.timing(anim, { toValue: 1, duration: 1300, useNativeDriver: true })
        .start(() => { if (isMounted.current) doRipple(anim); });
    };
    doRipple(ripple1);
    setTimeout(() => { if (isMounted.current) doRipple(ripple2); }, 450);
  };

  const cast = () => {
    if (phase !== 'idle') return;
    setPhase('waiting');
    const msgs = WAIT[period];
    setWaitMsg(msgs[0]);
    startBobbing();
    let i = 0;
    msgTimer.current = setInterval(() => {
      if (!isMounted.current) return;
      i = (i + 1) % msgs.length;
      setWaitMsg(msgs[i]);
    }, 2800);
    waitTimer.current = setTimeout(() => {
      if (!isMounted.current) return;
      clearInterval(msgTimer.current);
      stopBobbing();
      biteAnim.setValue(1);
      setPhase('bite');
      startBite();
    }, Math.random() * 8000 + 4000);
  };

  const pull = () => {
    if (phase !== 'bite') return;
    biteAnim.stopAnimation(); biteAnim.setValue(1);
    pulseAnim.stopAnimation(); pulseAnim.setValue(1);
    ripple1.stopAnimation(); ripple2.stopAnimation();
    const fish = rollFish(period);
    const weight = fish.max > 0
      ? (Math.random() * (fish.max - fish.min) + fish.min).toFixed(1)
      : null;
    const note = fish.rarity === 'special'
      ? BOTTLE_NOTES[Math.floor(Math.random() * BOTTLE_NOTES.length)]
      : null;
    const r = { ...fish, weight, note, time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) };
    setResult(r);
    setCatches(prev => [r, ...prev].slice(0, 20));
    setPhase('result');
    resultAnim.setValue(0);
    Animated.spring(resultAnim, { toValue: 1, useNativeDriver: true, tension: 130, friction: 9 }).start();
  };

  const reset  = () => { setResult(null); setPhase('idle'); };
  const cancel = () => { clearTimeout(waitTimer.current); clearInterval(msgTimer.current); stopBobbing(); setPhase('idle'); };

  const rippleStyle = (anim) => ({
    opacity:   anim.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0.7, 0.3, 0] }),
    transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 2.8] }) }],
  });

  // Точки для кончика удочки (tip секция от 70%)
  const p70 = rodP(0.70);
  const p26 = rodP(0.26);

  return (
    <View style={styles.wrap}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ── Сцена ── */}
        <View style={styles.scene}>

          {/* Небо */}
          <LinearGradient colors={sc.sky} style={styles.sky} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}>
            {period === 'night' && [[12,28],[24,90],[9,38],[30,115],[16,165],[8,52],[35,200],[20,240]].map(([t,l], i) => (
              <View key={i} style={[styles.star, { top: t, left: l }]} />
            ))}
            {period === 'evening' && <View style={styles.moon} />}
            {(period === 'morning') && <View style={[styles.sun, { backgroundColor: '#FFE566', right: 28, top: 14 }]} />}
            {(period === 'day')     && <View style={[styles.sun, { backgroundColor: '#FFD700', right: 32, top: 18 }]} />}
          </LinearGradient>

          {/* Холм */}
          <View style={[styles.hill, { backgroundColor: sc.hill }]} />

          {/* Вода */}
          <LinearGradient colors={sc.water} style={styles.water} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}>
            <Animated.View style={[styles.waveBand,  { transform: [{ translateX: w1x }] }]} />
            <Animated.View style={[styles.waveBand2, { transform: [{ translateX: w2x }] }]} />

            {phase === 'idle' && <Text style={styles.idleHint}>Нажми «Забросить» чтобы начать</Text>}

            {/* Пойманная рыба */}
            {phase === 'result' && result && (
              <Animated.Text style={[styles.caughtEmoji, { transform: [{ scale: resultAnim }], opacity: resultAnim }]}>
                {result.emoji}
              </Animated.Text>
            )}
          </LinearGradient>

          {/* ── Поплавок — поверх холма и воды ── */}
          {(phase === 'waiting' || phase === 'bite') && (
            <>
              {/* Рябь */}
              {phase === 'bite' && (
                <>
                  <Animated.View style={[styles.rippleRing, rippleStyle(ripple1), { left: FLOAT_X - 22, top: FLOAT_Y - 22 }]} />
                  <Animated.View style={[styles.rippleRing, rippleStyle(ripple2), { left: FLOAT_X - 22, top: FLOAT_Y - 22 }]} />
                </>
              )}
              {/* Поплавок */}
              <Animated.View style={[
                styles.floatWrap,
                { left: FLOAT_X - 9, top: FLOAT_Y - 46 },
                { transform: [
                    { translateY: phase === 'waiting' ? bobAnim : 0 },
                    { scale: phase === 'bite' ? biteAnim : 1 },
                  ],
                },
              ]}>
                {/* Антенна */}
                <View style={styles.floatAntenna} />
                {/* Тело */}
                <View style={styles.floatBody}>
                  <View style={styles.floatBodyRed} />
                  <View style={styles.floatBodyWhite} />
                </View>
                {/* Нижняя проволока */}
                <View style={styles.floatWire} />
              </Animated.View>
            </>
          )}

          {/* ── Удочка (нарисована через seg()) ── */}
          {/* Ручка (cork/grip) */}
          <View style={seg(GRIP.x, GRIP.y, p26.x, p26.y, 9, '#3A1E0A', { borderRadius: 5 })} />
          {/* Бланк (основная часть) */}
          <View style={seg(p26.x, p26.y, p70.x, p70.y, 4.5, '#8B5530')} />
          {/* Кончик (тонкий) */}
          <View style={seg(p70.x, p70.y, TIP.x, TIP.y, 2, '#C49050', { opacity: 0.9 })} />

          {/* Катушка */}
          <View style={[styles.reel, { left: REEL_P.x - 12, top: REEL_P.y - 8 }]}>
            <View style={styles.reelSpool} />
          </View>

          {/* Направляющие кольца */}
          <View style={seg(p26.x - 3, p26.y - 3, p26.x + 3, p26.y + 3, 2.5, 'rgba(180,180,180,0.85)', { borderRadius: 1.5 })} />
          <View style={seg(rodP(0.50).x - 3, rodP(0.50).y - 3, rodP(0.50).x + 3, rodP(0.50).y + 3, 2, 'rgba(180,180,180,0.75)', { borderRadius: 1 })} />
          <View style={seg(rodP(0.68).x - 2, rodP(0.68).y - 2, rodP(0.68).x + 2, rodP(0.68).y + 2, 1.5, 'rgba(180,180,180,0.65)', { borderRadius: 1 })} />

          {/* Леска: от кончика до антенны поплавка */}
          {(phase === 'waiting' || phase === 'bite') && (
            <View style={seg(TIP.x, TIP.y, FLOAT_X, FLOAT_Y - 46, 1.5, 'rgba(220,215,200,0.6)')} />
          )}

          {/* Бейдж */}
          <View style={styles.timeBadge}>
            <Text style={styles.timeBadgeText}>{sc.icon} {sc.label}</Text>
          </View>
        </View>

        {/* Настроение */}
        <Text style={styles.mood}>{MOODS[period]}</Text>

        {/* ── Кнопки ── */}
        <View style={styles.actions}>
          {phase === 'idle' && (
            <TouchableOpacity style={styles.castBtn} onPress={cast} activeOpacity={0.85}>
              <LinearGradient colors={[colors.accent, '#7A4A9A']} style={styles.castGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Ionicons name="fish-outline" size={22} color="#fff" />
                <Text style={styles.castText}>Забросить удочку</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {phase === 'waiting' && (
            <View style={styles.waitBox}>
              <Text style={styles.waitText}>{waitMsg}</Text>
              <TouchableOpacity style={styles.cancelBtn} onPress={cancel} activeOpacity={0.7}>
                <Text style={styles.cancelText}>Смотать удочку</Text>
              </TouchableOpacity>
            </View>
          )}

          {phase === 'bite' && (
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <TouchableOpacity onPress={pull} activeOpacity={0.85}>
                <LinearGradient colors={['#e74c3c', '#c0392b']} style={styles.pullBtn} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}>
                  <Text style={styles.pullTop}>КЛЮЁТ!</Text>
                  <Text style={styles.pullSub}>Нажми — тяни!</Text>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          )}

          {phase === 'result' && result && (
            <Animated.View style={[styles.resultCard, { borderColor: RARITY[result.rarity].color + '88', transform: [{ scale: resultAnim }], opacity: resultAnim }]}>
              <LinearGradient colors={[RARITY[result.rarity].color + '20', 'transparent']} style={styles.resultGrad}>
                <Text style={styles.resultEmoji}>{result.emoji}</Text>
                <Text style={[styles.resultName, { color: RARITY[result.rarity].color }]}>{result.name}</Text>
                {result.weight && <Text style={styles.resultWeight}>{result.weight} кг</Text>}
                <View style={[styles.rarityPill, { backgroundColor: RARITY[result.rarity].color + '25' }]}>
                  <Text style={[styles.rarityLabel, { color: RARITY[result.rarity].color }]}>{RARITY[result.rarity].label}</Text>
                </View>
                {result.note && (
                  <View style={styles.noteBox}>
                    <Ionicons name="document-text-outline" size={14} color={colors.accent} style={{ marginBottom: 4 }} />
                    <Text style={styles.noteText}>«{result.note}»</Text>
                  </View>
                )}
              </LinearGradient>
              <TouchableOpacity style={styles.againBtn} onPress={reset} activeOpacity={0.8}>
                <Ionicons name="fish-outline" size={16} color={colors.onAccent} />
                <Text style={styles.againText}>Забросить снова</Text>
              </TouchableOpacity>
            </Animated.View>
          )}
        </View>

        {/* Журнал */}
        {catches.length > 0 && (
          <View style={styles.log}>
            <Text style={styles.logTitle}>Улов за сессию</Text>
            {catches.map((c, i) => (
              <View key={i} style={[styles.logRow, i < catches.length - 1 && styles.logDivider]}>
                <View style={[styles.logDot, { backgroundColor: RARITY[c.rarity].color }]} />
                <Text style={styles.logEmoji}>{c.emoji}</Text>
                <Text style={[styles.logName, { color: RARITY[c.rarity].color }]}>{c.name}</Text>
                <Text style={styles.logMeta}>{c.weight ? `${c.weight} кг` : '—'}</Text>
                <Text style={styles.logTime}>{c.time}</Text>
              </View>
            ))}
          </View>
        )}

      </ScrollView>
    </View>
  );
}

// ─── Стили ────────────────────────────────────────────────────
const styles = StyleSheet.create({
  wrap:    { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 48 },

  scene: { width: SW, height: SC_H, marginBottom: 20 },
  sky:   { height: 185, overflow: 'hidden' },

  star: { position: 'absolute', width: 2.5, height: 2.5, borderRadius: 1.5, backgroundColor: '#fff', opacity: 0.9 },
  moon: { position: 'absolute', top: 18, right: 28, width: 28, height: 28, borderRadius: 14, backgroundColor: '#FFF9DC', opacity: 0.85 },
  sun:  { position: 'absolute', width: 32, height: 32, borderRadius: 16 },

  hill: {
    position: 'absolute', bottom: SC_H - 185,
    width: SW + 40, left: -20, height: 70,
    borderTopLeftRadius: 100, borderTopRightRadius: 60,
  },

  water:     { position: 'absolute', bottom: 0, width: SW, height: SC_H - WATER_TOP + 15, overflow: 'hidden' },
  waveBand:  { position: 'absolute', top: 0, width: SW * 3, height: 14, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 7 },
  waveBand2: { position: 'absolute', top: 10, width: SW * 3, height: 8, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 4 },

  // Поплавок
  floatWrap: { position: 'absolute', alignItems: 'center' },
  floatAntenna: {
    width: 2.5, height: 18,
    backgroundColor: '#222',
    borderRadius: 1.5,
  },
  floatBody: {
    width: 18, height: 36,
    borderRadius: 9,
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35, shadowRadius: 4, elevation: 4,
  },
  floatBodyRed: {
    flex: 0.58,
    backgroundColor: '#e74c3c',
  },
  floatBodyWhite: {
    flex: 0.42,
    backgroundColor: '#F2F0EA',
  },
  floatWire: {
    width: 2, height: 10,
    backgroundColor: '#333',
    borderRadius: 1,
  },

  rippleRing: {
    position: 'absolute',
    width: 44, height: 44, borderRadius: 22,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.6)',
  },

  caughtEmoji: { position: 'absolute', top: FLOAT_Y - 50, left: FLOAT_X - 28, fontSize: 56 },
  idleHint:    { position: 'absolute', top: 40, alignSelf: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 12 },

  // Катушка
  reel: {
    position: 'absolute',
    width: 24, height: 16, borderRadius: 8,
    backgroundColor: '#222',
    borderWidth: 1.5, borderColor: '#4A4A4A',
    alignItems: 'center', justifyContent: 'center',
  },
  reelSpool: {
    width: 10, height: 6, borderRadius: 3,
    backgroundColor: '#555',
    borderWidth: 0.5, borderColor: '#888',
  },

  timeBadge: {
    position: 'absolute', top: 14, left: 16,
    backgroundColor: 'rgba(0,0,0,0.32)',
    borderRadius: 20, paddingVertical: 5, paddingHorizontal: 12,
  },
  timeBadgeText: { color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: '500' },

  mood: { fontSize: 14, color: colors.muted, marginHorizontal: 20, marginBottom: 20, lineHeight: 20 },

  actions:  { alignItems: 'center', marginHorizontal: 20, marginBottom: 20 },
  castBtn:  { width: '100%', borderRadius: 18, overflow: 'hidden' },
  castGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16 },
  castText: { color: '#fff', fontSize: 17, fontWeight: '700' },

  waitBox:   { alignItems: 'center', gap: 14, paddingVertical: 8 },
  waitText:  { fontSize: 15, color: colors.muted, textAlign: 'center', lineHeight: 22 },
  cancelBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 9 },
  cancelText:{ color: colors.muted, fontSize: 14 },

  pullBtn: {
    borderRadius: 20, paddingVertical: 22, paddingHorizontal: 56, alignItems: 'center',
    shadowColor: '#e74c3c', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.5, shadowRadius: 16, elevation: 10,
  },
  pullTop: { color: '#fff', fontSize: 26, fontWeight: '900', letterSpacing: 1.5 },
  pullSub: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 },

  resultCard: { width: '100%', borderRadius: 24, borderWidth: 1.5, backgroundColor: colors.card, overflow: 'hidden' },
  resultGrad: { alignItems: 'center', padding: 28, gap: 8 },
  resultEmoji: { fontSize: 64 },
  resultName:  { fontSize: 22, fontWeight: '800' },
  resultWeight:{ fontSize: 15, color: colors.muted },
  rarityPill:  { borderRadius: 20, paddingVertical: 5, paddingHorizontal: 16, marginTop: 2 },
  rarityLabel: { fontSize: 13, fontWeight: '600' },
  noteBox: { backgroundColor: colors.accent + '15', borderRadius: 14, padding: 14, width: '100%', alignItems: 'center', marginTop: 4 },
  noteText: { color: colors.white, fontSize: 14, lineHeight: 20, textAlign: 'center', fontStyle: 'italic' },
  againBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, backgroundColor: colors.accent, marginHorizontal: 20, marginBottom: 16, borderRadius: 16 },
  againText: { color: colors.onAccent, fontSize: 15, fontWeight: '600' },

  log:       { backgroundColor: colors.card, borderRadius: 20, padding: 16, marginHorizontal: 20, borderWidth: 1, borderColor: colors.border },
  logTitle:  { fontSize: 12, fontWeight: '700', color: colors.muted, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.6 },
  logRow:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, gap: 8 },
  logDivider:{ borderBottomWidth: 1, borderBottomColor: colors.border },
  logDot:    { width: 7, height: 7, borderRadius: 3.5 },
  logEmoji:  { fontSize: 16, width: 24 },
  logName:   { flex: 1, fontSize: 14 },
  logMeta:   { fontSize: 12, color: colors.muted, width: 50, textAlign: 'right' },
  logTime:   { fontSize: 11, color: colors.muted, width: 36, textAlign: 'right' },
});
