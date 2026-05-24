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
    desc: 'Лента и комнаты — только для людей с твоим уровнем. Здесь не нужно притворяться.',
  },
  {
    key: '2',
    title: 'Поговори',
    desc: 'Комнаты по уровню, личные переписки и @один — ИИ, который слушает без советов и осуждения.',
  },
  {
    key: '3',
    title: 'Выдохни',
    desc: 'Дыхание, рыбалка, анонимные мысли — когда слов нет. Твои отметки настроения и активность в приложении тоже идут в аналитику.',
  },
  {
    key: '4',
    title: 'Следи за собой',
    desc: 'Тест раз в сутки. Уровень появится после трёх тестов. Отвечай честно — твои ответы видишь только ты, они нужны для точности.',
  },
  {
    key: '5',
    title: 'Работает на тебя',
    desc: 'Из тестов, чекинов и активности мы строим профиль по 8 показателям. Чем больше функций используешь — тем точнее рекомендации, материалы и подсказки.',
  },
];

function SlideVisual1() {
  const posts = [
    { name: 'А', color: '#c0392b', level: 'красный', levelColor: '#c0392b', text: 'сегодня просто не могу заставить себя выйти из дома', likes: 14, comments: 3 },
    { name: 'М', color: '#AA7C00', level: 'жёлтый', levelColor: '#AA7C00', text: 'кто-нибудь ещё чувствует что устал от всего вокруг?', likes: 8, comments: 5 },
  ];
  return (
    <View style={vis.wrap}>
      {posts.map((item, i) => (
        <View key={i} style={vis.card}>
          <View style={[vis.avatar, { backgroundColor: item.color }]}>
            <Text style={vis.avatarText}>{item.name}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <Text style={[vis.cardText, { fontWeight: '700', flex: 0 }]}>аноним</Text>
              <View style={{ backgroundColor: item.levelColor + '22', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 }}>
                <Text style={{ fontSize: 9, color: item.levelColor, fontWeight: '600' }}>{item.level}</Text>
              </View>
            </View>
            <Text style={vis.cardText}>{item.text}</Text>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Ionicons name="heart-outline" size={11} color="#A09080" />
                <Text style={{ fontSize: 10, color: '#A09080' }}>{item.likes}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Ionicons name="chatbubble-outline" size={11} color="#A09080" />
                <Text style={{ fontSize: 10, color: '#A09080' }}>{item.comments}</Text>
              </View>
            </View>
          </View>
        </View>
      ))}
      <View style={[vis.card, { backgroundColor: '#F5F0E8' }]}>
        <Ionicons name="people-outline" size={12} color="#A09080" />
        <Text style={{ fontSize: 11, color: '#A09080', flex: 1, lineHeight: 16 }}>сегодня 24 человека с твоим уровнем заходили</Text>
      </View>
    </View>
  );
}

function SlideVisual2() {
  const rooms = [
    { color: '#5DAA72', label: 'Зелёная', desc: 'держимся', icon: 'leaf-outline' },
    { color: '#AA7C00', label: 'Жёлтая', desc: 'тяжеловато', icon: 'partly-sunny-outline' },
    { color: '#c0392b', label: 'Красная', desc: 'совсем плохо', icon: 'thunderstorm-outline' },
  ];
  return (
    <View style={vis.wrap}>
      <View style={vis.card}>
        <View style={[vis.avatar, { backgroundColor: '#c9a96e' }]}>
          <Text style={[vis.avatarText, { fontSize: 14 }]}>✦</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[vis.cardText, { fontWeight: '700', flex: 0 }]}>@один</Text>
          <View style={{ paddingTop: 6, gap: 5 }}>
            <View style={vis.bubble}>
              <Text style={vis.bubbleText}>как ты сейчас?</Text>
            </View>
            <View style={[vis.bubble, vis.bubbleRight]}>
              <Text style={[vis.bubbleText, { color: '#FFFFFF' }]}>не очень. просто устал</Text>
            </View>
            <View style={vis.bubble}>
              <Text style={vis.bubbleText}>расскажи — я слушаю</Text>
            </View>
          </View>
        </View>
      </View>
      <View style={[vis.card, { flexDirection: 'column', gap: 6 }]}>
        <Text style={[vis.cardText, { color: '#A09080', fontSize: 10, flex: 0 }]}>КОМНАТЫ ПО УРОВНЮ</Text>
        {rooms.map(r => (
          <View key={r.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: r.color + '22', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={r.icon} size={12} color={r.color} />
            </View>
            <Text style={{ fontSize: 11, color: '#2C2420', fontWeight: '600', width: 56 }}>{r.label}</Text>
            <Text style={{ fontSize: 10, color: '#A09080', flex: 1 }}>{r.desc}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function SlideVisual3() {
  return (
    <View style={vis.wrap}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={[vis.card, { flex: 1, flexDirection: 'column', alignItems: 'center', gap: 6 }]}>
          <View style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: '#c9a96e', alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderColor: '#c9a96e88', alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#c9a96e55' }} />
            </View>
          </View>
          <Text style={[vis.cardText, { flex: 0, fontSize: 11, textAlign: 'center' }]}>дыхание{'\n'}4-4-4-4</Text>
        </View>
        <View style={[vis.card, { flex: 1, flexDirection: 'column', alignItems: 'center', gap: 6 }]}>
          <Ionicons name="fish-outline" size={32} color="#c9a96e" />
          <Text style={[vis.cardText, { flex: 0, fontSize: 11, textAlign: 'center' }]}>медита-{'\n'}тивная рыбалка</Text>
        </View>
      </View>
      <View style={[vis.card, { flexDirection: 'column' }]}>
        <Text style={[vis.cardText, { color: '#A09080', fontSize: 10, marginBottom: 6, flex: 0 }]}>АНОНИМНАЯ МЫСЛЬ ДНЯ</Text>
        <Text style={[vis.cardText, { fontStyle: 'italic', marginBottom: 10 }]}>«иногда просто хочется чтобы кто-то спросил как дела»</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {['я понимаю', 'я тоже', 'держись'].map(r => (
            <View key={r} style={{ backgroundColor: '#F0E8D8', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 }}>
              <Text style={{ fontSize: 9, color: '#6B5B4E' }}>{r}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={[vis.card, vis.hint]}>
        <Ionicons name="bar-chart-outline" size={13} color="#8B7355" />
        <Text style={vis.hintText}>
          каждое действие в приложении уточняет твой профиль — тест, чекин, время в чате в 2 ночи. вместе они дают картину точнее, чем один опросник
        </Text>
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
        <Text style={[vis.cardText, { color: '#A09080', fontSize: 10, marginBottom: 8, flex: 0 }]}>ИСТОРИЯ УРОВНЕЙ — ПОСЛЕ 3 ТЕСТОВ</Text>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 48, gap: 4 }}>
          {bars.map((b, i) => (
            <View key={i} style={{ flex: 1, height: `${b.h}%`, backgroundColor: b.color, borderRadius: 4 }} />
          ))}
        </View>
      </View>
      <View style={[vis.card, { justifyContent: 'space-between' }]}>
        <View>
          <Text style={[vis.cardText, { color: '#A09080', fontSize: 10, flex: 0 }]}>сейчас</Text>
          <Text style={[vis.cardText, { fontWeight: '700', color: '#AA7C00', flex: 0 }]}>жёлтый</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[vis.cardText, { color: '#A09080', fontSize: 10, flex: 0 }]}>динамика</Text>
          <Text style={[vis.cardText, { fontWeight: '700', color: '#5DAA72', flex: 0 }]}>↑ лучше</Text>
        </View>
      </View>
      <View style={[vis.card, vis.hint]}>
        <Ionicons name="lock-closed-outline" size={13} color="#8B7355" />
        <Text style={vis.hintText}>
          мы используем GAD-7, PSS-4, OLBI и другие клинические инструменты. твои ответы зашифрованы — мы их не продаём и не передаём
        </Text>
      </View>
    </View>
  );
}

function SlideVisual5() {
  const dims = [
    { label: 'тревога', value: 62, color: '#c0392b' },
    { label: 'стресс', value: 45, color: '#AA7C00' },
    { label: 'апатия', value: 28, color: '#5DAA72' },
    { label: 'одиночество', value: 55, color: '#AA7C00' },
  ];
  const sources = [
    { icon: 'clipboard-outline', label: 'тесты' },
    { icon: 'sunny-outline', label: 'чекины' },
    { icon: 'chatbubble-outline', label: 'активность' },
  ];
  return (
    <View style={vis.wrap}>
      {/* Схема: откуда берутся данные */}
      <View style={[vis.card, { flexDirection: 'column', gap: 8 }]}>
        <Text style={[vis.cardText, { color: '#A09080', fontSize: 10, flex: 0 }]}>КАК ЭТО РАБОТАЕТ</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-evenly' }}>
            {sources.map((s, i) => (
              <View key={i} style={{ alignItems: 'center', gap: 4 }}>
                <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: '#F0E8D8', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={s.icon} size={15} color="#8B7355" />
                </View>
                <Text style={{ fontSize: 9, color: '#6B5B4E' }}>{s.label}</Text>
              </View>
            ))}
          </View>
          <Ionicons name="arrow-forward" size={14} color="#C0A882" />
          <View style={{ alignItems: 'center', gap: 4 }}>
            <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: '#c9a96e22', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="person-outline" size={15} color="#c9a96e" />
            </View>
            <Text style={{ fontSize: 9, color: '#6B5B4E' }}>профиль</Text>
          </View>
        </View>
      </View>
      {/* Профиль по измерениям */}
      <View style={[vis.card, { flexDirection: 'column' }]}>
        <Text style={[vis.cardText, { color: '#A09080', fontSize: 10, marginBottom: 6, flex: 0 }]}>8 ПОКАЗАТЕЛЕЙ СОСТОЯНИЯ</Text>
        {dims.map(d => (
          <View key={d.label} style={{ marginBottom: 5 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
              <Text style={{ fontSize: 10, color: '#6B5B4E' }}>{d.label}</Text>
              <Text style={{ fontSize: 10, color: d.color, fontWeight: '600' }}>{d.value}</Text>
            </View>
            <View style={{ height: 4, backgroundColor: '#F0E8D8', borderRadius: 2 }}>
              <View style={{ height: 4, width: `${d.value}%`, backgroundColor: d.color, borderRadius: 2 }} />
            </View>
          </View>
        ))}
      </View>
      <View style={[vis.card, vis.hint]}>
        <Ionicons name="trending-up-outline" size={13} color="#8B7355" />
        <Text style={vis.hintText}>
          это не трекер настроения. 8 клинических показателей — тревога, стресс, выгорание и ещё пять. точнее любого теста «как ты сейчас?»
        </Text>
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
    paddingVertical: 6,
    paddingHorizontal: 10,
    maxWidth: '85%',
  },
  bubbleRight: {
    alignSelf: 'flex-end',
    backgroundColor: '#c9a96e',
  },
  bubbleText: { fontSize: 12, color: '#2C2420', lineHeight: 17 },
  hint: {
    backgroundColor: '#EDE8DF',
    borderColor: '#D4C9B8',
  },
  hintText: {
    fontSize: 12,
    color: '#3D2E26',
    flex: 1,
    lineHeight: 18,
    fontWeight: '500',
  },
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

  const goPrev = () => {
    if (current > 0) {
      const prev = current - 1;
      flatRef.current?.scrollToIndex({ index: prev, animated: true });
      setCurrent(prev);
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
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.desc}>{item.desc}</Text>
          <View style={styles.footer}>
            <View style={styles.footerSide}>
              {index > 0 && (
                <TouchableOpacity style={styles.btnBack} onPress={goPrev} activeOpacity={0.75}>
                  <Text style={styles.btnBackText}>← назад</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.dots}>
              {SLIDES.map((_, i) => (
                <View key={i} style={[styles.dot, i === current && styles.dotActive]} />
              ))}
            </View>
            <View style={[styles.footerSide, { alignItems: 'flex-end' }]}>
              <TouchableOpacity style={styles.btn} onPress={goNext} activeOpacity={0.75}>
                <Text style={styles.btnText}>{isLast ? 'начать' : 'дальше →'}</Text>
              </TouchableOpacity>
            </View>
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
  title: { fontSize: 22, fontWeight: '700', color: '#2C2420', marginBottom: 8 },
  desc: { fontSize: 14, color: '#6B5B4E', lineHeight: 21, marginBottom: 20 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerSide: { flex: 1 },
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
  btnBack: { paddingVertical: 10, paddingHorizontal: 4 },
  btnBackText: { color: '#A09080', fontSize: 14 },
});
