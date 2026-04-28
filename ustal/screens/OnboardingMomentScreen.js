import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../supabase';
import { store } from '../store';
import { LEVEL_COLORS, LEVEL_DATA, DAILY_QUESTIONS } from '../constants';
import { colors } from '../theme';

function getTodayDate() {
  return new Date().toISOString().split('T')[0];
}

function getTodayQuestion() {
  const start = new Date('2024-01-01');
  const diff = Math.floor((Date.now() - start.getTime()) / 86400000);
  return DAILY_QUESTIONS[diff % DAILY_QUESTIONS.length];
}

export default function OnboardingMomentScreen({ route, navigation }) {
  const { level } = route.params;
  const insets = useSafeAreaInsets();
  const lvlColor = LEVEL_COLORS[level] || colors.accent;
  const lvlData = LEVEL_DATA[level] || {};

  const [loading, setLoading] = useState(true);
  const [sameCount, setSameCount] = useState(0);
  const [randomAnswer, setRandomAnswer] = useState(null);

  useEffect(() => {
    const load = async () => {
      const { count } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('level', level);
      setSameCount(count || 0);

      const { data: sameLevel } = await supabase
        .from('users')
        .select('user_id')
        .eq('level', level)
        .neq('user_id', store.userId);

      const ids = (sameLevel || []).map(u => u.user_id);
      if (ids.length > 0) {
        const { data: answers } = await supabase
          .from('daily_answers')
          .select('answer')
          .eq('question_date', getTodayDate())
          .in('user_id', ids)
          .limit(20);
        if (answers && answers.length > 0) {
          const pick = answers[Math.floor(Math.random() * answers.length)];
          setRandomAnswer(pick.answer);
        }
      }
      setLoading(false);
    };
    load();
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
      {loading ? (
        <ActivityIndicator color={lvlColor} size="large" />
      ) : (
        <View style={styles.content}>
          <View style={[styles.iconWrap, { backgroundColor: lvlColor + '22' }]}>
            <Ionicons name={lvlData.icon || 'people-outline'} size={36} color={lvlColor} />
          </View>

          <Text style={styles.headline}>Ты не один</Text>

          <Text style={styles.countText}>
            Сегодня{' '}
            <Text style={[styles.countNumber, { color: lvlColor }]}>{sameCount}</Text>
            {' '}человек{'\n'}чувствуют то же что ты
          </Text>

          {randomAnswer && (
            <View style={[styles.quoteCard, { borderLeftColor: lvlColor }]}>
              <Text style={styles.quoteLabel}>Кто-то с твоим уровнем написал сегодня</Text>
              <Text style={styles.quoteText}>«{randomAnswer}»</Text>
            </View>
          )}

          <View style={styles.spacer} />

          <TouchableOpacity
            style={[styles.btn, { backgroundColor: lvlColor }]}
            onPress={() => navigation.replace('Recommendations', { level })}
          >
            <Text style={styles.btnText}>Дальше</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', width: '100%' },
  iconWrap: {
    width: 72, height: 72, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center', marginBottom: 28,
  },
  headline: {
    fontSize: 32, fontWeight: 'bold', color: colors.white,
    marginBottom: 16, textAlign: 'center',
  },
  countText: {
    fontSize: 18, color: colors.muted, textAlign: 'center',
    lineHeight: 28, marginBottom: 32,
  },
  countNumber: { fontWeight: 'bold', fontSize: 22 },
  quoteCard: {
    backgroundColor: colors.card, borderRadius: 14,
    padding: 16, borderLeftWidth: 3, width: '100%', marginBottom: 24,
  },
  quoteLabel: { fontSize: 11, color: colors.muted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
  quoteText: { fontSize: 15, color: colors.white, fontStyle: 'italic', lineHeight: 22 },
  spacer: { flex: 1 },
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, width: '100%', paddingVertical: 16, borderRadius: 16,
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
