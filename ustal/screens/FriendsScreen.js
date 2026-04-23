import {
  StyleSheet, Text, View, TouchableOpacity,
  ScrollView, TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../supabase';
import { store } from '../store';
import { LABELS, LEVEL_COLORS } from '../constants';
import { colors } from '../theme';
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

  useFocusEffect(useCallback(() => { loadFriends(); }, []));

  const loadFriends = async () => {
    if (!store.userId) return;
    setLoadingFriends(true);

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
      .select('username, level, user_id, avatar_url, status, labels, last_seen')
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
    if (nick && nick.length < 2) {
      Alert.alert('Слишком короткий запрос', 'Введи минимум 2 символа для поиска по нику');
      return;
    }
    setSearching(true);
    setSearched(false);

    const { data: blockedData } = await supabase
      .from('blocks')
      .select('blocked_id')
      .eq('blocker_id', store.userId);
    const blockedIds = (blockedData || []).map(b => b.blocked_id);

    let query = supabase.from('users')
      .select('user_id, username, level, avatar_url, status, labels')
      .neq('user_id', store.userId);
    if (blockedIds.length > 0) query = query.not('user_id', 'in', `(${blockedIds.join(',')})`);
    if (nick) query = query.ilike('username', `%${nick}%`);
    if (selectedLabels.length > 0) query = query.overlaps('labels', selectedLabels);
    query = query.limit(50);

    const { data, error } = await query;
    setSearching(false);
    setSearched(true);
    if (error) { Alert.alert('Ошибка', 'Не удалось выполнить поиск'); return; }
    setResults(data || []);
  };

  const openProfile = (user) => navigation.navigate('UserProfile', { user });

  const renderFriends = () => {
    if (loadingFriends) {
      return <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />;
    }
    return (
      <>
        {requests.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Входящие заявки</Text>
            {requests.map(user => (
              <View key={user.user_id} style={styles.personCard}>
                <TouchableOpacity style={styles.personLeft} onPress={() => openProfile(user)}>
                  <Avatar
                    uri={user.avatar_url} username={user.username} level={user.level} size={44}
                    isOnline={user.last_seen && (Date.now() - new Date(user.last_seen).getTime()) < 3 * 60 * 1000}
                  />
                  <View style={styles.personInfo}>
                    <Text style={[styles.personName, { color: LEVEL_COLORS[user.level] || colors.accent }]}>
                      {user.username}
                    </Text>
                    {user.status ? <Text style={styles.personSub}>{user.status}</Text> : null}
                  </View>
                </TouchableOpacity>
                <View style={styles.requestBtns}>
                  <TouchableOpacity style={styles.acceptBtn} onPress={() => acceptRequest(user)}>
                    <Ionicons name="checkmark" size={18} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.rejectBtn} onPress={() => rejectRequest(user)}>
                    <Ionicons name="close" size={18} color={colors.pink} />
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
              <View key={friend.user_id} style={styles.personCard}>
                <TouchableOpacity style={styles.personLeft} onPress={() => openProfile(friend)}>
                  <Avatar
                    uri={friend.avatar_url} username={friend.username} level={friend.level} size={44}
                    isOnline={friend.last_seen && (Date.now() - new Date(friend.last_seen).getTime()) < 3 * 60 * 1000}
                  />
                  <View style={styles.personInfo}>
                    <Text style={[styles.personName, { color: LEVEL_COLORS[friend.level] || colors.accent }]}>
                      {friend.username}
                    </Text>
                    {friend.status ? <Text style={styles.personSub}>{friend.status}</Text> : null}
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.dmBtn}
                  onPress={() => navigation.navigate('DirectMessage', {
                    friend: { username: friend.username, userId: friend.user_id, level: friend.level, avatarUrl: friend.avatar_url },
                  })}
                >
                  <Ionicons name="chatbubble-outline" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {friends.length === 0 && requests.length === 0 && (
          <View style={styles.empty}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="people-outline" size={32} color={colors.muted} />
            </View>
            <Text style={styles.emptyTitle}>Пока нет друзей</Text>
            <Text style={styles.emptyHint}>Найди своих во вкладке Поиск</Text>
          </View>
        )}
      </>
    );
  };

  const renderSearch = () => (
    <>
      <View style={styles.searchField}>
        <Ionicons name="search-outline" size={18} color={colors.muted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Поиск по нику..."
          placeholderTextColor={colors.muted}
          value={searchNick}
          onChangeText={setSearchNick}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <Text style={styles.labelsHint}>Или выбери ярлыки</Text>
      <View style={styles.labelsRow}>
        {LABELS.map(label => (
          <TouchableOpacity
            key={label}
            style={[styles.labelChip, selectedLabels.includes(label) && styles.labelChipActive]}
            onPress={() => toggleLabel(label)}
            activeOpacity={0.7}
          >
            <Text style={[styles.labelText, selectedLabels.includes(label) && styles.labelTextActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[
          styles.searchBtn,
          (!searchNick.trim() && selectedLabels.length === 0) && styles.searchBtnDisabled,
        ]}
        onPress={search}
        disabled={(!searchNick.trim() && selectedLabels.length === 0) || searching}
        activeOpacity={0.8}
      >
        {searching
          ? <ActivityIndicator color={colors.white} />
          : <Text style={styles.searchBtnText}>Найти</Text>
        }
      </TouchableOpacity>

      {searched && results.length === 0 && (
        <Text style={styles.noResults}>Никого не нашлось</Text>
      )}

      {results.map(user => (
        <TouchableOpacity key={user.user_id} style={styles.personCard} onPress={() => openProfile(user)}>
          <Avatar uri={user.avatar_url} username={user.username} level={user.level} size={44} />
          <View style={styles.personInfo}>
            <Text style={[styles.personName, { color: LEVEL_COLORS[user.level] || colors.accent }]}>
              {user.username}
            </Text>
            {user.status ? <Text style={styles.personSub}>{user.status}</Text> : null}
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </TouchableOpacity>
      ))}
    </>
  );

  const requestsBadge = requests.length > 0;

  return (
    <View style={styles.safeArea}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Свои</Text>

        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabBtn, tab === 'friends' && styles.tabBtnActive]}
            onPress={() => { setTab('friends'); setSearched(false); setResults([]); }}
          >
            <Text style={[styles.tabLabel, tab === 'friends' && styles.tabLabelActive]}>
              Друзья{requestsBadge ? ' ●' : ''}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, tab === 'search' && styles.tabBtnActive]}
            onPress={() => setTab('search')}
          >
            <Text style={[styles.tabLabel, tab === 'search' && styles.tabLabelActive]}>Поиск</Text>
          </TouchableOpacity>
        </View>

        {tab === 'friends' ? renderFriends() : renderSearch()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: 'bold', color: colors.white, marginBottom: 16 },

  tabBar: {
    flexDirection: 'row', backgroundColor: colors.card,
    borderRadius: 14, padding: 4, marginBottom: 20,
  },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 11, alignItems: 'center' },
  tabBtnActive: { backgroundColor: colors.accent },
  tabLabel: { color: colors.muted, fontWeight: '600', fontSize: 15 },
  tabLabelActive: { color: colors.white },

  section: { marginBottom: 8 },
  sectionTitle: {
    color: colors.muted, fontSize: 12, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.6,
    marginBottom: 10, paddingLeft: 2,
  },

  personCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.card, borderRadius: 14,
    padding: 14, marginBottom: 8, gap: 12,
  },
  personLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  personInfo: { flex: 1 },
  personName: { fontSize: 15, fontWeight: '600' },
  personSub: { color: colors.muted, fontSize: 12, marginTop: 2 },

  requestBtns: { flexDirection: 'row', gap: 8 },
  acceptBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#4CAF50', alignItems: 'center', justifyContent: 'center',
  },
  rejectBtn: {
    width: 36, height: 36, borderRadius: 10,
    borderWidth: 1, borderColor: colors.pink,
    alignItems: 'center', justifyContent: 'center',
  },

  dmBtn: {
    backgroundColor: colors.accent, borderRadius: 10,
    width: 36, height: 36, alignItems: 'center', justifyContent: 'center',
  },

  empty: { alignItems: 'center', marginTop: 56, gap: 10 },
  emptyIconWrap: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.card,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { color: colors.white, fontSize: 17, fontWeight: '600' },
  emptyHint: { color: colors.muted, fontSize: 14 },

  // Search
  searchField: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.card, borderRadius: 14,
    paddingHorizontal: 14, marginBottom: 16,
    borderWidth: 1, borderColor: colors.border,
  },
  searchIcon: { marginRight: 10 },
  searchInput: {
    flex: 1, color: colors.white, fontSize: 16, paddingVertical: 14,
  },
  labelsHint: { color: colors.muted, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  labelsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  labelChip: {
    borderWidth: 1, borderColor: colors.border,
    borderRadius: 20, paddingVertical: 7, paddingHorizontal: 14,
    backgroundColor: colors.card,
  },
  labelChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  labelText: { color: colors.muted, fontSize: 14 },
  labelTextActive: { color: colors.white },
  searchBtn: {
    backgroundColor: colors.accent, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center', marginBottom: 8,
  },
  searchBtnDisabled: { opacity: 0.35 },
  searchBtnText: { color: colors.white, fontSize: 16, fontWeight: '600' },
  noResults: { color: colors.muted, textAlign: 'center', marginTop: 24, fontSize: 15 },
});
