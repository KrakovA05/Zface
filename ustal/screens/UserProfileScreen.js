import {
  StyleSheet, Text, View, ScrollView,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../supabase';
import { store } from '../store';
import { LEVEL_DATA, LEVEL_COLORS } from '../constants';
import { colors } from '../theme';
import Avatar from '../components/Avatar';

const STATUS_NONE     = 'none';
const STATUS_SENT     = 'sent';
const STATUS_RECEIVED = 'received';
const STATUS_FRIENDS  = 'friends';

function ActionBtn({ icon, label, onPress, variant = 'primary', disabled }) {
  const bg = variant === 'primary' ? colors.accent
    : variant === 'danger'   ? '#c0392b'
    : 'transparent';
  const border = variant === 'outline' ? colors.accent : undefined;
  const textColor = variant === 'outline' ? colors.accent : '#fff';
  return (
    <TouchableOpacity
      style={[styles.actionBtn, { backgroundColor: bg }, border && { borderWidth: 1, borderColor: border }]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
    >
      {icon ? <Ionicons name={icon} size={17} color={textColor} /> : null}
      <Text style={[styles.actionBtnText, { color: textColor }]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function UserProfileScreen({ route, navigation }) {
  const { user } = route.params;
  const isMe = user.user_id === store.userId;
  const level = LEVEL_DATA[user.level] || LEVEL_DATA.green;

  const [friendStatus, setFriendStatus] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [liveStatus, setLiveStatus] = useState(user.status || '');
  const [liveAvatarUrl, setLiveAvatarUrl] = useState(user.avatar_url || null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    if (isMe) return;
    loadFriendStatus();
    loadBlockStatus();
    supabase
      .from('users')
      .select('status, avatar_url, last_seen')
      .eq('user_id', user.user_id)
      .single()
      .then(({ data }) => {
        if (data) {
          setLiveStatus(data.status || '');
          setLiveAvatarUrl(data.avatar_url || null);
          setIsOnline(data.last_seen && (Date.now() - new Date(data.last_seen).getTime()) < 3 * 60 * 1000);
        }
      });
  }, []);

  const loadBlockStatus = async () => {
    const { data } = await supabase
      .from('blocks').select('id')
      .eq('blocker_id', store.userId).eq('blocked_id', user.user_id)
      .maybeSingle();
    setIsBlocked(!!data);
  };

  const blockUser = () => {
    Alert.alert(
      'Заблокировать',
      `Заблокировать ${user.username}? Вы не сможете писать друг другу.`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Заблокировать', style: 'destructive',
          onPress: async () => {
            setBlockLoading(true);
            await supabase.from('blocks').insert({ blocker_id: store.userId, blocked_id: user.user_id });
            await Promise.all([
              supabase.from('friendships').delete().eq('requester_id', store.userId).eq('receiver_id', user.user_id),
              supabase.from('friendships').delete().eq('requester_id', user.user_id).eq('receiver_id', store.userId),
            ]);
            setIsBlocked(true);
            setFriendStatus(STATUS_NONE);
            setBlockLoading(false);
          },
        },
      ]
    );
  };

  const unblockUser = async () => {
    setBlockLoading(true);
    await supabase.from('blocks').delete()
      .eq('blocker_id', store.userId).eq('blocked_id', user.user_id);
    setIsBlocked(false);
    setBlockLoading(false);
    loadFriendStatus();
  };

  const loadFriendStatus = async () => {
    const [{ data: sent }, { data: received }] = await Promise.all([
      supabase.from('friendships').select('status').eq('requester_id', store.userId).eq('receiver_id', user.user_id).maybeSingle(),
      supabase.from('friendships').select('status').eq('requester_id', user.user_id).eq('receiver_id', store.userId).maybeSingle(),
    ]);
    if (sent?.status === 'accepted' || received?.status === 'accepted') setFriendStatus(STATUS_FRIENDS);
    else if (sent?.status === 'pending') setFriendStatus(STATUS_SENT);
    else if (received?.status === 'pending') setFriendStatus(STATUS_RECEIVED);
    else setFriendStatus(STATUS_NONE);
  };

  const sendRequest = async () => {
    setActionLoading(true);
    const { error } = await supabase.from('friendships').insert({ requester_id: store.userId, receiver_id: user.user_id, status: 'pending' });
    setActionLoading(false);
    if (error) { Alert.alert('Ошибка', 'Не удалось отправить заявку'); return; }
    setFriendStatus(STATUS_SENT);
  };

  const acceptRequest = async () => {
    setActionLoading(true);
    const { error } = await supabase.from('friendships').update({ status: 'accepted' })
      .eq('requester_id', user.user_id).eq('receiver_id', store.userId);
    setActionLoading(false);
    if (error) { Alert.alert('Ошибка', 'Не удалось принять заявку'); return; }
    setFriendStatus(STATUS_FRIENDS);
  };

  const rejectRequest = async () => {
    setActionLoading(true);
    const { error } = await supabase.from('friendships').delete()
      .eq('requester_id', user.user_id).eq('receiver_id', store.userId);
    setActionLoading(false);
    if (error) { Alert.alert('Ошибка', 'Не удалось отклонить заявку'); return; }
    setFriendStatus(STATUS_NONE);
  };

  const removeFriend = () => {
    Alert.alert('Удалить из друзей', `Удалить ${user.username} из друзей?`, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить', style: 'destructive',
        onPress: async () => {
          setActionLoading(true);
          await Promise.all([
            supabase.from('friendships').delete().eq('requester_id', store.userId).eq('receiver_id', user.user_id),
            supabase.from('friendships').delete().eq('requester_id', user.user_id).eq('receiver_id', store.userId),
          ]);
          setActionLoading(false);
          setFriendStatus(STATUS_NONE);
        },
      },
    ]);
  };

  const reportUser = () => {
    Alert.alert('Пожаловаться', `Пожаловаться на ${user.username}?`, [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Спам', onPress: () => sendReport('spam') },
      { text: 'Оскорбления', onPress: () => sendReport('abuse') },
      { text: 'Другое', onPress: () => sendReport('other') },
    ]);
  };

  const sendReport = async (reason) => {
    const { error } = await supabase.from('reports').insert({
      reporter_id: store.userId, reported_user_id: user.user_id, reason,
    });
    if (!error) Alert.alert('Жалоба отправлена', 'Мы рассмотрим её в ближайшее время');
  };

  const openDm = () => {
    navigation.navigate('DirectMessage', {
      friend: { username: user.username, userId: user.user_id, level: user.level, avatarUrl: liveAvatarUrl },
    });
  };

  const renderActions = () => {
    if (friendStatus === null || actionLoading) {
      return <ActivityIndicator color={colors.accent} style={{ marginVertical: 8 }} />;
    }

    if (isBlocked) {
      return (
        <View style={styles.actionsCol}>
          <View style={[styles.actionBtn, { backgroundColor: colors.card }]}>
            <Ionicons name="ban-outline" size={17} color={colors.muted} />
            <Text style={[styles.actionBtnText, { color: colors.muted }]}>Заблокирован</Text>
          </View>
          {blockLoading
            ? <ActivityIndicator color={colors.muted} />
            : <ActionBtn icon="checkmark-circle-outline" label="Разблокировать" onPress={unblockUser} variant="outline" />
          }
          <TouchableOpacity style={styles.linkBtn} onPress={reportUser}>
            <Text style={styles.linkBtnText}>Пожаловаться</Text>
          </TouchableOpacity>
        </View>
      );
    }

    const dmBtn = <ActionBtn icon="chatbubble-outline" label="Написать" onPress={openDm} />;
    const blockBtn = blockLoading
      ? <ActivityIndicator color={colors.muted} />
      : <TouchableOpacity style={styles.linkBtn} onPress={blockUser}>
          <Text style={styles.linkBtnText}>Заблокировать</Text>
        </TouchableOpacity>;
    const reportBtn = (
      <TouchableOpacity style={styles.linkBtn} onPress={reportUser}>
        <Text style={styles.linkBtnText}>Пожаловаться</Text>
      </TouchableOpacity>
    );

    switch (friendStatus) {
      case STATUS_FRIENDS:
        return (
          <View style={styles.actionsCol}>
            {dmBtn}
            <ActionBtn icon="person-remove-outline" label="Удалить из друзей" onPress={removeFriend} variant="danger" />
            {blockBtn}
            {reportBtn}
          </View>
        );
      case STATUS_SENT:
        return (
          <View style={styles.actionsCol}>
            {dmBtn}
            <View style={[styles.actionBtn, { backgroundColor: colors.card }]}>
              <Ionicons name="checkmark-circle-outline" size={17} color={colors.muted} />
              <Text style={[styles.actionBtnText, { color: colors.muted }]}>Заявка отправлена</Text>
            </View>
            {blockBtn}
            {reportBtn}
          </View>
        );
      case STATUS_RECEIVED:
        return (
          <View style={styles.actionsCol}>
            {dmBtn}
            <View style={styles.requestRow}>
              <ActionBtn icon="checkmark" label="Принять" onPress={acceptRequest} />
              <ActionBtn icon="close" label="Отклонить" onPress={rejectRequest} variant="outline" />
            </View>
            {blockBtn}
            {reportBtn}
          </View>
        );
      default:
        return (
          <View style={styles.actionsCol}>
            {dmBtn}
            <ActionBtn icon="person-add-outline" label="Добавить в друзья" onPress={sendRequest} variant="outline" />
            {blockBtn}
            {reportBtn}
          </View>
        );
    }
  };

  return (
    <View style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={26} color={colors.white} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Avatar uri={liveAvatarUrl} username={user.username} level={user.level} size={88} isOnline={isOnline} />
          <Text style={[styles.username, { color: LEVEL_COLORS[user.level] || colors.accent }]}>
            {user.username}
          </Text>
          <View style={[styles.levelBadge, { borderColor: level.color + '55' }]}>
            <Text style={[styles.levelBadgeText, { color: level.color }]}>{level.label}</Text>
          </View>
          {liveStatus ? <Text style={styles.status}>"{liveStatus}"</Text> : null}
        </View>

        <View style={styles.actionsWrap}>
          {isMe ? (
            <View style={[styles.actionBtn, { backgroundColor: colors.card }]}>
              <Text style={[styles.actionBtnText, { color: colors.muted }]}>Это ты</Text>
            </View>
          ) : renderActions()}
        </View>

        {(user.labels || []).length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Ярлыки</Text>
            <View style={styles.labelsRow}>
              {(user.labels || []).map(label => (
                <View key={label} style={styles.chip}>
                  <Text style={styles.chipText}>{label}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 12, paddingVertical: 6 },
  backButton: { width: 40, padding: 4 },

  content: { paddingHorizontal: 24, paddingBottom: 40 },

  hero: { alignItems: 'center', marginBottom: 24, paddingTop: 4 },
  username: { fontSize: 24, fontWeight: 'bold', marginTop: 14, marginBottom: 8 },
  levelBadge: {
    borderWidth: 1, borderRadius: 20,
    paddingVertical: 4, paddingHorizontal: 14, marginBottom: 10,
  },
  levelBadgeText: { fontSize: 13, fontWeight: '600' },
  status: { color: colors.muted, fontSize: 14, fontStyle: 'italic', textAlign: 'center' },

  actionsWrap: { marginBottom: 20 },
  actionsCol: { gap: 10 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16,
  },
  actionBtnText: { fontSize: 15, fontWeight: '600' },
  requestRow: { flexDirection: 'row', gap: 10 },
  linkBtn: { alignItems: 'center', paddingVertical: 8 },
  linkBtnText: { color: colors.muted, fontSize: 13 },

  card: { backgroundColor: colors.card, borderRadius: 16, padding: 20, marginBottom: 16 },
  cardTitle: { color: colors.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 12 },
  labelsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: colors.accent + '18', borderRadius: 12,
    paddingVertical: 5, paddingHorizontal: 12,
    borderWidth: 1, borderColor: colors.accent + '55',
  },
  chipText: { color: colors.accent, fontSize: 13 },
});
