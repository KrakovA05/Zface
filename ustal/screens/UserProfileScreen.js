import {
  StyleSheet, Text, View, ScrollView,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { useState, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';
import { store } from '../store';
import { LEVEL_DATA, LEVEL_COLORS } from '../constants';
import { colors, shared } from '../theme';
import Avatar from '../components/Avatar';

// friendship status относительно текущего пользователя
const STATUS_NONE = 'none';
const STATUS_SENT = 'sent';       // я отправил заявку
const STATUS_RECEIVED = 'received'; // мне прислали заявку
const STATUS_FRIENDS = 'friends';
const STATUS_BLOCKED = 'blocked'; // я заблокировал этого пользователя

export default function UserProfileScreen({ route, navigation }) {
  const { user } = route.params;
  const isMe = user.user_id === store.userId;
  const level = LEVEL_DATA[user.level] || LEVEL_DATA.green;

  const [friendStatus, setFriendStatus] = useState(null); // null = loading
  const [actionLoading, setActionLoading] = useState(false);
  const [liveStatus, setLiveStatus] = useState(user.status || '');
  const [liveAvatarUrl, setLiveAvatarUrl] = useState(user.avatar_url || null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);

  useEffect(() => {
    if (isMe) return;
    loadFriendStatus();
    loadBlockStatus();
    supabase
      .from('users')
      .select('status, avatar_url')
      .eq('user_id', user.user_id)
      .single()
      .then(({ data }) => {
        if (data) {
          setLiveStatus(data.status || '');
          setLiveAvatarUrl(data.avatar_url || null);
        }
      });
  }, []);

  const loadBlockStatus = async () => {
    const { data } = await supabase
      .from('blocks')
      .select('id')
      .eq('blocker_id', store.userId)
      .eq('blocked_id', user.user_id)
      .maybeSingle();
    setIsBlocked(!!data);
  };

  const blockUser = () => {
    Alert.alert(
      'Заблокировать',
      `Заблокировать ${user.username}? Вы не сможете писать друг другу и видеть переписку.`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Заблокировать', style: 'destructive',
          onPress: async () => {
            setBlockLoading(true);
            await supabase.from('blocks').insert({
              blocker_id: store.userId,
              blocked_id: user.user_id,
            });
            // Удаляем дружбу если была
            await Promise.all([
              supabase.from('friendships').delete()
                .eq('requester_id', store.userId).eq('receiver_id', user.user_id),
              supabase.from('friendships').delete()
                .eq('requester_id', user.user_id).eq('receiver_id', store.userId),
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
      .eq('blocker_id', store.userId)
      .eq('blocked_id', user.user_id);
    setIsBlocked(false);
    setBlockLoading(false);
    loadFriendStatus();
  };

  const loadFriendStatus = async () => {
    const [{ data: sent }, { data: received }] = await Promise.all([
      supabase.from('friendships')
        .select('status')
        .eq('requester_id', store.userId)
        .eq('receiver_id', user.user_id)
        .maybeSingle(),
      supabase.from('friendships')
        .select('status')
        .eq('requester_id', user.user_id)
        .eq('receiver_id', store.userId)
        .maybeSingle(),
    ]);

    if (sent?.status === 'accepted' || received?.status === 'accepted') {
      setFriendStatus(STATUS_FRIENDS);
    } else if (sent?.status === 'pending') {
      setFriendStatus(STATUS_SENT);
    } else if (received?.status === 'pending') {
      setFriendStatus(STATUS_RECEIVED);
    } else {
      setFriendStatus(STATUS_NONE);
    }
  };

  const sendRequest = async () => {
    setActionLoading(true);
    const { error } = await supabase.from('friendships').insert({
      requester_id: store.userId,
      receiver_id: user.user_id,
      status: 'pending',
    });
    setActionLoading(false);
    if (error) { Alert.alert('Ошибка', 'Не удалось отправить заявку'); return; }
    setFriendStatus(STATUS_SENT);
  };

  const acceptRequest = async () => {
    setActionLoading(true);
    const { error } = await supabase.from('friendships')
      .update({ status: 'accepted' })
      .eq('requester_id', user.user_id)
      .eq('receiver_id', store.userId);
    setActionLoading(false);
    if (error) { Alert.alert('Ошибка', 'Не удалось принять заявку'); return; }
    setFriendStatus(STATUS_FRIENDS);
  };

  const rejectRequest = async () => {
    setActionLoading(true);
    const { error } = await supabase.from('friendships')
      .delete()
      .eq('requester_id', user.user_id)
      .eq('receiver_id', store.userId);
    setActionLoading(false);
    if (error) { Alert.alert('Ошибка', 'Не удалось отклонить заявку'); return; }
    setFriendStatus(STATUS_NONE);
  };

  const removeFriend = () => {
    Alert.alert(
      'Удалить из друзей',
      `Удалить ${user.username} из друзей?`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить', style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            await Promise.all([
              supabase.from('friendships')
                .delete()
                .eq('requester_id', store.userId)
                .eq('receiver_id', user.user_id),
              supabase.from('friendships')
                .delete()
                .eq('requester_id', user.user_id)
                .eq('receiver_id', store.userId),
            ]);
            setActionLoading(false);
            setFriendStatus(STATUS_NONE);
          },
        },
      ]
    );
  };

  const openDm = () => {
    navigation.navigate('DirectMessage', {
      friend: { username: user.username, userId: user.user_id, level: user.level, avatarUrl: liveAvatarUrl },
    });
  };

  const renderAction = () => {
    if (friendStatus === null || actionLoading) return <ActivityIndicator color={colors.accent} />;

    const blockBtn = blockLoading
      ? <ActivityIndicator color={colors.muted} />
      : isBlocked
        ? (
          <TouchableOpacity style={[shared.button, styles.unblockBtn]} onPress={unblockUser}>
            <Text style={shared.buttonText}>Разблокировать</Text>
          </TouchableOpacity>
        )
        : (
          <TouchableOpacity style={styles.blockBtn} onPress={blockUser}>
            <Text style={styles.blockBtnText}>🚫 Заблокировать</Text>
          </TouchableOpacity>
        );

    // Если заблокирован — только кнопка разблокировки
    if (isBlocked) {
      return (
        <View style={styles.actionCol}>
          <View style={[shared.button, styles.blockedBadge]}>
            <Text style={shared.buttonText}>Пользователь заблокирован</Text>
          </View>
          {blockBtn}
        </View>
      );
    }

    const dmButton = (
      <TouchableOpacity style={[shared.button, styles.dmBtn]} onPress={openDm}>
        <Text style={shared.buttonText}>💬 Написать</Text>
      </TouchableOpacity>
    );

    switch (friendStatus) {
      case STATUS_FRIENDS:
        return (
          <View style={styles.actionCol}>
            {dmButton}
            <TouchableOpacity style={[shared.button, styles.removeBtn]} onPress={removeFriend}>
              <Text style={shared.buttonText}>Удалить из друзей</Text>
            </TouchableOpacity>
            {blockBtn}
          </View>
        );
      case STATUS_SENT:
        return (
          <View style={styles.actionCol}>
            {dmButton}
            <View style={[shared.button, styles.sentBtn]}>
              <Text style={shared.buttonText}>Заявка отправлена ✓</Text>
            </View>
            {blockBtn}
          </View>
        );
      case STATUS_RECEIVED:
        return (
          <View style={styles.actionCol}>
            {dmButton}
            <View style={styles.requestActions}>
              <TouchableOpacity style={styles.acceptBtn} onPress={acceptRequest}>
                <Text style={styles.acceptBtnText}>Принять</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.rejectBtn} onPress={rejectRequest}>
                <Text style={styles.rejectBtnText}>Отклонить</Text>
              </TouchableOpacity>
            </View>
            {blockBtn}
          </View>
        );
      case STATUS_NONE:
      default:
        return (
          <View style={styles.actionCol}>
            {dmButton}
            <TouchableOpacity style={shared.button} onPress={sendRequest}>
              <Text style={shared.buttonText}>+ Добавить в друзья</Text>
            </TouchableOpacity>
            {blockBtn}
          </View>
        );
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Avatar + name */}
        <View style={styles.hero}>
          <Avatar uri={liveAvatarUrl} username={user.username} level={user.level} size={88} />
          <Text style={[styles.username, { color: LEVEL_COLORS[user.level] || colors.accent }]}>
            {user.username}
          </Text>
          <View style={[styles.levelBadge, { backgroundColor: level.color + '22', borderColor: level.color }]}>
            <Text style={[styles.levelBadgeText, { color: level.color }]}>{level.label}</Text>
          </View>
          {liveStatus ? (
            <Text style={styles.status}>"{liveStatus}"</Text>
          ) : null}
        </View>

        {/* Action */}
        {isMe ? (
          <View style={styles.actionRow}>
            <View style={styles.itsYouBadge}>
              <Text style={styles.itsYouText}>Это ты</Text>
            </View>
          </View>
        ) : (
          <View style={styles.actionRow}>
            {renderAction()}
          </View>
        )}

        {/* Labels */}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  backButton: { width: 40 },
  backText: { color: colors.white, fontSize: 24 },

  content: { padding: 24, paddingTop: 8, paddingBottom: 40 },

  hero: { alignItems: 'center', marginBottom: 28 },
  username: {
    fontSize: 24, fontWeight: 'bold', marginTop: 16, marginBottom: 8,
  },
  levelBadge: {
    borderWidth: 1, borderRadius: 20,
    paddingVertical: 4, paddingHorizontal: 14, marginBottom: 12,
  },
  levelBadgeText: { fontSize: 14, fontWeight: '600' },
  status: {
    color: colors.muted, fontSize: 15, fontStyle: 'italic', textAlign: 'center',
  },

  actionRow: { marginBottom: 24 },
  itsYouBadge: {
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  itsYouText: { color: colors.muted, fontSize: 15 },
  actionCol: { gap: 10 },
  dmBtn: { backgroundColor: colors.accent },
  sentBtn: { backgroundColor: colors.muted, opacity: 0.8 },
  removeBtn: { backgroundColor: '#c0392b' },
  blockedBadge: { backgroundColor: colors.muted, opacity: 0.7 },
  unblockBtn: { backgroundColor: '#555' },
  blockBtn: { alignItems: 'center', paddingVertical: 10 },
  blockBtnText: { color: colors.muted, fontSize: 14 },
  requestActions: { flexDirection: 'row', gap: 12 },
  acceptBtn: {
    flex: 1, backgroundColor: '#4CAF50',
    borderRadius: 12, padding: 16, alignItems: 'center',
  },
  acceptBtnText: { color: colors.white, fontWeight: '600', fontSize: 15 },
  rejectBtn: {
    flex: 1, borderWidth: 1, borderColor: colors.pink,
    borderRadius: 12, padding: 16, alignItems: 'center',
  },
  rejectBtnText: { color: colors.pink, fontWeight: '600', fontSize: 15 },

  card: {
    backgroundColor: colors.card, borderRadius: 16, padding: 20, marginBottom: 16,
  },
  cardTitle: { color: colors.muted, fontSize: 14, marginBottom: 12 },
  labelsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: '#7D8AFF22', borderRadius: 12,
    paddingVertical: 4, paddingHorizontal: 12,
    borderWidth: 1, borderColor: colors.accent,
  },
  chipText: { color: colors.accent, fontSize: 13 },
});
