import { StyleSheet, Text, View, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useState, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../supabase';
import { store } from '../store';
import { LEVEL_COLORS, LEVEL_DATA } from '../constants';
import { colors } from '../theme';
import { getConversationId } from '../utils';
import { getLastRead } from '../utils/unread';
import Avatar from '../components/Avatar';

const ROOMS = [
  { id: 'green',  label: '🌿 Зелёная комната', desc: 'Для тех кто держится', color: '#4CAF50' },
  { id: 'yellow', label: '🌤 Жёлтая комната',  desc: 'Для тех на грани',     color: '#FFC107' },
  { id: 'red',    label: '🌪 Красная комната',  desc: 'Для тех кому тяжело',  color: '#F44336' },
];

const BAR_TABLES = [
  { id: 'main',   label: '🍸 Общий бар' },
  { id: 'quiet',  label: '🕯 Тихий уголок' },
  { id: 'music',  label: '🎵 Музыкальный стол' },
  { id: 'random', label: '🎲 Случайные темы' },
];

function Badge({ count }) {
  if (!count) return null;
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{count > 99 ? '99+' : String(count)}</Text>
    </View>
  );
}

async function countUnread(table, field, value, excludeField, excludeValue, lastRead) {
  let query = supabase
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq(field, value)
    .neq(excludeField, excludeValue);
  if (lastRead) query = query.gt('created_at', lastRead);
  const { count } = await query;
  return count || 0;
}

export default function MessagesScreen({ navigation }) {
  const userLevel = store.level || 'green';
  const [friends, setFriends] = useState([]);
  const [dmUnread, setDmUnread] = useState({});
  const [roomUnread, setRoomUnread] = useState({});
  const [roomOnline, setRoomOnline] = useState({});
  const [barUnread, setBarUnread] = useState({});
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    if (!store.userId) return;
    setLoading(true);

    // ── Друзья ──────────────────────────────────────────────────────
    const { data: rows } = await supabase
      .from('friendships')
      .select('*')
      .or(`requester_id.eq.${store.userId},receiver_id.eq.${store.userId}`)
      .eq('status', 'accepted');

    const friendIds = (rows || []).map(r =>
      r.requester_id === store.userId ? r.receiver_id : r.requester_id
    );

    let friendsList = [];
    if (friendIds.length) {
      const { data: users } = await supabase
        .from('users')
        .select('username, level, user_id, avatar_url, status')
        .in('user_id', friendIds);
      friendsList = users || [];
    }
    setFriends(friendsList);

    // ── Непрочитанные ЛС ──────────────────────────────────────────
    const dmCounts = {};
    await Promise.all(friendsList.map(async (f) => {
      const convId = getConversationId(store.userId, f.user_id);
      const lastRead = await getLastRead(`dm_${convId}`);
      dmCounts[f.user_id] = await countUnread(
        'direct_messages', 'conversation_id', convId,
        'sender_id', store.userId, lastRead
      );
    }));
    setDmUnread(dmCounts);

    // ── Непрочитанные комнаты + онлайн ────────────────────────────
    const roomCounts = {};
    const onlineCounts = {};
    await Promise.all(ROOMS.map(async (r) => {
      const lastRead = await getLastRead(`room_${r.id}`);
      roomCounts[r.id] = await countUnread(
        'messages', 'level', r.id,
        'username', store.username || '__nobody__', lastRead
      );
      const { count } = await supabase
        .from('users').select('*', { count: 'exact', head: true }).eq('level', r.id);
      onlineCounts[r.id] = count || 0;
    }));
    setRoomUnread(roomCounts);
    setRoomOnline(onlineCounts);

    // ── Непрочитанные бар ─────────────────────────────────────────
    const barCounts = {};
    await Promise.all(BAR_TABLES.map(async (t) => {
      const lastRead = await getLastRead(`bar_${t.id}`);
      barCounts[t.id] = await countUnread(
        'messages', 'level', `bar_${t.id}`,
        'username', store.username || '__nobody__', lastRead
      );
    }));
    setBarUnread(barCounts);

    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => {
    loadAll().then(() => {
      // Выставляем бейдж на таб
      const dmTotal = Object.values(dmUnread).reduce((s, n) => s + n, 0);
      const roomTotal = Object.values(roomUnread).reduce((s, n) => s + n, 0);
      const barTotal = Object.values(barUnread).reduce((s, n) => s + n, 0);
      const total = dmTotal + roomTotal + barTotal;
      navigation.getParent()?.setOptions({
        tabBarBadge: total > 0 ? total : null,
      });
    });
  }, [loadAll]));

  // Пересчитываем бейдж после загрузки
  useFocusEffect(useCallback(() => {
    const dmTotal = Object.values(dmUnread).reduce((s, n) => s + n, 0);
    const roomTotal = Object.values(roomUnread).reduce((s, n) => s + n, 0);
    const barTotal = Object.values(barUnread).reduce((s, n) => s + n, 0);
    const total = dmTotal + roomTotal + barTotal;
    navigation.getParent()?.setOptions({
      tabBarBadge: total > 0 ? (total > 99 ? '99+' : total) : null,
    });
  }, [dmUnread, roomUnread, barUnread]));

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>💬 Сообщения</Text>

        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* ── Общий чат ── */}
            <Text style={styles.sectionTitle}>🌐 Общий чат</Text>
            <TouchableOpacity
              style={styles.row}
              onPress={() => navigation.navigate('Chat')}
            >
              <View style={styles.rowInfo}>
                <Text style={styles.rowLabel}>Общий чат</Text>
                <Text style={styles.rowSub}>Для всех пользователей</Text>
              </View>
              <Text style={styles.arrow}>›</Text>
            </TouchableOpacity>

            {/* ── Личные сообщения ── */}
            <Text style={styles.sectionTitle}>📩 Личные сообщения</Text>
            {friends.length === 0 ? (
              <View style={styles.emptyBlock}>
                <Text style={styles.emptyText}>Нет друзей для переписки</Text>
                <TouchableOpacity onPress={() => navigation.navigate('Friends')}>
                  <Text style={styles.emptyLink}>Найти своих →</Text>
                </TouchableOpacity>
              </View>
            ) : (
              friends.map(f => {
                const unread = dmUnread[f.user_id] || 0;
                return (
                  <TouchableOpacity
                    key={f.user_id}
                    style={styles.row}
                    onPress={() => navigation.navigate('DirectMessage', {
                      friend: { username: f.username, userId: f.user_id, level: f.level, avatarUrl: f.avatar_url },
                    })}
                  >
                    <Avatar uri={f.avatar_url} username={f.username} level={f.level} size={42} />
                    <View style={styles.rowInfo}>
                      <Text style={[styles.rowLabel, { color: LEVEL_COLORS[f.level] || colors.white }]}>
                        {f.username}
                      </Text>
                      {f.status ? <Text style={styles.rowSub}>{f.status}</Text> : null}
                    </View>
                    <Badge count={unread} />
                    <Text style={styles.arrow}>›</Text>
                  </TouchableOpacity>
                );
              })
            )}

            {/* ── Комнаты ── */}
            <Text style={[styles.sectionTitle, { marginTop: 28 }]}>🚪 Комнаты по статусу</Text>
            {ROOMS.map(r => {
              const isMyRoom = r.id === userLevel;
              const unread = roomUnread[r.id] || 0;
              const online = roomOnline[r.id] ?? '—';
              return (
                <TouchableOpacity
                  key={r.id}
                  style={[
                    styles.roomCard,
                    { borderLeftColor: r.color },
                    isMyRoom && styles.roomCardMine,
                    !isMyRoom && styles.roomCardLocked,
                  ]}
                  onPress={() => isMyRoom ? navigation.navigate('Rooms', { openRoom: r.id }) : null}
                  activeOpacity={isMyRoom ? 0.7 : 1}
                >
                  <View style={styles.rowInfo}>
                    <Text style={[styles.roomLabel, !isMyRoom && styles.roomLabelLocked]}>{r.label}</Text>
                    <Text style={styles.rowSub}>{r.desc}</Text>
                  </View>
                  {isMyRoom ? (
                    <View style={styles.roomRight}>
                      <Badge count={unread} />
                      <View style={styles.roomOnline}>
                        <Text style={styles.roomOnlineCount}>{online}</Text>
                        <Text style={styles.roomOnlineLabel}>чел.</Text>
                      </View>
                      <View style={[styles.myBadge, { backgroundColor: r.color }]}>
                        <Text style={styles.myBadgeText}>ТВОЯ</Text>
                      </View>
                    </View>
                  ) : (
                    <Text style={styles.lockIcon}>🔒</Text>
                  )}
                </TouchableOpacity>
              );
            })}

            {/* ── Бар ── */}
            <Text style={[styles.sectionTitle, { marginTop: 28 }]}>🍸 Онлайн-бар</Text>
            {BAR_TABLES.map(t => {
              const unread = barUnread[t.id] || 0;
              return (
                <TouchableOpacity
                  key={t.id}
                  style={styles.row}
                  onPress={() => navigation.navigate('Bar', { openTable: t.id })}
                >
                  <View style={styles.rowInfo}>
                    <Text style={styles.rowLabel}>{t.label}</Text>
                  </View>
                  <Badge count={unread} />
                  <Text style={styles.arrow}>›</Text>
                </TouchableOpacity>
              );
            })}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { padding: 24, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: 'bold', color: colors.white, marginBottom: 24 },
  sectionTitle: {
    fontSize: 13, fontWeight: '700', color: colors.muted,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    gap: 12,
  },
  rowInfo: { flex: 1 },
  rowLabel: { fontSize: 15, fontWeight: '600', color: colors.white },
  rowSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  arrow: { color: colors.muted, fontSize: 22 },
  badge: {
    backgroundColor: '#e74c3c',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  emptyBlock: { alignItems: 'center', paddingVertical: 20, gap: 8 },
  emptyText: { color: colors.muted, fontSize: 15 },
  emptyLink: { color: colors.accent, fontSize: 15, fontWeight: '600' },

  // Комнаты
  roomCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.card, borderRadius: 14,
    padding: 14, marginBottom: 8, gap: 12, borderLeftWidth: 4,
  },
  roomCardMine: { backgroundColor: '#1e1e2e' },
  roomCardLocked: { opacity: 0.45 },
  roomLabel: { fontSize: 15, fontWeight: '600', color: colors.white, marginBottom: 2 },
  roomLabelLocked: { color: colors.muted },
  roomRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  roomOnline: { alignItems: 'center' },
  roomOnlineCount: { fontSize: 16, fontWeight: 'bold', color: colors.white },
  roomOnlineLabel: { fontSize: 10, color: colors.muted },
  myBadge: { borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  myBadgeText: { fontSize: 10, color: '#fff', fontWeight: 'bold' },
  lockIcon: { fontSize: 18 },
});
