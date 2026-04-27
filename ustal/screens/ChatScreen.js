import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  FlatList, Alert, Keyboard, Platform,
} from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../supabase';
import { store } from '../store';
import { LEVEL_COLORS } from '../constants';
import { colors } from '../theme';
import Avatar from '../components/Avatar';

function GlobalChat({ navigation }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [avatarMap, setAvatarMap] = useState({});
  const [kbHeight, setKbHeight] = useState(0);
  const fetchedUsers = useRef(new Set());
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, e => setKbHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener(hideEvent, () => setKbHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

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
      .on('postgres_changes', {
        event: 'DELETE', schema: 'public', table: 'messages',
        filter: 'level=eq.global',
      }, payload => {
        setMessages(prev => prev.filter(m => m.id !== payload.old.id));
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
      sender_id: store.userId,
    });
    if (error) {
      setText(trimmed);
      Alert.alert('Ошибка', 'Не удалось отправить сообщение');
    }
  };

  const deleteMessage = (item) => {
    const isOwn = item.sender_id === store.userId || item.username === store.username;
    if (!isOwn) return;
    Alert.alert('Удалить сообщение', 'Удалить это сообщение?', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить', style: 'destructive',
        onPress: async () => {
          await supabase.from('messages').delete().eq('id', item.id);
          setMessages(prev => prev.filter(m => m.id !== item.id));
        },
      },
    ]);
  };

  return (
    <View style={[styles.flex, { marginBottom: kbHeight }]}>
      <FlatList
        style={styles.flex}
        data={messages}
        inverted
        keyExtractor={item => String(item.id)}
        contentContainerStyle={styles.messagesList}
        renderItem={({ item }) => {
          const isMe = item.sender_id === store.userId || item.username === store.username;
          const avatarUri = isMe ? store.avatarUrl : avatarMap[item.username];
          return (
            <TouchableOpacity
              onLongPress={() => deleteMessage(item)}
              activeOpacity={0.8}
              delayLongPress={400}
            >
              <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
                <TouchableOpacity onPress={() => navigation.navigate('UserProfile', { user: { user_id: item.sender_id, username: item.username, level: item.level, avatar_url: avatarUri || null, status: '' } })}>
                  <Avatar uri={avatarUri} username={item.username} level={item.level} size={32} />
                </TouchableOpacity>
                <View style={[styles.msgBubble, isMe ? styles.msgBubbleMe : styles.msgBubbleOther]}>
                  {!isMe && (
                    <Text style={[styles.msgUsername, { color: LEVEL_COLORS[item.level] || colors.accent }]}>
                      {item.username}
                    </Text>
                  )}
                  <Text style={styles.msgText}>{item.text}</Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />
      <View style={[styles.inputRow, { paddingBottom: kbHeight > 0 ? 12 : Math.max(insets.bottom, 12) }]}>
        <TextInput
          style={styles.input}
          placeholder="Напиши что-нибудь..."
          placeholderTextColor={colors.muted}
          value={text}
          onChangeText={setText}
          maxLength={500}
        />
        <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
          <Ionicons name="arrow-up" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function ChatScreen({ navigation }) {
  return (
    <View style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.title}>Общий чат</Text>
      </View>
      <GlobalChat navigation={navigation} />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  title: { fontSize: 20, fontWeight: 'bold', color: colors.white, marginBottom: 12 },

  messagesList: { padding: 16, paddingBottom: 8 },
  msgRow: { flexDirection: 'row', marginBottom: 10, alignItems: 'flex-end', gap: 8 },
  msgRowMe: { flexDirection: 'row-reverse' },
  msgBubble: { maxWidth: '75%', borderRadius: 16, padding: 12 },
  msgBubbleOther: { backgroundColor: colors.card, borderBottomLeftRadius: 4 },
  msgBubbleMe: { backgroundColor: colors.accent, borderBottomRightRadius: 4 },
  msgUsername: { fontSize: 11, fontWeight: '600', marginBottom: 4 },
  msgText: { color: colors.white, fontSize: 15, lineHeight: 21 },

  inputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingBottom: 12, paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.08)',
  },
  input: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 22,
    paddingHorizontal: 16, paddingVertical: 10, color: colors.white, fontSize: 15,
  },
  sendButton: {
    backgroundColor: colors.accent, borderRadius: 22,
    width: 44, height: 44, alignItems: 'center', justifyContent: 'center',
  },
});
