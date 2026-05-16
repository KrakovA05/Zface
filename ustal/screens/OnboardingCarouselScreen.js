import { useRef, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, Dimensions, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../supabase';
import { store } from '../store';
import { colors } from '../theme';

const SLIDES = [
  {
    key: '1',
    title: 'Найди своих',
    desc: 'Лента и комнаты — только для людей с твоим уровнем. Здесь не притворяются.',
  },
  {
    key: '2',
    title: 'Поговори',
    desc: 'Комнаты по уровню, глобальный чат и @один — ИИ, который просто слушает.',
  },
  {
    key: '3',
    title: 'Выдохни',
    desc: 'Коробочное дыхание, медитативная рыбалка и анонимные мысли — когда слов нет.',
  },
  {
    key: '4',
    title: 'Следи за собой',
    desc: 'Тест раз в сутки определяет твой уровень. Динамика видна — становится лучше или хуже.',
  },
  {
    key: '5',
    title: 'Приложение учится вместе с тобой',
    desc: 'Мы анализируем твою активность — и подстраиваем рекомендации, контент и подсказки именно под тебя.',
  },
];

function SlideVisual1() {
  return (
    <View style={vis.wrap}>
      {[
        { name: 'А', color: '#c9a96e', text: 'сегодня просто не могу заставить себя выйти из дома' },
        { name: 'М', color: '#AA7C00', text: 'кто-нибудь ещё чувствует что устал от всего' },
      ].map((item, i) => (
        <View key={i} style={vis.card}>
          <View style={[vis.avatar, { backgroundColor: item.color }]}>
            <Text style={vis.avatarText}>{item.name}</Text>
          </View>
          <Text style={vis.cardText}>{item.text}</Text>
        </View>
      ))}
    </View>
  );
}

function SlideVisual2() {
  return (
    <View style={vis.wrap}>
      <View style={vis.card}>
        <View style={[vis.avatar, { backgroundColor: '#c9a96e' }]}>
          <Text style={[vis.avatarText, { fontSize: 14 }]}>✦</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[vis.cardText, { fontWeight: '700' }]}>@один</Text>
          <Text style={[vis.cardText, { color: colors.muted, fontSize: 11 }]}>я здесь каждый день</Text>
        </View>
      </View>
      <View style={{ paddingHorizontal: 12, gap: 6 }}>
        <View style={vis.bubble}>
          <Text style={vis.bubbleText}>как ты сейчас?</Text>
        </View>
        <View style={[vis.bubble, vis.bubbleRight]}>
          <Text style={[vis.bubbleText, { color: '#FFFFFF' }]}>не очень. просто устал</Text>
        </View>
      </View>
    </View>
  );
}

function SlideVisual3() {
  return (
    <View style={vis.wrap}>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
        <View style={[vis.card, { flex: 1, alignItems: 'center', flexDirection: 'column' }]}>
          <Ionicons name="radio-button-on-outline" size={28} color={colors.accent} />
          <Text style={[vis.cardText, { marginTop: 4, flex: 0 }]}>дыхание</Text>
        </View>
        <View style={[vis.card, { flex: 1, alignItems: 'center', flexDirection: 'column' }]}>
          <Ionicons name="fish-outline" size={28} color={colors.accent} />
          <Text style={[vis.cardText, { marginTop: 4, flex: 0 }]}>рыбалка</Text>
        </View>
      </View>
      <View style={[vis.card, { flexDirection: 'column' }]}>
        <Text style={[vis.cardText, { color: colors.muted, fontSize: 10, marginBottom: 4, flex: 0 }]}>АНОНИМНАЯ МЫСЛЬ ДНЯ</Text>
        <Text style={[vis.cardText, { fontStyle: 'italic' }]}>«иногда просто хочется чтобы кто-то спросил как дела»</Text>
      </View>
    </View>
  );
}

function SlideVisual4() {
  const bars = [
    { h: 30, color: '#5DAA72' },
    { h: 60, color: '#AA7C00' },
    { h: 70, color: '#AA7C00' },
    { h: 100, color: '#c0392b' },
    { h: 90, color: '#c0392b' },
    { h: 65, color: '#AA7C00' },
    { h: 55, color: '#AA7C00' },
  ];
  return (
    <View style={vis.wrap}>
      <View style={[vis.card, { flexDirection: 'column' }]}>
        <Text style={[vis.cardText, { color: colors.muted, fontSize: 10, marginBottom: 8, flex: 0 }]}>ИСТОРИЯ УРОВНЕЙ</Text>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 48, gap: 4 }}>
          {bars.map((b, i) => (
            <View key={i} style={{ flex: 1, height: `${b.h}%`, backgroundColor: b.color, borderRadius: 4 }} />
          ))}
        </View>
      </View>
      <View style={[vis.card, { justifyContent: 'space-between' }]}>
        <View>
          <Text style={[vis.cardText, { color: colors.muted, fontSize: 10, flex: 0 }]}>сейчас</Text>
          <Text style={[vis.cardText, { fontWeight: '700', color: '#AA7C00', flex: 0 }]}>жёлтый</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[vis.cardText, { color: colors.muted, fontSize: 10, flex: 0 }]}>динамика</Text>
          <Text style={[vis.cardText, { fontWeight: '700', color: '#5DAA72', flex: 0 }]}>↑ лучше</Text>
        </View>
      </View>
    </View>
  );
}

function SlideVisual5() {
  return (
    <View style={vis.wrap}>
      <View style={[vis.card, { flexDirection: 'column' }]}>
        <Text style={[vis.cardText, { color: colors.muted, fontSize: 10, marginBottom: 8, flex: 0 }]}>ДЛЯ ТЕБЯ СЕЙЧАС</Text>
        {[1, 2, 3].map(i => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent }} />
            <View style={{ height: 8, backgroundColor: '#F0E8D8', borderRadius: 4, width: `${90 - i * 10}%` }} />
          </View>
        ))}
      </View>
      <View style={[vis.card, { flexDirection: 'column' }]}>
        <Text style={[vis.cardText, { color: colors.muted, fontSize: 10, marginBottom: 4, flex: 0 }]}>@один знает что тебе нужно</Text>
        <Text style={vis.cardText}>Твои паттерны → персональные советы и контент</Text>
      </View>
    </View>
  );
}

const VISUALS = [SlideVisual1, SlideVisual2, SlideVisual3, SlideVisual4, SlideVisual5];

const vis = StyleSheet.create({
  wrap: { padding: 12, gap: 8 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E8DFD0',
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  avatar: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  cardText: { fontSize: 12, color: '#2C2420', lineHeight: 17, flex: 1 },
  bubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#F0E8D8',
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    maxWidth: '80%',
  },
  bubbleRight: {
    alignSelf: 'flex-end',
    backgroundColor: '#c9a96e',
  },
  bubbleText: { fontSize: 12, color: '#2C2420', lineHeight: 17 },
});

export default function OnboardingCarouselScreen({ navigation }) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const flatRef = useRef(null);
  const [current, setCurrent] = useState(0);

  const goNext = async () => {
    if (current < SLIDES.length - 1) {
      const next = current + 1;
      flatRef.current?.scrollToIndex({ index: next, animated: true });
      setCurrent(next);
    } else {
      await supabase
        .from('users')
        .update({ onboarding_seen: true })
        .eq('user_id', store.userId);
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.replace('Main');
      }
    }
  };

  const renderSlide = ({ item, index }) => {
    const Visual = VISUALS[index];
    const isLast = index === SLIDES.length - 1;
    return (
      <View style={[styles.slide, { width }]}>
        <View style={styles.visualArea}>
          <Visual />
        </View>
        <View style={[styles.textArea, { paddingBottom: insets.bottom + 16 }]}>
          <Text style={styles.slideNum}>{String(index + 1).padStart(2, '0')} / {SLIDES.length}</Text>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.desc}>{item.desc}</Text>
          <View style={styles.footer}>
            <View style={styles.dots}>
              {SLIDES.map((_, i) => (
                <View key={i} style={[styles.dot, i === current && styles.dotActive]} />
              ))}
            </View>
            <TouchableOpacity style={styles.btn} onPress={goNext} activeOpacity={0.75}>
              <Text style={styles.btnText}>{isLast ? 'начать' : 'дальше →'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatRef}
        data={SLIDES}
        keyExtractor={item => item.key}
        renderItem={renderSlide}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        getItemLayout={(_, index) => ({
          length: Dimensions.get('window').width,
          offset: Dimensions.get('window').width * index,
          index,
        })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF7F2' },
  slide: { flex: 1 },
  visualArea: {
    flex: 1,
    backgroundColor: '#FAF7F2',
    justifyContent: 'center',
  },
  textArea: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 20,
    shadowColor: '#8B7B6B',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  slideNum: { fontSize: 11, color: '#C0A882', fontWeight: '600', marginBottom: 6, letterSpacing: 0.5 },
  title: { fontSize: 22, fontWeight: '700', color: '#2C2420', marginBottom: 8 },
  desc: { fontSize: 14, color: '#6B5B4E', lineHeight: 21, marginBottom: 20 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dots: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#E8DFD0' },
  dotActive: { width: 20, backgroundColor: '#8B7355' },
  btn: {
    backgroundColor: '#8B7355',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  btnText: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },
});
