import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Share,
} from 'react-native';
import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../supabase';
import { store } from '../store';
import { colors } from '../theme';

function getReferralDiscount(count) {
  return Math.min(Math.floor(count / 5) * 10, 50);
}

export default function InviteScreen({ navigation }) {
  const [referralCount, setReferralCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    async function load() {
      const { count } = await supabase
        .from('users')
        .select('user_id', { count: 'exact', head: true })
        .eq('referred_by', store.userId);
      const c = count || 0;
      setReferralCount(c);
      store.referralDiscountPct = getReferralDiscount(c);
      setLoading(false);
    }
    load();
  }, []));

  const discount = getReferralDiscount(referralCount);
  const progressToNext = referralCount >= 25 ? 5 : referralCount % 5;
  const nextTarget = referralCount >= 25 ? 25 : Math.ceil((referralCount + 1) / 5) * 5;
  const inviteLink = `odin://invite/${store.username}`;
  const MILESTONES = [5, 10, 15, 20, 25];

  const handleShare = async () => {
    await Share.share({
      message: `Привет! Я в приложении «не один» — здесь найдёшь людей, которым сейчас так же непросто. Вот моя ссылка: ${inviteLink}`,
    });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="arrow-back" size={24} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Пригласить друга</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.subtitle}>
          Поделись с теми, кому сейчас тяжело.{'\n'}
          За каждые 5 человек — +10% скидки на премиум.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Приглашено</Text>
          <Text style={styles.bigNumber}>{referralCount}</Text>

          <View style={styles.dotsRow}>
            {[0, 1, 2, 3, 4].map(i => (
              <View key={i} style={[styles.dot, i < progressToNext && styles.dotFilled]} />
            ))}
          </View>

          {referralCount < 25 ? (
            <Text style={styles.progressText}>
              {progressToNext} из 5 до следующей скидки (+10%)
            </Text>
          ) : (
            <Text style={[styles.progressText, { color: '#5DAA72' }]}>
              Максимальная скидка достигнута!
            </Text>
          )}

          <View style={styles.discountBadge}>
            <Text style={styles.discountLabel}>Твоя скидка на премиум</Text>
            <Text style={[styles.discountValue, discount > 0 && { color: colors.accent }]}>
              {discount > 0 ? `${discount}%` : 'пока нет'}
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Прогресс скидок</Text>
          {MILESTONES.map(m => {
            const reached = referralCount >= m;
            return (
              <View key={m} style={styles.milestoneRow}>
                <Ionicons
                  name={reached ? 'checkmark-circle' : 'ellipse-outline'}
                  size={18}
                  color={reached ? '#5DAA72' : colors.muted}
                />
                <Text style={[styles.milestoneText, reached && styles.milestoneReached]}>
                  {m} человек → {(m / 5) * 10}% скидки
                </Text>
              </View>
            );
          })}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Твоя ссылка</Text>
          <Text style={styles.linkText} selectable>{inviteLink}</Text>
        </View>

        <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.8}>
          <Ionicons name="share-outline" size={20} color={colors.onAccent} />
          <Text style={styles.shareBtnText}>Поделиться</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#E8DFD0',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.white },
  content: { padding: 20, gap: 16 },
  subtitle: { fontSize: 15, color: colors.muted, lineHeight: 22, textAlign: 'center' },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#E8DFD0', gap: 12,
  },
  cardLabel: {
    fontSize: 12, fontWeight: '700', color: colors.muted,
    textTransform: 'uppercase', letterSpacing: 0.8,
  },
  bigNumber: {
    fontSize: 52, fontWeight: '800', color: colors.white,
    textAlign: 'center', lineHeight: 56,
  },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 10 },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#E8DFD0' },
  dotFilled: { backgroundColor: colors.accent },
  progressText: { fontSize: 13, color: colors.muted, textAlign: 'center' },
  discountBadge: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.background, borderRadius: 12, padding: 12,
  },
  discountLabel: { fontSize: 14, color: colors.white },
  discountValue: { fontSize: 20, fontWeight: '800', color: colors.muted },
  milestoneRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  milestoneText: { fontSize: 14, color: colors.muted },
  milestoneReached: { color: colors.white, fontWeight: '600' },
  linkText: { fontSize: 13, color: colors.muted, fontFamily: 'monospace' },
  shareBtn: {
    backgroundColor: colors.accent, borderRadius: 14, paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  shareBtnText: { color: colors.onAccent, fontSize: 16, fontWeight: '600' },
});
