import { StyleSheet, Text, View, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../supabase';
import { store } from '../store';
import { LEVEL_COLORS } from '../constants';
import { colors } from '../theme';

const LEVEL_ICONS = { green: 'leaf-outline', yellow: 'partly-sunny-outline', red: 'flame-outline' };
const LEVEL_NAMES = { green: 'Зелёный', yellow: 'Жёлтый', red: 'Красный' };

const RECOMMENDATIONS = {
  green: {
    todo: [
      'Поделись хорошим настроением — напиши в общий чат',
      'Прогуляйся сегодня хотя бы 20 минут',
      'Почитай что-нибудь для удовольствия',
      'Попробуй 5 минут медитации перед сном',
    ],
    avoid: [
      'Не листай соцсети бездумно больше часа',
      'Не злоупотребляй кофеином после 15:00',
    ],
    challenges: [
      'Поддержи кого-нибудь в чате сегодня',
      '3 дня подряд без жалоб',
      'Сделай одно дело, которое откладывал',
    ],
    activities: [
      { icon: 'sync-outline',        label: 'Дыхание',     route: 'Breathing' },
      { icon: 'fish-outline',        label: 'Рыбалка',     route: 'Fishing'   },
      { icon: 'wine-outline',        label: 'Бар',         route: 'Bar'       },
      { icon: 'chatbubbles-outline', label: 'Общий чат',   route: 'Chat'      },
    ],
  },
  yellow: {
    todo: [
      'Сделай 5 глубоких вдохов прямо сейчас',
      'Выпей стакан воды — возможно, ты просто обезвожен',
      'Ляг спать сегодня не позже 23:00',
      'Запиши 3 вещи, за которые ты благодарен',
    ],
    avoid: [
      'Не бери на себя новые обязательства сегодня',
      'Не вступай в споры в интернете',
      'Избегай фастфуда — он усиливает тревогу',
    ],
    challenges: [
      'Поспи 8 часов сегодня',
      'Час без телефона вечером',
      'Подышать 10 минут по технике 4-4-4-4',
    ],
    activities: [
      { icon: 'sync-outline',  label: 'Дыхание', route: 'Breathing' },
      { icon: 'fish-outline',  label: 'Рыбалка', route: 'Fishing'   },
      { icon: 'grid-outline',  label: 'Комнаты', route: 'Rooms'     },
    ],
  },
  red: {
    todo: [
      'Ты не один — зайди в чат к людям с похожим статусом',
      'Просто полежи 10 минут в тишине',
      'Позвони кому-то близкому сегодня',
      'Сделай себе тёплый напиток прямо сейчас',
    ],
    avoid: [
      'Не принимай важных решений в таком состоянии',
      'Избегай алкоголя — он усугубит состояние',
      'Не изолируй себя — хотя бы зайди в чат',
      'Не работай сверхурочно сегодня',
    ],
    challenges: [
      'Выйди на свежий воздух на 10 минут',
      'Напиши хоть одно сообщение в чат',
      'Лечь спать до 22:00',
    ],
    activities: [
      { icon: 'sync-outline', label: 'Дыхание', route: 'Breathing' },
      { icon: 'fish-outline', label: 'Рыбалка', route: 'Fishing'   },
      { icon: 'grid-outline', label: 'Комнаты', route: 'Rooms'     },
    ],
  },
};

function getDynamicMessage(history, currentLevel) {
  if (history.length < 2) return null;
  const prev = history[1]?.level;
  const order = { green: 0, yellow: 1, red: 2 };
  if (order[currentLevel] < order[prev]) return { text: 'Состояние улучшилось с прошлого раза', color: '#4CAF50', icon: 'trending-up-outline' };
  if (order[currentLevel] > order[prev]) return { text: 'Состояние ухудшилось. Отнесись к себе бережно.', color: '#F44336', icon: 'trending-down-outline' };
  return { text: 'Состояние стабильное — держись в этом ритме.', color: '#FFC107', icon: 'remove-outline' };
}

function Section({ icon, title, items, dotColor }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Ionicons name={icon} size={15} color={dotColor} />
        <Text style={[styles.sectionTitle, { color: dotColor }]}>{title}</Text>
      </View>
      {items.map((item, i) => (
        <View key={i} style={styles.item}>
          <View style={[styles.itemDot, { backgroundColor: dotColor }]} />
          <Text style={styles.itemText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

export default function RecommendationsScreen({ navigation, route }) {
  const level = route.params?.level || store.level || 'green';
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('test_results')
          .select('level, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5);
        setHistory(data || []);
      }
      setLoading(false);
    };
    load();
  }, []);

  const rec      = RECOMMENDATIONS[level];
  const lvlColor = LEVEL_COLORS[level];
  const dynamic  = getDynamicMessage(history, level);

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.safeArea}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        {/* Шапка */}
        <View style={styles.hero}>
          <View style={[styles.heroIcon, { backgroundColor: lvlColor + '22' }]}>
            <Ionicons name={LEVEL_ICONS[level]} size={28} color={lvlColor} />
          </View>
          <Text style={styles.heroSub}>Рекомендации</Text>
          <Text style={[styles.heroLevel, { color: lvlColor }]}>{LEVEL_NAMES[level]}</Text>
        </View>

        {/* Динамика */}
        {dynamic && (
          <View style={[styles.dynamicCard, { borderColor: dynamic.color + '44' }]}>
            <Ionicons name={dynamic.icon} size={18} color={dynamic.color} />
            <Text style={[styles.dynamicText, { color: dynamic.color }]}>{dynamic.text}</Text>
          </View>
        )}

        <Section icon="checkmark-circle-outline" title="Что сделать сегодня" items={rec.todo}       dotColor={lvlColor} />
        <Section icon="close-circle-outline"     title="Что не делать"      items={rec.avoid}      dotColor={colors.muted} />
        <Section icon="trophy-outline"           title="Челленджи"          items={rec.challenges}  dotColor={lvlColor} />

        {/* Активности */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="apps-outline" size={15} color={colors.muted} />
            <Text style={[styles.sectionTitle, { color: colors.muted }]}>Активности</Text>
          </View>
          <View style={styles.activitiesRow}>
            {rec.activities.map((a, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.activityChip, { borderColor: lvlColor + '44' }]}
                onPress={() => navigation.navigate(a.route)}
                activeOpacity={0.7}
              >
                <Ionicons name={a.icon} size={16} color={lvlColor} />
                <Text style={[styles.activityText, { color: lvlColor }]}>{a.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.homeBtn, { backgroundColor: lvlColor }]}
          onPress={() => navigation.navigate('Main')}
          activeOpacity={0.8}
        >
          <Text style={styles.homeBtnText}>Войти в приложение</Text>
          <Ionicons name="arrow-forward" size={18} color="#fff" />
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  loader:   { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  scroll:   { flex: 1 },
  content:  { padding: 24, paddingBottom: 40 },

  hero: { alignItems: 'center', marginBottom: 24, gap: 6 },
  heroIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  heroSub:  { fontSize: 13, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.8 },
  heroLevel:{ fontSize: 22, fontWeight: 'bold' },

  dynamicCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderRadius: 14,
    padding: 14, marginBottom: 24, backgroundColor: colors.card,
  },
  dynamicText: { flex: 1, fontSize: 14, fontWeight: '600', lineHeight: 20 },

  section:       { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  sectionTitle:  { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },

  item:    { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10, gap: 10 },
  itemDot: { width: 6, height: 6, borderRadius: 3, marginTop: 8, flexShrink: 0 },
  itemText:{ color: colors.white, fontSize: 15, lineHeight: 22, flex: 1 },

  activitiesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  activityChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 9,
    backgroundColor: colors.card,
  },
  activityText: { fontSize: 13, fontWeight: '500' },

  homeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: 14, paddingVertical: 16, marginTop: 8,
  },
  homeBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
