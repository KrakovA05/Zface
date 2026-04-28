import { StyleSheet, Text, View, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../supabase';
import { store } from '../store';
import { LEVEL_COLORS } from '../constants';
import { colors } from '../theme';
import { getConversationId } from '../utils';
import { getLastRead } from '../utils/unread';
import Avatar from '../components/Avatar';

const ROOMS = [
  { id: 'green',  label: 'Зелёная комната', desc: 'Для тех кто держится', color: '#4CAF50', icon: 'leaf-outline' },
  { id: 'yellow', label: 'Жёлтая комната',  desc: 'Для тех на грани',     color: '#FFC107', icon: 'partly-sunny-outline' },
  { id: 'red',    label: 'Красная комната',  desc: 'Для тех кому тяжело',  color: '#F44336', icon: 'flame-outline' },
];


function Badge({ count }) {
  if (!count) return null;
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{count > 99 ? '99+' : String(count)}</Text>
    </View>
  );
}

function SectionHeader({ icon, label }) {
  return (
    <View style={styles.sectionHeader}>
      <Ionicons name={icon} size={13} color={colors.muted} />
      <Text style={styles.sectionHeaderText}>{label}</Text>
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
  const [tab, setTab] = useState('chats');
  const [friends, setFriends] = useState([]);
  const [dmUnread, setDmUnread] = useState({});
  const [roomUnread, setRoomUnread] = useState({});
  const [roomOnline, setRoomOnline] = useState({});
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    if (!store.userId) return;
    setLoading(true);

    const { data: rows } = await supabase
      .from('friendships')
      .select('*')
      .or(`requester_id.eq.${store.userId},receiver_id.eq.${store.userId}`)
      .eq('status', 'accepted');

    const friendIds = (rows || []).map(r =>
      r.requester_id === store.userId ? r.receiver_id : r.requester_id
    );

    const { data: allDms } = await supabase
      .from('direct_messages')
      .select('conversation_id, sender_id')
      .or(`sender_id.eq.${store.userId},conversation_id.like.%${store.userId}%`);

    const dmConvIds = [...new Set((allDms || []).map(m => m.conversation_id))];
    const dmPartnerIds = dmConvIds
      .map(cid => cid.split('_').find(id => id !== store.userId))
      .filter(Boolean);

    const { data: blockedData } = await supabase
      .from('blocks')
      .select('blocked_id')
      .eq('blocker_id', store.userId);
    const blockedIds = new Set((blockedData || []).map(b => b.blocked_id));

    const allIds = [...new Set([...friendIds, ...dmPartnerIds])].filter(id => !blockedIds.has(id));

    let friendsList = [];
    if (allIds.length) {
      const { data: users } = await supabase
        .from('users')
        .select('username, level, user_id, avatar_url, status, last_seen')
        .in('user_id', allIds);

      const convIds = (users || []).map(u => getConversationId(store.userId, u.user_id));
      const { data: lastMsgs } = await supabase
        .from('direct_messages')
        .select('conversation_id, created_at')
        .in('conversation_id', convIds)
        .order('created_at', { ascending: false });

      const lastMsgMap = {};
      (lastMsgs || []).forEach(m => {
        if (!lastMsgMap[m.conversation_id]) lastMsgMap[m.conversation_id] = m.created_at;
      });

      friendsList = (users || []).sort((a, b) => {
        const aDate = lastMsgMap[getConversationId(store.userId, a.user_id)];
        const bDate = lastMsgMap[getConversationId(store.userId, b.user_id)];
        if (!aDate && !bDate) return 0;
        if (!aDate) return 1;
        if (!bDate) return -1;
        return new Date(bDate) - new Date(aDate);
      });
    }
    setFriends(friendsList);

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

    const roomCounts = {};
    const onlineCounts = {};
    await Promise.all(ROOMS.map(async (r) => {
      if (r.id === userLevel) {
        const lastRead = await getLastRead(`room_${r.id}`);
        roomCounts[r.id] = await countUnread(
          'messages', 'level', r.id,
          'username', store.username || '__nobody__', lastRead
        );
      } else {
        roomCounts[r.id] = 0;
      }
      const { count } = await supabase
        .from('users').select('*', { count: 'exact', head: true }).eq('level', r.id);
      onlineCounts[r.id] = count || 0;
    }));
    setRoomUnread(roomCounts);
    setRoomOnline(onlineCounts);

    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => {
    loadAll();
  }, [loadAll]));

  const dmTotal = Object.values(dmUnread).reduce((s, n) => s + n, 0);
  const chatsTotal = Object.values(roomUnread).reduce((s, n) => s + n, 0);

  return (
    <View style={styles.safeArea}>
      {/* Таб-свитч */}
      <View style={styles.switchRow}>
        <TouchableOpacity
          style={[styles.switchBtn, tab === 'chats' && styles.switchBtnActive]}
          onPress={() => setTab('chats')}
        >
          <Text style={[styles.switchLabel, tab === 'chats' && styles.switchLabelActive]}>Чаты</Text>
          {chatsTotal > 0 && <Badge count={chatsTotal} />}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.switchBtn, tab === 'dms' && styles.switchBtnActive]}
          onPress={() => setTab('dms')}
        >
          <Text style={[styles.switchLabel, tab === 'dms' && styles.switchLabelActive]}>Личные</Text>
          {dmTotal > 0 && <Badge count={dmTotal} />}
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {tab === 'chats' ? (
            <>
              {/* Общий чат */}
              <SectionHeader icon="chatbubbles-outline" label="Общий чат" />
              <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('Chat')}>
                <View style={[styles.rowIconWrap, { backgroundColor: colors.accent + '22' }]}>
                  <Ionicons name="earth-outline" size={20} color={colors.accent} />
                </View>
                <View style={styles.rowInfo}>
                  <Text style={styles.rowLabel}>Общий чат</Text>
                  <Text style={styles.rowSub}>Для всех пользователей</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.muted} />
              </TouchableOpacity>

              {/* Комнаты */}
              <SectionHeader icon="grid-outline" label="Комнаты по статусу" />
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
                    <View style={[styles.roomIcon, { backgroundColor: r.color + '22' }]}>
                      <Ionicons name={r.icon} size={18} color={r.color} />
                    </View>
                    <View style={styles.rowInfo}>
                      <Text style={[styles.rowLabel, !isMyRoom && { color: colors.muted }]}>{r.label}</Text>
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
                      <Ionicons name="lock-closed" size={16} color={colors.muted} />
                    )}
                  </TouchableOpacity>
                );
              })}

            </>
          ) : (
            <>
              {friends.length === 0 ? (
                <View style={styles.emptyBlock}>
                  <View style={styles.emptyIconWrap}>
                    <Ionicons name="chatbubble-outline" size={32} color={colors.muted} />
                  </View>
                  <Text style={styles.emptyText}>Нет собеседников</Text>
                  <TouchableOpacity onPress={() => navigation.navigate('Friends')}>
                    <Text style={styles.emptyLink}>Найти своих →</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                friends.map(f => {
                  const unread = dmUnread[f.user_id] || 0;
                  const isOnline = f.last_seen && (Date.now() - new Date(f.last_seen).getTime()) < 3 * 60 * 1000;
                  return (
                    <TouchableOpacity
                      key={f.user_id}
                      style={styles.row}
                      onPress={() => navigation.navigate('DirectMessage', {
                        friend: { username: f.username, userId: f.user_id, level: f.level, avatarUrl: f.avatar_url },
                      })}
                    >
                      <Avatar uri={f.avatar_url} username={f.username} level={f.level} size={42} isOnline={isOnline} />
                      <View style={styles.rowInfo}>
                        <Text style={[styles.rowLabel, { color: LEVEL_COLORS[f.level] || colors.white }]}>
                          {f.username}
                        </Text>
                        {f.status ? <Text style={styles.rowSub}>{f.status}</Text> : null}
                      </View>
                      {unread > 0 && <Badge count={unread} />}
                      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
                    </TouchableOpacity>
                  );
                })
              )}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },

  switchRow: {
    flexDirection: 'row',
    margin: 16,
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 4,
  },
  switchBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', paddingVertical: 10,
    borderRadius: 11, gap: 6,
  },
  switchBtnActive: { backgroundColor: colors.accent },
  switchLabel: { fontSize: 15, fontWeight: '600', color: colors.muted },
  switchLabelActive: { color: colors.onAccent },

  content: { paddingHorizontal: 16, paddingBottom: 40 },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginBottom: 8, marginTop: 4, paddingLeft: 2,
  },
  sectionHeaderText: {
    fontSize: 12, fontWeight: '700', color: colors.muted,
    textTransform: 'uppercase', letterSpacing: 0.6,
  },

  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.card, borderRadius: 14,
    padding: 14, marginBottom: 8, gap: 12,
  },
  rowIconWrap: {
    width: 38, height: 38, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },
  rowInfo: { flex: 1 },
  rowLabel: { fontSize: 15, fontWeight: '600', color: colors.white },
  rowSub: { fontSize: 12, color: colors.muted, marginTop: 2 },

  badge: {
    backgroundColor: '#e74c3c', borderRadius: 10,
    minWidth: 20, height: 20, paddingHorizontal: 5,
    alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },

  // Rooms
  roomCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.card, borderRadius: 14,
    padding: 14, marginBottom: 8, gap: 12, borderLeftWidth: 3,
  },
  roomCardMine: { backgroundColor: colors.accent + '12' },
  roomCardLocked: { opacity: 0.4 },
  roomIcon: {
    width: 38, height: 38, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },
  roomRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  roomOnline: { alignItems: 'center' },
  roomOnlineCount: { fontSize: 15, fontWeight: 'bold', color: colors.white },
  roomOnlineLabel: { fontSize: 10, color: colors.muted },
  myBadge: { borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  myBadgeText: { fontSize: 10, color: '#fff', fontWeight: 'bold' },

  // Empty DMs
  emptyBlock: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyIconWrap: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.card,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  emptyText: { color: colors.muted, fontSize: 15 },
  emptyLink: { color: colors.accent, fontSize: 15, fontWeight: '600' },
});
