import { useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';

function getStreakMessage(n) {
  if (n === 1) return 'Начало положено';
  if (n < 4)  return `${n} дня подряд — хороший старт`;
  if (n < 7)  return `${n} дней подряд. Ты остаёшься`;
  if (n < 14) return 'Целая неделя. Это важнее, чем кажется';
  if (n < 30) return `${n} дней. Ты уже часть этого места`;
  return `${n} дней. Это не случайность`;
}

function getStreakSub(n) {
  if (n === 1) return 'Приходи завтра — и будет уже два дня подряд';
  if (n < 4)  return 'Каждый день на счету';
  if (n < 7)  return 'Люди замечают, что ты здесь';
  if (n < 14) return 'Семь дней — это уже привычка';
  if (n < 30) return 'Ты один из тех кто не бросает';
  return 'Месяц. Серьёзно, это редкость';
}

export default function StreakModal({ streak, visible, onClose }) {
  const scale = useRef(new Animated.Value(0.7)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 80, friction: 7 }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      scale.setValue(0.7);
      opacity.setValue(0);
    }
  }, [visible]);

  if (!visible) return null;

  const flameColor = streak >= 7 ? '#F59E0B' : streak >= 3 ? '#F97316' : colors.accent;

  return (
    <Modal transparent animationType="none" visible={visible} onRequestClose={onClose}>
      <Animated.View style={[styles.backdrop, { opacity }]}>
        <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
          <View style={[styles.iconWrap, { backgroundColor: flameColor + '18' }]}>
            <Ionicons name="flame" size={52} color={flameColor} />
          </View>

          <Text style={[styles.streakNum, { color: flameColor }]}>{streak}</Text>
          <Text style={styles.streakUnit}>дней подряд</Text>
          <Text style={styles.title}>{getStreakMessage(streak)}</Text>
          <Text style={styles.sub}>{getStreakSub(streak)}</Text>

          <TouchableOpacity style={[styles.btn, { backgroundColor: flameColor }]} onPress={onClose} activeOpacity={0.85}>
            <Text style={styles.btnText}>Продолжай</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(44,36,32,0.55)',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 32,
  },
  card: {
    width: '100%', backgroundColor: colors.card,
    borderRadius: 28, paddingVertical: 36, paddingHorizontal: 28,
    alignItems: 'center', gap: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18, shadowRadius: 24, elevation: 16,
  },
  iconWrap: {
    width: 88, height: 88, borderRadius: 44,
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  streakNum: {
    fontSize: 64, fontWeight: '800', lineHeight: 68,
  },
  streakUnit: {
    fontSize: 16, color: colors.muted, fontWeight: '600', marginBottom: 10,
  },
  title: {
    fontSize: 20, fontWeight: '700', color: colors.white,
    textAlign: 'center', lineHeight: 26,
  },
  sub: {
    fontSize: 14, color: colors.muted, textAlign: 'center',
    lineHeight: 20, marginBottom: 8,
  },
  btn: {
    marginTop: 16, borderRadius: 16,
    paddingVertical: 14, paddingHorizontal: 40,
    alignSelf: 'stretch', alignItems: 'center',
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
