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
import { markRead } from '../utils/unread';
import Avatar from '../components/Avatar';
import ChatActionMenu from '../components/ChatActionMenu';

function formatTime(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function groupReactions(list) {
  const g = {};
  (list || []).forEach(r => {
    if (!g[r.emoji]) g[r.emoji] = { count: 0, hasMe: false };
    g[r.emoji].count++;
    if (r.user_id === store.userId) g[r.emoji].hasMe = true;
  });
  return Object.entries(g).map(([emoji, d]) => ({ emoji, ...d }));
}

function ReplyQuote({ username, text }) {
  return (
    <View style={s.replyQuote}>
      <View style={s.replyAccent} />
      <View style={{ flex: 1 }}>
        <Text style={s.replyAuthor}>{username}</Text>
        <Text style={s.replyPreview} numberOfLines={1}>{text}</Text>
      </View>
    </View>
  );
}

function GlobalChat({ navigation }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [avatarMap, setAvatarMap] = useState({});
  const [kbHeight, setKbHeight] = useState(0);
  const [menuMsg, setMenuMsg] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [editing, setEditing] = useState(null);
  const [reactions, setReactions] = useState({});
  const fetchedUsers = useRef(new Set());
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const showEv = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEv = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEv, e => setKbHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener(hideEv, () => setKbHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  useEffect(() => {
    fetchMessages();
    const sub = supabase.channel('global_messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: 'level=eq.global' }, payload => {
        setMessages(prev => [payload.new, ...prev]);
        fetchAvatars([payload.new]);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: 'level=eq.global' }, payload => {
        setMessages(prev => prev.map(m => m.id === payload.new.id ? payload.new : m));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages', filter: 'level=eq.global' }, payload => {
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
      const e = {};
      data.forEach(u => { e[u.username] = u.avatar_url; });
      setAvatarMap(prev => ({ ...prev, ...e }));
    }
  };

  const fetchMessages = async () => {
    const { data } = await supabase.from('messages').select('*')
      .eq('level', 'global').order('created_at', { ascending: false }).limit(50);
    if (data) { setMessages(data); fetchAvatars(data); loadReactions(data); }
    await markRead('global');
    store.refreshBadges?.();
  };

  const loadReactions = async (msgs) => {
    if (!msgs.length) return;
    const { data } = await supabase.from('message_reactions')
      .select('message_id, emoji, user_id')
      .in('message_id', msgs.map(m => m.id))
      .eq('message_table', 'messages');
    if (data) {
      const map = {};
      data.forEach(r => { if (!map[r.message_id]) map[r.message_id] = []; map[r.message_id].push(r); });
      setReactions(prev => ({ ...prev, ...map }));
    }
  };

  const send = async () => {
    if (editing) { await saveEdit(); return; }
    const trimmed = text.trim();
    if (!trimmed || !store.username) return;
    setText('');
    const payload = { username: store.username, text: trimmed, level: 'global', sender_id: store.userId };
    if (replyTo) {
      payload.reply_to_id = replyTo.id;
      payload.reply_to_text = replyTo.text;
      payload.reply_to_username = replyTo.username;
      setReplyTo(null);
    }
    const { error } = await supabase.from('messages').insert(payload);
    if (error) { setText(trimmed); Alert.alert('Ошибка', 'Не удалось отправить сообщение'); }
  };

  const saveEdit = async () => {
    const trimmed = text.trim();
    if (!trimmed || !editing) return;
    await supabase.from('messages').update({ text: trimmed, edited_at: new Date().toISOString() })
      .eq('id', editing.id).eq('sender_id', store.userId);
    setMessages(prev => prev.map(m => m.id === editing.id ? { ...m, text: trimmed, edited_at: new Date().toISOString() } : m));
    setText(''); setEditing(null);
  };

  const deleteMessage = async (item) => {
    await supabase.from('messages').delete().eq('id', item.id);
    setMessages(prev => prev.filter(m => m.id !== item.id));
  };

  const toggleReaction = async (messageId, emoji) => {
    const list = reactions[messageId] || [];
    const myReaction = list.find(r => r.user_id === store.userId);
    if (myReaction?.emoji === emoji) {
      setReactions(prev => ({ ...prev, [messageId]: (prev[messageId] || []).filter(r => r.user_id !== store.userId) }));
      await supabase.from('message_reactions').delete()
        .eq('message_id', messageId).eq('message_table', 'messages').eq('user_id', store.userId);
    } else {
      const r = { message_id: messageId, message_table: 'messages', user_id: store.userId, emoji };
      setReactions(prev => ({ ...prev, [messageId]: [...(prev[messageId] || []).filter(x => x.user_id !== store.userId), r] }));
      await supabase.from('message_reactions').upsert(r, { onConflict: 'message_id,message_table,user_id' });
    }
  };

  const startEdit = (item) => { setEditing(item); setText(item.text); setReplyTo(null); };
  const startReply = (item) => { setReplyTo(item); setEditing(null); };
  const cancelContext = () => { setEditing(null); setReplyTo(null); setText(''); };

  return (
    <View style={[s.flex, { marginBottom: kbHeight }]}>
      <FlatList
        style={s.flex}
        data={messages}
        inverted
        keyExtractor={item => String(item.id)}
        contentContainerStyle={s.list}
        renderItem={({ item }) => {
          const isMe = item.sender_id === store.userId || item.username === store.username;
          const avatarUri = isMe ? store.avatarUrl : avatarMap[item.username];
          const rxs = groupReactions(reactions[item.id]);
          return (
            <View>
              <TouchableOpacity
                onLongPress={() => setMenuMsg(item)}
                activeOpacity={0.8}
                delayLongPress={350}
              >
                <View style={[s.msgRow, isMe && s.msgRowMe]}>
                  <TouchableOpacity onPress={() => navigation.navigate('UserProfile', { user: { user_id: item.sender_id, username: item.username, level: item.level, avatar_url: avatarUri || null, status: '' } })}>
                    <Avatar uri={avatarUri} username={item.username} level={item.level} size={32} />
                  </TouchableOpacity>
                  <View style={[s.bubble, isMe ? s.bubbleMe : s.bubbleOther]}>
                    {!isMe && <Text style={[s.bubbleUsername, { color: LEVEL_COLORS[item.level] || colors.accent }]}>{item.username}</Text>}
                    {item.reply_to_text && <ReplyQuote username={item.reply_to_username} text={item.reply_to_text} />}
                    <Text style={s.bubbleText}>{item.text}</Text>
                    <View style={s.bubbleFoot}>
                      {item.edited_at && <Text style={s.editedLabel}>ред.</Text>}
                      <Text style={s.bubbleTime}>{formatTime(item.created_at)}</Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
              {rxs.length > 0 && (
                <View style={[s.reactRow, isMe ? s.reactRowMe : s.reactRowOther]}>
                  {rxs.map(({ emoji, count, hasMe }) => (
                    <TouchableOpacity key={emoji} style={[s.reactPill, hasMe && s.reactPillMe]} onPress={() => toggleReaction(item.id, emoji)}>
                      <Text style={s.reactEmoji}>{emoji}</Text>
                      <Text style={s.reactCount}>{count}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          );
        }}
      />

      {(replyTo || editing) && (
        <View style={s.contextBar}>
          <Ionicons name={editing ? 'pencil-outline' : 'return-down-forward-outline'} size={14} color={colors.accent} />
          <View style={{ flex: 1 }}>
            {editing
              ? <Text style={s.contextLabel}>Редактирование</Text>
              : <>
                  <Text style={s.contextLabel}>{replyTo.username}</Text>
                  <Text style={s.contextSub} numberOfLines={1}>{replyTo.text}</Text>
                </>
            }
          </View>
          <TouchableOpacity onPress={cancelContext}>
            <Ionicons name="close" size={18} color={colors.muted} />
          </TouchableOpacity>
        </View>
      )}

      <View style={[s.inputRow, { paddingBottom: kbHeight > 0 ? 12 : Math.max(insets.bottom, 12) }]}>
        <TextInput
          style={s.input}
          placeholder={editing ? 'Редактировать...' : 'Напиши что-нибудь...'}
          placeholderTextColor={colors.muted}
          value={text}
          onChangeText={setText}
          maxLength={500}
        />
        <TouchableOpacity style={[s.sendBtn, !text.trim() && s.sendBtnOff]} onPress={send} disabled={!text.trim()}>
          <Ionicons name={editing ? 'checkmark' : 'arrow-up'} size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <ChatActionMenu
        message={menuMsg}
        isOwn={menuMsg ? (menuMsg.sender_id === store.userId || menuMsg.username === store.username) : false}
        onClose={() => setMenuMsg(null)}
        onReply={() => startReply(menuMsg)}
        onEdit={() => startEdit(menuMsg)}
        onDelete={() => { deleteMessage(menuMsg); setMenuMsg(null); }}
        onReact={(emoji) => toggleReaction(menuMsg.id, emoji)}
      />
    </View>
  );
}

export default function ChatScreen({ navigation }) {
  return (
    <View style={s.safeArea}>
      <View style={s.header}><Text style={s.title}>Общий чат</Text></View>
      <GlobalChat navigation={navigation} />
    </View>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  title: { fontSize: 20, fontWeight: 'bold', color: colors.white, marginBottom: 12 },

  list: { padding: 16, paddingBottom: 8 },
  msgRow: { flexDirection: 'row', marginBottom: 4, alignItems: 'flex-end', gap: 8 },
  msgRowMe: { flexDirection: 'row-reverse' },
  bubble: { maxWidth: '75%', borderRadius: 16, padding: 12 },
  bubbleOther: { backgroundColor: colors.card, borderBottomLeftRadius: 4 },
  bubbleMe: { backgroundColor: '#EDE8FF', borderBottomRightRadius: 4 },
  bubbleUsername: { fontSize: 11, fontWeight: '600', marginBottom: 4 },
  bubbleText: { color: colors.white, fontSize: 15, lineHeight: 21 },
  bubbleFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 3 },
  editedLabel: { fontSize: 10, color: 'rgba(0,0,0,0.3)', fontStyle: 'italic' },
  bubbleTime: { fontSize: 10, color: 'rgba(0,0,0,0.35)' },

  replyQuote: { flexDirection: 'row', gap: 6, marginBottom: 6, backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 8, padding: 6 },
  replyAccent: { width: 2, borderRadius: 2, backgroundColor: colors.accent },
  replyAuthor: { fontSize: 11, fontWeight: '700', color: colors.accent, marginBottom: 1 },
  replyPreview: { fontSize: 12, color: colors.muted },

  reactRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 8, paddingHorizontal: 44 },
  reactRowMe: { justifyContent: 'flex-end' },
  reactRowOther: { justifyContent: 'flex-start' },
  reactPill: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.card, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: colors.border },
  reactPillMe: { borderColor: colors.accent, backgroundColor: colors.accent + '18' },
  reactEmoji: { fontSize: 14 },
  reactCount: { fontSize: 12, color: colors.white, fontWeight: '600' },

  contextBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border },
  contextLabel: { fontSize: 12, fontWeight: '700', color: colors.accent },
  contextSub: { fontSize: 12, color: colors.muted, marginTop: 1 },

  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(0,0,0,0.06)' },
  input: { flex: 1, backgroundColor: 'rgba(0,0,0,0.04)', borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, color: colors.white, fontSize: 15 },
  sendBtn: { backgroundColor: colors.accent, borderRadius: 22, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  sendBtnOff: { opacity: 0.4 },
});
