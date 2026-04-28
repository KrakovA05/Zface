import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  FlatList, Alert, Keyboard, Platform,
} from 'react-native';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../supabase';
import { store } from '../store';
import { LEVEL_COLORS } from '../constants';
import { colors } from '../theme';
import { getConversationId } from '../utils';
import { markRead } from '../utils/unread';
import { sendPushNotification } from '../utils/notifications';
import Avatar from '../components/Avatar';
import ChatActionMenu from '../components/ChatActionMenu';

function groupReactions(list) {
  const g = {};
  (list || []).forEach(r => {
    if (!g[r.emoji]) g[r.emoji] = { count: 0, hasMe: false };
    g[r.emoji].count++;
    if (r.user_id === store.userId) g[r.emoji].hasMe = true;
  });
  return Object.entries(g).map(([emoji, d]) => ({ emoji, ...d }));
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

export default function DirectMessageScreen({ route, navigation }) {
  const { friend } = route.params;
  const conversationId = getConversationId(store.userId, friend.userId);
  const insets = useSafeAreaInsets();

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [friendOnline, setFriendOnline] = useState(false);
  const [kbHeight, setKbHeight] = useState(0);
  const [menuMsg, setMenuMsg] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [editing, setEditing] = useState(null);
  const [reactions, setReactions] = useState({});

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, e => setKbHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener(hideEvent, () => setKbHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  useEffect(() => {
    markRead(`dm_${conversationId}`).then(() => store.refreshBadges?.());
    fetchMessages().then(msgs => { if (msgs) loadReactions(msgs); });
    fetchFriendOnline();

    const subscription = supabase
      .channel(`dm_${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'direct_messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, payload => {
        setMessages(prev => [payload.new, ...prev]);
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'direct_messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, payload => {
        setMessages(prev => prev.filter(m => m.id !== payload.old.id));
      })
      .subscribe();

    return () => { subscription.unsubscribe(); };
  }, []);

  const fetchFriendOnline = async () => {
    const { data } = await supabase
      .from('users')
      .select('last_seen')
      .eq('user_id', friend.userId)
      .single();
    if (data?.last_seen) {
      setFriendOnline((Date.now() - new Date(data.last_seen).getTime()) < 3 * 60 * 1000);
    }
  };

  const fetchMessages = async () => {
    const { data, error } = await supabase
      .from('direct_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) { Alert.alert('Ошибка', 'Не удалось загрузить сообщения'); return null; }
    if (data) setMessages(data);
    return data;
  };

  const loadReactions = async (msgs) => {
    if (!msgs?.length) return;
    const { data } = await supabase.from('message_reactions')
      .select('message_id, emoji, user_id')
      .in('message_id', msgs.map(m => m.id))
      .eq('message_table', 'direct_messages');
    if (data) {
      const map = {};
      data.forEach(r => { if (!map[r.message_id]) map[r.message_id] = []; map[r.message_id].push(r); });
      setReactions(prev => ({ ...prev, ...map }));
    }
  };

  const toggleReaction = async (messageId, emoji) => {
    const list = reactions[messageId] || [];
    const has = list.find(r => r.emoji === emoji && r.user_id === store.userId);
    if (has) {
      setReactions(prev => ({ ...prev, [messageId]: (prev[messageId] || []).filter(r => !(r.emoji === emoji && r.user_id === store.userId)) }));
      await supabase.from('message_reactions').delete()
        .eq('message_id', messageId).eq('message_table', 'direct_messages').eq('user_id', store.userId).eq('emoji', emoji);
    } else {
      const r = { message_id: messageId, message_table: 'direct_messages', user_id: store.userId, emoji };
      setReactions(prev => ({ ...prev, [messageId]: [...(prev[messageId] || []), r] }));
      await supabase.from('message_reactions').insert(r);
    }
  };

  const startEdit = (item) => { setEditing(item); setText(item.text); setReplyTo(null); };
  const startReply = (item) => { setReplyTo(item); setEditing(null); };
  const cancelContext = () => { setEditing(null); setReplyTo(null); setText(''); };

  const sendMessage = async () => {
    if (editing) { await saveEdit(); return; }
    const trimmed = text.trim();
    if (!trimmed) return;

    const { data: block } = await supabase
      .from('blocks').select('id')
      .eq('blocker_id', store.userId).eq('blocked_id', friend.userId).maybeSingle();
    if (block) { Alert.alert('Недоступно', 'Вы заблокировали этого пользователя'); return; }

    setText('');
    const payload = { conversation_id: conversationId, sender_id: store.userId, sender_username: store.username, text: trimmed };
    if (replyTo) {
      payload.reply_to_id = replyTo.id;
      payload.reply_to_text = replyTo.text;
      payload.reply_to_username = replyTo.sender_username || replyTo.username;
      setReplyTo(null);
    }
    const { error } = await supabase.from('direct_messages').insert(payload);
    if (error) { setText(trimmed); Alert.alert('Ошибка', 'Не удалось отправить сообщение'); return; }
    const { data: friendData } = await supabase.from('users').select('push_token').eq('user_id', friend.userId).maybeSingle();
    if (friendData?.push_token) sendPushNotification(friendData.push_token, store.username, trimmed);
  };

  const saveEdit = async () => {
    const trimmed = text.trim();
    if (!trimmed || !editing) return;
    await supabase.from('direct_messages').update({ text: trimmed, edited_at: new Date().toISOString() })
      .eq('id', editing.id).eq('sender_id', store.userId);
    setMessages(prev => prev.map(m => m.id === editing.id ? { ...m, text: trimmed, edited_at: new Date().toISOString() } : m));
    setText(''); setEditing(null);
  };

  const deleteMessage = async (id) => {
    await supabase.from('direct_messages').delete().eq('id', id).eq('sender_id', store.userId);
    setMessages(prev => prev.filter(m => m.id !== id));
  };

  return (
    <View style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={26} color={colors.white} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Avatar
            uri={friend.avatarUrl}
            username={friend.username}
            level={friend.level}
            size={34}
            isOnline={friendOnline}
          />
          <View>
            <Text style={[styles.headerName, { color: LEVEL_COLORS[friend.level] || colors.accent }]}>
              {friend.username}
            </Text>
            {friendOnline && <Text style={styles.onlineLabel}>онлайн</Text>}
          </View>
        </View>
        <View style={styles.backButton} />
      </View>

      {/* Chat + Input */}
      <View style={[styles.flex, { marginBottom: kbHeight }]}>
        <FlatList
          style={styles.flex}
          data={messages}
          inverted
          keyExtractor={item => String(item.id)}
          contentContainerStyle={styles.messageList}
          renderItem={({ item }) => {
            const isOwn = item.sender_id === store.userId;
            const rxs = groupReactions(reactions[item.id]);
            return (
              <View>
                <TouchableOpacity onLongPress={() => setMenuMsg(item)} activeOpacity={0.8} delayLongPress={350}>
                  <View style={[styles.bubbleWrap, isOwn ? styles.bubbleWrapOwn : styles.bubbleWrapOther]}>
                    <TouchableOpacity
                      onPress={!isOwn ? () => navigation.navigate('UserProfile', { user: { user_id: friend.userId, username: friend.username, level: friend.level, avatar_url: friend.avatarUrl || null, status: '' } }) : undefined}
                      activeOpacity={isOwn ? 1 : 0.7}
                    >
                      <Avatar uri={isOwn ? store.avatarUrl : friend.avatarUrl} username={isOwn ? store.username : friend.username} level={isOwn ? store.level : friend.level} size={30} />
                    </TouchableOpacity>
                    <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther]}>
                      {item.reply_to_text && (
                        <View style={styles.replyQuote}>
                          <View style={styles.replyAccent} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.replyAuthor}>{item.reply_to_username}</Text>
                            <Text style={styles.replyPreview} numberOfLines={1}>{item.reply_to_text}</Text>
                          </View>
                        </View>
                      )}
                      <Text style={styles.bubbleText}>{item.text}</Text>
                      <View style={styles.bubbleFoot}>
                        {item.edited_at && <Text style={styles.editedLabel}>ред.</Text>}
                        <Text style={styles.msgTime}>{formatTime(item.created_at)}</Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
                {rxs.length > 0 && (
                  <View style={[styles.reactRow, isOwn ? styles.reactRowMe : styles.reactRowOther]}>
                    {rxs.map(({ emoji, count, hasMe }) => (
                      <TouchableOpacity key={emoji} style={[styles.reactPill, hasMe && styles.reactPillMe]} onPress={() => toggleReaction(item.id, emoji)}>
                        <Text style={styles.reactEmoji}>{emoji}</Text>
                        <Text style={styles.reactCount}>{count}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            );
          }}
        />

        {(replyTo || editing) && (
          <View style={styles.contextBar}>
            <Ionicons name={editing ? 'pencil-outline' : 'return-down-forward-outline'} size={14} color={colors.accent} />
            <View style={{ flex: 1 }}>
              {editing
                ? <Text style={styles.contextLabel}>Редактирование</Text>
                : <>
                    <Text style={styles.contextLabel}>{replyTo.sender_username || replyTo.username}</Text>
                    <Text style={styles.contextSub} numberOfLines={1}>{replyTo.text}</Text>
                  </>
              }
            </View>
            <TouchableOpacity onPress={cancelContext}>
              <Ionicons name="close" size={18} color={colors.muted} />
            </TouchableOpacity>
          </View>
        )}

        <View style={[styles.inputRow, { paddingBottom: kbHeight > 0 ? 12 : Math.max(insets.bottom, 12) }]}>
          <TextInput
            style={styles.input}
            placeholder={editing ? 'Редактировать...' : 'Написать...'}
            placeholderTextColor={colors.muted}
            value={text}
            onChangeText={setText}
            maxLength={500}
          />
          <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
            <Ionicons name={editing ? 'checkmark' : 'arrow-up'} size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <ChatActionMenu
        message={menuMsg}
        isOwn={menuMsg ? menuMsg.sender_id === store.userId : false}
        onClose={() => setMenuMsg(null)}
        onReply={() => startReply(menuMsg)}
        onEdit={() => startEdit(menuMsg)}
        onDelete={() => { deleteMessage(menuMsg.id); setMenuMsg(null); }}
        onReact={(emoji) => toggleReaction(menuMsg.id, emoji)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 40,
  },
  backText: {
    color: colors.white,
    fontSize: 24,
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  headerName: {
    fontSize: 17,
    fontWeight: 'bold',
  },
  onlineLabel: {
    fontSize: 11,
    color: '#4CAF50',
    marginTop: 1,
  },

  // Messages
  messageList: {
    padding: 16,
    paddingBottom: 8,
  },
  bubbleWrap: {
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  bubbleWrapOwn: {
    flexDirection: 'row-reverse',
  },
  bubbleWrapOther: {
    flexDirection: 'row',
  },
  bubble: {
    maxWidth: '75%',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  bubbleOwn: {
    backgroundColor: '#EDE8FF',
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: colors.card,
    borderBottomLeftRadius: 4,
  },
  bubbleText: { color: colors.white, fontSize: 15, lineHeight: 21 },
  bubbleFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 3 },
  editedLabel: { fontSize: 10, color: 'rgba(0,0,0,0.3)', fontStyle: 'italic' },
  msgTime: { fontSize: 10, color: 'rgba(0,0,0,0.35)' },

  replyQuote: { flexDirection: 'row', gap: 6, marginBottom: 6, backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 8, padding: 6 },
  replyAccent: { width: 2, borderRadius: 2, backgroundColor: colors.accent },
  replyAuthor: { fontSize: 11, fontWeight: '700', color: colors.accent, marginBottom: 1 },
  replyPreview: { fontSize: 12, color: colors.muted },

  reactRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 6, paddingHorizontal: 44 },
  reactRowMe: { justifyContent: 'flex-end' },
  reactRowOther: { justifyContent: 'flex-start' },
  reactPill: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.card, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: colors.border },
  reactPillMe: { borderColor: colors.accent, backgroundColor: colors.accent + '18' },
  reactEmoji: { fontSize: 14 },
  reactCount: { fontSize: 12, color: colors.white, fontWeight: '600' },

  contextBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border },
  contextLabel: { fontSize: 12, fontWeight: '700', color: colors.accent },
  contextSub: { fontSize: 12, color: colors.muted, marginTop: 1 },

  // Input
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: colors.white,
    fontSize: 15,
  },
  sendButton: {
    backgroundColor: colors.accent,
    borderRadius: 22,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
