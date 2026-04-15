import { StyleSheet, Text, View, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';
import { store } from '../store';
import { LEVEL_DATA, LEVEL_COLORS } from '../constants';
import { colors } from '../theme';

const RECOMMENDATIONS = {
  green: {
    todo: [
      '☀️ Поделись хорошим настроением — напиши в общий чат',
      '🚶 Прогуляйся сегодня хотя бы 20 минут',
      '📖 Почитай что-нибудь для удовольствия',
      '🧘 Попробуй 5 минут медитации перед сном',
    ],
    avoid: [
      '📱 Не листай соцсети бездумно больше часа',
      '☕ Не злоупотребляй кофеином после 15:00',
    ],
    challenges: [
      '💬 Поддержи кого-нибудь в чате сегодня',
      '🌿 3 дня подряд без жалоб',
      '🎯 Сделай одно дело, которое откладывал',
    ],
    activities: ['🎧 Релакс-зона', '🎣 Рыбалка', '🍸 Онлайн-бар', '💬 Общий чат'],
  },
  yellow: {
    todo: [
      '🌬️ Сделай 5 глубоких вдохов прямо сейчас',
      '💧 Выпей стакан воды — возможно, ты просто обезвожен',
      '🛌 Ляг спать сегодня не позже 23:00',
      '📝 Запиши 3 вещи, за которые ты благодарен',
    ],
    avoid: [
      '🔥 Не бери на себя новые обязательства сегодня',
      '😤 Не вступай в споры в интернете',
      '🍔 Избегай фастфуда — он усиливает тревогу',
    ],
    challenges: [
      '😴 Поспи 8 часов сегодня',
      '📵 Час без телефона вечером',
      '🧘 Послушай расслабляющие звуки 10 минут',
    ],
    activities: ['🎧 Релакс-зона', '🎣 Рыбалка', '💬 Комнаты по статусу'],
  },
  red: {
    todo: [
      '🫂 Ты не один — зайди в чат к людям с похожим статусом',
      '🌊 Включи звуки природы и просто полежи 10 минут',
      '📞 Позвони кому-то близкому сегодня',
      '🍵 Сделай себе тёплый напиток прямо сейчас',
    ],
    avoid: [
      '🚫 Не принимай важных решений в таком состоянии',
      '🍷 Избегай алкоголя — он усугубит состояние',
      '👥 Не изолируй себя — хотя бы зайди в чат',
      '💻 Не работай сверхурочно сегодня',
    ],
    challenges: [
      '🌅 Выйди на свежий воздух на 10 минут',
      '💬 Напиши хоть одно сообщение в чат',
      '😴 Лечь спать до 22:00',
    ],
    activities: ['🎧 Релакс-зона', '🎣 Рыбалка (очень помогает)', '👥 Комнаты с похожими'],
  },
};

function getDynamicMessage(history, currentLevel) {
  if (history.length < 2) return null;
  const prev = history[1]?.level;
  const curr = currentLevel;
  const order = { green: 0, yellow: 1, red: 2 };
  if (order[curr] < order[prev]) return { text: '📈 Твоё состояние улучшилось с прошлого раза!', color: '#4CAF50' };
  if (order[curr] > order[prev]) return { text: '📉 Состояние ухудшилось. Отнесись к себе бережно.', color: '#F44336' };
  return { text: '〰️ Состояние стабильное — держись в этом ритме.', color: '#FFC107' };
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

  const rec = RECOMMENDATIONS[level];
  const lvlData = LEVEL_DATA[level];
  const lvlColor = LEVEL_COLORS[level];
  const dynamic = getDynamicMessage(history, level);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={[styles.header, { borderLeftColor: lvlColor }]}>
          <Text style={styles.headerEmoji}>{lvlData.emoji}</Text>
          <View>
            <Text style={styles.headerTitle}>Рекомендации</Text>
            <Text style={[styles.headerLevel, { color: lvlColor }]}>{lvlData.label}</Text>
          </View>
        </View>

        {dynamic && (
          <View style={[styles.dynamicCard, { borderColor: dynamic.color }]}>
            <Text style={[styles.dynamicText, { color: dynamic.color }]}>{dynamic.text}</Text>
          </View>
        )}

        <Section title="✅ Что сделать сегодня" items={rec.todo} color={lvlColor} />
        <Section title="🚫 Что не делать" items={rec.avoid} color={colors.muted} />
        <Section title="🎯 Челленджи" items={rec.challenges} color={lvlColor} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🎮 Активности для тебя</Text>
          <View style={styles.activitiesRow}>
            {rec.activities.map((a, i) => (
              <View key={i} style={[styles.activityChip, { borderColor: lvlColor }]}>
                <Text style={styles.activityText}>{a}</Text>
              </View>
            ))}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.homeButton, { backgroundColor: lvlColor }]}
          onPress={() => navigation.navigate('Main')}
        >
          <Text style={styles.homeButtonText}>Войти в приложение →</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, items, color }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {items.map((item, i) => (
        <View key={i} style={styles.item}>
          <View style={[styles.itemDot, { backgroundColor: color }]} />
          <Text style={styles.itemText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  content: { padding: 24, paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderLeftWidth: 4,
    paddingLeft: 16,
    marginBottom: 24,
  },
  headerEmoji: { fontSize: 40 },
  headerTitle: { fontSize: 14, color: colors.muted, marginBottom: 2 },
  headerLevel: { fontSize: 22, fontWeight: 'bold' },
  dynamicCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
    backgroundColor: colors.card,
  },
  dynamicText: { fontSize: 15, fontWeight: '600' },
  section: { marginBottom: 28 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.white,
    marginBottom: 14,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
    gap: 10,
  },
  itemDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
    flexShrink: 0,
  },
  itemText: { color: colors.white, fontSize: 15, lineHeight: 22, flex: 1 },
  activitiesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  activityChip: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.card,
  },
  activityText: { color: colors.white, fontSize: 13 },
  homeButton: {
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    marginTop: 8,
  },
  homeButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
