import { StyleSheet, Text, View, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../supabase';
import { store } from '../store';
import { ACHIEVEMENT_GROUPS, ACHIEVEMENTS } from '../constants';
import { colors } from '../theme';
import { showAlert } from '../utils/alert';

function calcDateStreak(rows, dateField) {
  if (!rows || rows.length === 0) return 0;
  const dates = [...new Set(rows.map(r => r[dateField]))].sort().reverse();
  let streak = 0;
  const cur = new Date();
  cur.setHours(0, 0, 0, 0);
  for (const d of dates) {
    const expected = [
      cur.getFullYear(),
      String(cur.getMonth() + 1).padStart(2, '0'),
      String(cur.getDate()).padStart(2, '0'),
    ].join('-');
    if (d === expected) { streak++; cur.setDate(cur.getDate() - 1); }
    else break;
  }
  return streak;
}

function ProgressCard({ label, current, target, icon }) {
  const pct = Math.min(current / Math.max(target, 1), 1);
  return (
    <View style={styles.progressCard}>
      <Ionicons name={icon} size={15} color={colors.accent} />
      <View style={{ flex: 1 }}>
        <View style={styles.progressCardHeader}>
          <Text style={styles.progressCardLabel}>{label}</Text>
          <Text style={styles.progressCardCount}>{Math.min(current, target)}/{target}</Text>
        </View>
        <View style={styles.progressCardBar}>
          <View style={[styles.progressCardFill, { width: `${pct * 100}%` }]} />
        </View>
      </View>
    </View>
  );
}

export default function AchievementsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [earnedIds, setEarnedIds] = useState(new Set());
  const [progressData, setProgressData] = useState({ dailyStreak: 0, dailyStreakTarget: 7, checkinStreak: 0, psychCount: 0 });

  useFocusEffect(useCallback(() => {
    load();
  }, []));

  const load = async () => {
    setLoading(true);
    const uid = store.userId;
    if (!uid) { setLoading(false); return; }

    const thirtyAgo = new Date();
    thirtyAgo.setDate(thirtyAgo.getDate() - 30);
    const thirtyAgoStr = thirtyAgo.toISOString().split('T')[0];

    const [
      { data: existing },
      { data: dailyAnswers },
      { data: checkinData },
      { data: psychResults },
    ] = await Promise.all([
      supabase.from('user_achievements').select('achievement_id').eq('user_id', uid),
      supabase.from('daily_answers').select('question_date').eq('user_id', uid).order('question_date', { ascending: false }).limit(35),
      supabase.from('mood_checkins').select('checkin_date').eq('user_id', uid).gte('checkin_date', thirtyAgoStr),
      supabase.from('psych_test_results').select('test_id').eq('user_id', uid),
    ]);

    const ids = new Set((existing || []).map(e => e.achievement_id));
    setEarnedIds(ids);

    const dailyStreak = calcDateStreak(dailyAnswers, 'question_date');
    const checkinStreak = calcDateStreak(checkinData, 'checkin_date');
    const psychCount = new Set((psychResults || []).map(r => r.test_id)).size;

    setProgressData({
      dailyStreak,
      dailyStreakTarget: ids.has('daily_7') ? 30 : 7,
      checkinStreak,
      psychCount,
    });
    setLoading(false);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.title}>Достижения</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Общий прогресс */}
          <View style={styles.totalRow}>
            <Text style={styles.totalText}>{earnedIds.size} из {ACHIEVEMENTS.length}</Text>
          </View>
          <View style={styles.totalBar}>
            <View style={[styles.totalFill, { width: `${(earnedIds.size / ACHIEVEMENTS.length) * 100}%` }]} />
          </View>

          {/* В процессе */}
          <Text style={styles.groupLabel}>В процессе</Text>
          <View style={styles.inProgress}>
            <ProgressCard label="Вопрос дня" current={progressData.dailyStreak} target={progressData.dailyStreakTarget} icon="chatbox-outline" />
            <ProgressCard label="Чекин настроения" current={progressData.checkinStreak} target={7} icon="thermometer-outline" />
            <ProgressCard label="Психотесты" current={progressData.psychCount} target={8} icon="flask-outline" />
          </View>

          {/* Группы */}
          {ACHIEVEMENT_GROUPS.map(group => (
            <View key={group.id}>
              <Text style={styles.groupLabel}>{group.label}</Text>
              <View style={styles.grid}>
                {group.achievements.map(a => {
                  const isEarned = earnedIds.has(a.id);
                  if (!isEarned && a.hidden) {
                    return (
                      <View key={a.id} style={[styles.item, styles.itemLocked]}>
                        <Ionicons name="help-outline" size={22} color={colors.muted} />
                        <Text style={[styles.itemLabel, { color: colors.muted }]}>???</Text>
                        <Text style={styles.itemDesc}>эту получают единицы</Text>
                      </View>
                    );
                  }
                  return (
                    <TouchableOpacity
                      key={a.id}
                      style={[styles.item, !isEarned && styles.itemLocked]}
                      onPress={() => !isEarned && showAlert(a.label, `Как получить:\n${a.desc}`)}
                      activeOpacity={isEarned ? 1 : 0.7}
                    >
                      <Ionicons name={a.icon} size={22} color={isEarned ? colors.accent : colors.muted} />
                      <Text style={[styles.itemLabel, !isEarned && { color: colors.muted }]}>{a.label}</Text>
                      <Text style={styles.itemDesc}>{isEarned ? a.desc : '?'}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}

          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
  backBtn: { padding: 2 },
  title: { fontSize: 20, fontWeight: 'bold', color: colors.white },

  scroll: { paddingBottom: 16 },

  totalRow: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  totalText: { fontSize: 12, color: colors.muted },
  totalBar: { height: 3, backgroundColor: colors.border, borderRadius: 2, marginHorizontal: 16, marginBottom: 8 },
  totalFill: { height: 3, backgroundColor: colors.accent, borderRadius: 2 },

  groupLabel: {
    fontSize: 11, fontWeight: '700', color: colors.muted,
    textTransform: 'uppercase', letterSpacing: 0.7,
    paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8,
  },
  inProgress: { paddingHorizontal: 16, paddingBottom: 4 },

  progressCard:       { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
  progressCardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  progressCardLabel:  { fontSize: 13, color: colors.white, fontWeight: '500' },
  progressCardCount:  { fontSize: 12, color: colors.muted },
  progressCardBar:    { height: 3, backgroundColor: colors.border, borderRadius: 2 },
  progressCardFill:   { height: 3, backgroundColor: colors.accent, borderRadius: 2 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 10, paddingBottom: 4, gap: 8 },
  item: {
    width: '30%', flexGrow: 1,
    backgroundColor: colors.card,
    borderRadius: 12, padding: 10, alignItems: 'center', gap: 4,
  },
  itemLocked: { opacity: 0.35 },
  itemLabel: { color: colors.white, fontSize: 11, fontWeight: '600', textAlign: 'center' },
  itemDesc:  { color: colors.muted, fontSize: 9, textAlign: 'center', lineHeight: 13 },
});
