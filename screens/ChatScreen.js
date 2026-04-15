import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  FlatList, KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../supabase';
import { store } from '../store';
import { LEVEL_COLORS } from '../constants';
import { colors } from '../theme';
import Avatar from '../components/Avatar';
import { getConversationId } from '../utils';

// ─── Global Chat ─────────────────────────────────────────────────────────────

function GlobalChat() {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');

  useEffect(() => {
    fetchMessages();
    const sub = supabase
      .channel('global_messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        setMessages(prev => [payload.new, ...prev]);
      })
      .subscribe();
    return () => { sub.unsubscribe(); };
  }, []);

  const fetchMessages = async () => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) { Alert.alert('Ошибка', 'Не удалось загрузить сообщения'); return; }
    if (data) setMessages(data);
  };

  const sendMessage = async () => {
    const trimmed = text.trim();
    if (!trimmed || !store.username) return;
    setText('');
    const { error } = await supabase.from('messages').insert({
      username: store.username,
      text: trimmed,
      level: store.level,
    });
    if (error) {
      setText(trimmed);
      Alert.alert('Ошибка', 'Не удалось отправить сообщение');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <FlatList
        style={styles.flex}
        data={messages}
        inverted
        keyExtractor={item => String(item.id)}
        renderItem={({ item }) => (
          <View style={styles.message}>
            <Text style={[styles.messageUser, { color: LEVEL_COLORS[item.level] || colors.accent }]}>
              {item.username}
            </Text>
            <Text style={styles.messageText}>{item.text}</Text>
          </View>
        )}
      />
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Напиши что-нибудь..."
          placeholderTextColor={colors.muted}
          value={text}
          onChangeText={setText}
        />
        <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
          <Text style={styles.sendText}>→</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── DM List ─────────────────────────────────────────────────────────────────

function DmList({ navigation }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadDmList();
    }, [])
  );

  const loadDmList = async () => {
    if (!store.userId) return;
    setLoading(true);

    // Принятые друзья
    const { data: rows } = await supabase
      .from('friendships')
      .select('*')
      .or(`requester_id.eq.${store.userId},receiver_id.eq.${store.userId}`)
      .eq('status', 'accepted');

    if (!rows?.length) { setItems([]); setLoading(false); return; }

    const friendIds = rows.map(r =>
      r.requester_id === store.userId ? r.receiver_id : r.requester_id
    );

    const { data: friendUsers } = await supabase
      .from('users')
      .select('username, level, user_id, avatar_url, status')
      .in('user_id', friendIds);

    if (!friendUsers?.length) { setItems([]); setLoading(false); return; }

    // Последние сообщения по каждому conversation
    const convIds = friendUsers.map(f => getConversationId(store.userId, f.user_id));

    const { data: msgs } = await supabase
      .from('direct_messages')
      .select('conversation_id, text, created_at, sender_id')
      .in('conversation_id', convIds)
      .order('created_at', { ascending: false });

    // Берём первое (самое свежее) для каждого conversation
    const lastMsg = {};
    (msgs || []).forEach(m => {
      if (!lastMsg[m.conversation_id]) lastMsg[m.conversation_id] = m;
    });

    const list = friendUsers.map(friend => ({
      friend,
      last: lastMsg[getConversationId(store.userId, friend.user_id)] || null,
    }));

    // Сортируем: сначала те, у кого есть сообщения (по времени), потом остальные
    list.sort((a, b) => {
      if (!a.last && !b.last) return 0;
      if (!a.last) return 1;
      if (!b.last) return -1;
      return new Date(b.last.created_at) - new Date(a.last.created_at);
    });

    setItems(list);
    setLoading(false);
  };

  if (loading) {
    return <ActivityIndicator color={colors.accent} style={styles.centered} />;
  }

  if (!items.length) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyEmoji}>💬</Text>
        <Text style={styles.emptyText}>Нет переписок</Text>
        <Text style={styles.emptyHint}>Добавь друзей во вкладке Свои</Text>
      </View>
    );
  }

  return (
    <>
      {items.map(({ friend, last }) => {
        const preview = last
          ? (last.sender_id === store.userId ? `Ты: ${last.text}` : last.text)
          : 'Напиши первым 👋';
        return (
          <TouchableOpacity
            key={friend.user_id}
            style={styles.dmItem}
            onPress={() => navigation.navigate('DirectMessage', {
              friend: { username: friend.username, userId: friend.user_id, level: friend.level },
            })}
          >
            <Avatar uri={friend.avatar_url} username={friend.username} level={friend.level} size={48} />
            <View style={styles.dmInfo}>
              <Text style={[styles.dmName, { color: LEVEL_COLORS[friend.level] || colors.accent }]}>
                {friend.username}
              </Text>
              <Text style={styles.dmPreview} numberOfLines={1}>{preview}</Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </>
  );
}

// ─── ChatScreen ───────────────────────────────────────────────────────────────

export default function ChatScreen({ navigation }) {
  const [tab, setTab] = useState('global');

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.title}>💬 Чат</Text>
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabBtn, tab === 'global' && styles.tabBtnActive]}
            onPress={() => setTab('global')}
          >
            <Text style={[styles.tabLabel, tab === 'global' && styles.tabLabelActive]}>
              Общий
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, tab === 'dms' && styles.tabBtnActive]}
            onPress={() => setTab('dms')}
          >
            <Text style={[styles.tabLabel, tab === 'dms' && styles.tabLabelActive]}>
              Личные
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {tab === 'global'
        ? <GlobalChat />
        : (
          <View style={[styles.flex, styles.dmListContainer]}>
            <DmList navigation={navigation} />
          </View>
        )
      }
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },

  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  title: {
    fontSize: 20, fontWeight: 'bold', color: colors.white, marginBottom: 12,
  },
  tabBar: {
    flexDirection: 'row', backgroundColor: colors.card,
    borderRadius: 12, padding: 4, marginBottom: 8,
  },
  tabBtn: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center' },
  tabBtnActive: { backgroundColor: colors.accent },
  tabLabel: { color: colors.muted, fontWeight: '600', fontSize: 14 },
  tabLabelActive: { color: colors.white },

  // Global chat messages
  message: {
    backgroundColor: colors.card, borderRadius: 12,
    padding: 12, marginBottom: 8, marginHorizontal: 16,
  },
  messageUser: { fontSize: 12, marginBottom: 4, fontWeight: '600' },
  messageText: { color: colors.white, fontSize: 15 },

  // Input
  inputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingBottom: 12, paddingTop: 4,
  },
  input: {
    flex: 1, backgroundColor: colors.card, borderRadius: 12,
    padding: 14, color: colors.white, fontSize: 15,
  },
  sendButton: {
    backgroundColor: colors.accent, borderRadius: 12,
    padding: 14, alignItems: 'center', justifyContent: 'center',
  },
  sendText: { color: colors.white, fontSize: 20 },

  // DM list
  dmListContainer: { paddingHorizontal: 16, paddingTop: 8 },
  centered: { marginTop: 40 },
  empty: { alignItems: 'center', marginTop: 48 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: colors.white, fontSize: 18, fontWeight: '600', marginBottom: 6 },
  emptyHint: { color: colors.muted, fontSize: 14 },
  dmItem: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.card, borderRadius: 16,
    padding: 14, marginBottom: 10,
  },
  dmInfo: { flex: 1, marginLeft: 12 },
  dmName: { fontSize: 15, fontWeight: '600', marginBottom: 4 },
  dmPreview: { color: colors.muted, fontSize: 13 },
});
