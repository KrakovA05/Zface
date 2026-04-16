import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  FlatList, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';
import { store } from '../store';
import { LEVEL_COLORS } from '../constants';
import { colors } from '../theme';
import Avatar from '../components/Avatar';

// ─── Global Chat ─────────────────────────────────────────────────────────────

function GlobalChat() {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [avatarMap, setAvatarMap] = useState({});
  const fetchedUsers = useRef(new Set());

  useEffect(() => {
    fetchMessages();
    const sub = supabase
      .channel('global_messages')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: 'level=eq.global',
      }, payload => {
        setMessages(prev => [payload.new, ...prev]);
        fetchAvatars([payload.new]);
      })
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  const fetchAvatars = async (msgs) => {
    const toFetch = [...new Set(msgs.map(m => m.username))].filter(u => !fetchedUsers.current.has(u));
    if (!toFetch.length) return;
    toFetch.forEach(u => fetchedUsers.current.add(u));
    const { data } = await supabase.from('users').select('username, avatar_url').in('username', toFetch);
    if (data) {
      const newEntries = {};
      data.forEach(u => { newEntries[u.username] = u.avatar_url; });
      setAvatarMap(prev => ({ ...prev, ...newEntries }));
    }
  };

  const fetchMessages = async () => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('level', 'global')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) { Alert.alert('Ошибка', 'Не удалось загрузить сообщения'); return; }
    if (data) { setMessages(data); fetchAvatars(data); }
  };

  const sendMessage = async () => {
    const trimmed = text.trim();
    if (!trimmed || !store.username) return;
    setText('');
    const { error } = await supabase.from('messages').insert({
      username: store.username,
      text: trimmed,
      level: 'global',
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
          <View style={styles.messageRow}>
            <Avatar uri={avatarMap[item.username]} username={item.username} level={item.level} size={36} />
            <View style={styles.messageBody}>
              <Text style={[styles.messageUser, { color: LEVEL_COLORS[item.level] || colors.accent }]}>
                {item.username}
              </Text>
              <Text style={styles.messageText}>{item.text}</Text>
            </View>
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

// ─── ChatScreen ───────────────────────────────────────────────────────────────

export default function ChatScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.title}>💬 Общий чат</Text>
      </View>
      <GlobalChat />
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
  // Global chat messages
  messageRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    marginBottom: 8, marginHorizontal: 16,
  },
  messageBody: {
    flex: 1, backgroundColor: colors.card, borderRadius: 12,
    padding: 12, marginLeft: 8,
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

});
