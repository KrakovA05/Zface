import {
  StyleSheet, Text, View, TouchableOpacity,
  ScrollView, TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { useState, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../supabase';
import { store } from '../store';
import { LABELS, LEVEL_COLORS } from '../constants';
import { colors, shared } from '../theme';
import Avatar from '../components/Avatar';

export default function FriendsScreen({ navigation }) {
  const [tab, setTab] = useState('friends');

  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loadingFriends, setLoadingFriends] = useState(false);

  const [searchNick, setSearchNick] = useState('');
  const [selectedLabels, setSelectedLabels] = useState([]);
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadFriends();
    }, [])
  );

  const loadFriends = async () => {
    if (!store.userId) return;
    setLoadingFriends(true);

    // Все строки friendships где я участвую
    const { data: rows } = await supabase
      .from('friendships')
      .select('*')
      .or(`requester_id.eq.${store.userId},receiver_id.eq.${store.userId}`);

    if (!rows?.length) {
      setFriends([]);
      setRequests([]);
      setLoadingFriends(false);
      return;
    }

    const acceptedIds = rows
      .filter(r => r.status === 'accepted')
      .map(r => r.requester_id === store.userId ? r.receiver_id : r.requester_id);

    const incomingIds = rows
      .filter(r => r.status === 'pending' && r.receiver_id === store.userId)
      .map(r => r.requester_id);

    const allIds = [...new Set([...acceptedIds, ...incomingIds])];

    if (!allIds.length) {
      setFriends([]);
      setRequests([]);
      setLoadingFriends(false);
      return;
    }

    const { data: users } = await supabase
      .from('users')
      .select('username, level, user_id, avatar_url, status, labels')
      .in('user_id', allIds);

    const userMap = Object.fromEntries((users || []).map(u => [u.user_id, u]));
    setFriends(acceptedIds.map(id => userMap[id]).filter(Boolean));
    setRequests(incomingIds.map(id => userMap[id]).filter(Boolean));
    setLoadingFriends(false);
  };

  const acceptRequest = async (user) => {
    const { error } = await supabase.from('friendships')
      .update({ status: 'accepted' })
      .eq('requester_id', user.user_id)
      .eq('receiver_id', store.userId);
    if (error) { Alert.alert('Ошибка', 'Не удалось принять заявку'); return; }
    loadFriends();
  };

  const rejectRequest = async (user) => {
    const { error } = await supabase.from('friendships')
      .delete()
      .eq('requester_id', user.user_id)
      .eq('receiver_id', store.userId);
    if (error) { Alert.alert('Ошибка', 'Не удалось отклонить заявку'); return; }
    loadFriends();
  };

  const toggleLabel = (label) => {
    setSelectedLabels(prev =>
      prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]
    );
  };

  const search = async () => {
    const nick = searchNick.trim();
    if (!nick && selectedLabels.length === 0) return;
    setSearching(true);
    setSearched(false);

    let query = supabase.from('users').select('*').neq('user_id', store.userId);
    if (nick) query = query.ilike('username', `%${nick}%`);
    if (selectedLabels.length > 0) query = query.overlaps('labels', selectedLabels);

    const { data, error } = await query;
    setSearching(false);
    setSearched(true);
    if (error) { Alert.alert('Ошибка', 'Не удалось выполнить поиск'); return; }
    setResults(data || []);
  };

  const openProfile = (user) => {
    navigation.navigate('UserProfile', { user });
  };

  // ─── Friends tab ──────────────────────────────────────────────────────────

  const renderFriends = () => {
    if (loadingFriends) {
      return <ActivityIndicator color={colors.accent} style={styles.centered} />;
    }
    return (
      <>
        {requests.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Входящие заявки</Text>
            {requests.map(user => (
              <View key={user.user_id} style={styles.requestCard}>
                <TouchableOpacity style={styles.requestLeft} onPress={() => openProfile(user)}>
                  <Avatar uri={user.avatar_url} username={user.username} level={user.level} size={44} />
                  <View style={styles.requestInfo}>
                    <Text style={[styles.requestName, { color: LEVEL_COLORS[user.level] || colors.accent }]}>
                      {user.username}
                    </Text>
                    {user.status ? <Text style={styles.requestStatus}>{user.status}</Text> : null}
                  </View>
                </TouchableOpacity>
                <View style={styles.requestBtns}>
                  <TouchableOpacity style={styles.acceptBtn} onPress={() => acceptRequest(user)}>
                    <Text style={styles.acceptBtnText}>✓</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.rejectBtn} onPress={() => rejectRequest(user)}>
                    <Text style={styles.rejectBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {friends.length > 0 && (
          <View style={styles.section}>
            {requests.length > 0 && <Text style={styles.sectionTitle}>Друзья</Text>}
            {friends.map(friend => (
              <TouchableOpacity
                key={friend.user_id}
                style={styles.friendCard}
                onPress={() => openProfile(friend)}
              >
                <Avatar uri={friend.avatar_url} username={friend.username} level={friend.level} size={44} />
                <View style={styles.friendInfo}>
                  <Text style={[styles.friendName, { color: LEVEL_COLORS[friend.level] || colors.accent }]}>
                    {friend.username}
                  </Text>
                  {friend.status ? <Text style={styles.friendStatus}>{friend.status}</Text> : null}
                </View>
                <TouchableOpacity
                  style={styles.dmButton}
                  onPress={() => navigation.navigate('DirectMessage', {
                    friend: { username: friend.username, userId: friend.user_id, level: friend.level, avatarUrl: friend.avatar_url },
                  })}
                >
                  <Text style={styles.dmButtonText}>💬</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {friends.length === 0 && requests.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🫂</Text>
            <Text style={styles.emptyText}>Пока нет друзей</Text>
            <Text style={styles.emptyHint}>Найди своих во вкладке Поиск</Text>
          </View>
        )}
      </>
    );
  };

  // ─── Search tab ───────────────────────────────────────────────────────────

  const renderSearch = () => (
    <>
      <TextInput
        style={[shared.input, { marginBottom: 16 }]}
        placeholder="Поиск по нику..."
        placeholderTextColor={colors.muted}
        value={searchNick}
        onChangeText={setSearchNick}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Text style={styles.labelsHint}>Или выбери ярлыки:</Text>
      <View style={styles.labelsRow}>
        {LABELS.map(label => (
          <TouchableOpacity
            key={label}
            style={[shared.label, selectedLabels.includes(label) && shared.labelSelected]}
            onPress={() => toggleLabel(label)}
          >
            <Text style={[shared.labelText, selectedLabels.includes(label) && shared.labelTextSelected]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[shared.button, (!searchNick.trim() && selectedLabels.length === 0) && shared.buttonDisabled]}
        onPress={search}
        disabled={(!searchNick.trim() && selectedLabels.length === 0) || searching}
      >
        {searching
          ? <ActivityIndicator color={colors.white} />
          : <Text style={shared.buttonText}>Найти 🖤</Text>
        }
      </TouchableOpacity>

      {searched && results.length === 0 && (
        <Text style={styles.noResults}>Никого не нашлось 😔</Text>
      )}

      {results.map(user => (
        <TouchableOpacity
          key={user.user_id}
          style={styles.resultCard}
          onPress={() => openProfile(user)}
        >
          <Avatar uri={user.avatar_url} username={user.username} level={user.level} size={44} />
          <View style={styles.resultInfo}>
            <Text style={[styles.resultName, { color: LEVEL_COLORS[user.level] || colors.accent }]}>
              {user.username}
            </Text>
            {user.status ? <Text style={styles.resultStatus}>{user.status}</Text> : null}
          </View>
          <Text style={styles.resultArrow}>›</Text>
        </TouchableOpacity>
      ))}
    </>
  );

  // ─── Render ───────────────────────────────────────────────────────────────

  const requestsBadge = requests.length > 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>🔍 Свои</Text>

        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabBtn, tab === 'friends' && styles.tabBtnActive]}
            onPress={() => { setTab('friends'); setSearched(false); setResults([]); }}
          >
            <Text style={[styles.tabLabel, tab === 'friends' && styles.tabLabelActive]}>
              Друзья{requestsBadge ? ' 🔴' : ''}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, tab === 'search' && styles.tabBtnActive]}
            onPress={() => setTab('search')}
          >
            <Text style={[styles.tabLabel, tab === 'search' && styles.tabLabelActive]}>
              Поиск
            </Text>
          </TouchableOpacity>
        </View>

        {tab === 'friends' ? renderFriends() : renderSearch()}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: { padding: 24, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: 'bold', color: colors.white, marginBottom: 20 },

  tabBar: {
    flexDirection: 'row', backgroundColor: colors.card,
    borderRadius: 12, padding: 4, marginBottom: 24,
  },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  tabBtnActive: { backgroundColor: colors.accent },
  tabLabel: { color: colors.muted, fontWeight: '600', fontSize: 15 },
  tabLabelActive: { color: colors.white },

  // Sections
  section: { marginBottom: 16 },
  sectionTitle: { color: colors.muted, fontSize: 13, fontWeight: '600', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },

  // Requests
  requestCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.card, borderRadius: 16,
    padding: 14, marginBottom: 10,
  },
  requestLeft: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  requestInfo: { marginLeft: 12, flex: 1 },
  requestName: { fontSize: 15, fontWeight: '600' },
  requestStatus: { color: colors.muted, fontSize: 12, marginTop: 2 },
  requestBtns: { flexDirection: 'row', gap: 8 },
  acceptBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#4CAF50', alignItems: 'center', justifyContent: 'center',
  },
  acceptBtnText: { color: colors.white, fontWeight: 'bold', fontSize: 16 },
  rejectBtn: {
    width: 36, height: 36, borderRadius: 10,
    borderWidth: 1, borderColor: colors.pink,
    alignItems: 'center', justifyContent: 'center',
  },
  rejectBtnText: { color: colors.pink, fontWeight: 'bold', fontSize: 16 },

  // Friends
  friendCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.card, borderRadius: 16,
    padding: 14, marginBottom: 10,
  },
  friendInfo: { flex: 1, marginLeft: 12 },
  friendName: { fontSize: 15, fontWeight: '600' },
  friendStatus: { color: colors.muted, fontSize: 12, marginTop: 2 },
  dmButton: {
    backgroundColor: colors.accent, borderRadius: 10,
    paddingVertical: 8, paddingHorizontal: 12,
  },
  dmButtonText: { fontSize: 18 },

  // Empty
  centered: { marginTop: 40 },
  empty: { alignItems: 'center', marginTop: 48 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: colors.white, fontSize: 18, fontWeight: '600', marginBottom: 6 },
  emptyHint: { color: colors.muted, fontSize: 14 },

  // Search
  labelsHint: { color: colors.muted, fontSize: 14, marginBottom: 12 },
  labelsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  noResults: { color: colors.muted, textAlign: 'center', marginTop: 24, fontSize: 16 },
  resultCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.card, borderRadius: 16,
    padding: 14, marginBottom: 10,
  },
  resultInfo: { flex: 1, marginLeft: 12 },
  resultName: { fontSize: 15, fontWeight: '600' },
  resultStatus: { color: colors.muted, fontSize: 12, marginTop: 2 },
  resultArrow: { color: colors.muted, fontSize: 22 },
});
