import {
  StyleSheet, Text, View, FlatList, TouchableOpacity,
  TextInput, ActivityIndicator, ScrollView, Alert, Keyboard, Platform,
} from 'react-native';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../supabase';
import { store } from '../store';
import { colors } from '../theme';
import { markRead } from '../utils/unread';
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

function ReplyQuote({ username, text }) {
  return (
    <View style={styles.replyQuote}>
      <View style={styles.replyAccent} />
      <View style={{ flex: 1 }}>
        <Text style={styles.replyAuthor}>{username}</Text>
        <Text style={styles.replyPreview} numberOfLines={1}>{text}</Text>
      </View>
    </View>
  );
}

const TABLES = [
  { id: 'main',   label: 'Общий бар',        desc: 'Для всех',               icon: 'wine-outline',          seats: 20 },
  { id: 'quiet',  label: 'Тихий уголок',      desc: 'Спокойные разговоры',    icon: 'moon-outline',          seats: 6  },
  { id: 'music',  label: 'Музыкальный стол',  desc: 'Обсуждаем музыку',       icon: 'musical-notes-outline', seats: 8  },
  { id: 'random', label: 'Случайные темы',    desc: 'Говорим обо всём',        icon: 'shuffle-outline',       seats: 10 },
];

function formatTime(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

export default function BarScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const [table, setTable] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [kbHeight, setKbHeight] = useState(0);
  const [sending, setSending] = useState(false);
  const [visitors, setVisitors] = useState({});
  const [menuMsg, setMenuMsg] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [editing, setEditing] = useState(null);
  const [reactions, setReactions] = useState({});
  const flatRef = useRef(null);
  const channelRef = useRef(null);

  useFocusEffect(useCallback(() => {
    const loadVisitors = async () => {
      const counts = {};
      for (const t of TABLES) {
        const { count } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('level', `bar_${t.id}`)
          .gte('created_at', new Date(Date.now() - 3600000).toISOString());
        counts[t.id] = count || 0;
      }
      setVisitors(counts);
    };
    loadVisitors();
  }, []));

  useEffect(() => {
    if (route?.params?.openTable) enterTable(route.params.openTable);
  }, []);

  const enterTable = async (tableId) => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    setMessages([]);
    setTable(tableId);
    await markRead(`bar_${tableId}`);

    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('level', `bar_${tableId}`)
      .order('created_at', { ascending: false })
      .limit(60);
    const msgs = (data || []).reverse();
    setMessages(msgs);
    loadReactions(msgs);

    const channel = supabase
      .channel(`bar_${tableId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `level=eq.bar_${tableId}`,
      }, (payload) => {
        setMessages(prev => [...prev, payload.new]);
        setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'messages',
        filter: `level=eq.bar_${tableId}`,
      }, (payload) => {
        setMessages(prev => prev.map(m => m.id === payload.new.id ? payload.new : m));
      })
      .on('postgres_changes', {
        event: 'DELETE', schema: 'public', table: 'messages',
        filter: `level=eq.bar_${tableId}`,
      }, (payload) => {
        setMessages(prev => prev.filter(m => m.id !== payload.old.id));
      })
      .subscribe();
    channelRef.current = channel;
  };

  useEffect(() => {
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, []);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, e => setKbHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener(hideEvent, () => setKbHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

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
    if (!text.trim() || !table) return;
    setSending(true);
    const payload = { username: store.username || 'Гость', text: text.trim(), level: `bar_${table}`, sender_id: store.userId };
    if (replyTo) {
      payload.reply_to_id = replyTo.id;
      payload.reply_to_text = replyTo.text;
      payload.reply_to_username = replyTo.username;
      setReplyTo(null);
    }
    await supabase.from('messages').insert(payload);
    setText('');
    setSending(false);
  };

  const saveEdit = async () => {
    const trimmed = text.trim();
    if (!trimmed || !editing) return;
    await supabase.from('messages').update({ text: trimmed, edited_at: new Date().toISOString() })
      .eq('id', editing.id).eq('sender_id', store.userId);
    setMessages(prev => prev.map(m => m.id === editing.id ? { ...m, text: trimmed, edited_at: new Date().toISOString() } : m));
    setText(''); setEditing(null); setSending(false);
  };

  const deleteMessage = async (item) => {
    await supabase.from('messages').delete().eq('id', item.id);
    setMessages(prev => prev.filter(m => m.id !== item.id));
  };

  const toggleReaction = async (messageId, emoji) => {
    const list = reactions[messageId] || [];
    const has = list.find(r => r.emoji === emoji && r.user_id === store.userId);
    if (has) {
      setReactions(prev => ({ ...prev, [messageId]: (prev[messageId] || []).filter(r => !(r.emoji === emoji && r.user_id === store.userId)) }));
      await supabase.from('message_reactions').delete()
        .eq('message_id', messageId).eq('message_table', 'messages').eq('user_id', store.userId).eq('emoji', emoji);
    } else {
      const r = { message_id: messageId, message_table: 'messages', user_id: store.userId, emoji };
      setReactions(prev => ({ ...prev, [messageId]: [...(prev[messageId] || []), r] }));
      await supabase.from('message_reactions').insert(r);
    }
  };

  const startEdit = (item) => { setEditing(item); setText(item.text); setReplyTo(null); };
  const startReply = (item) => { setReplyTo(item); setEditing(null); };
  const cancelContext = () => { setEditing(null); setReplyTo(null); setText(''); };

  if (!table) {
    return (
      <View style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.lobbyContent}>
          <Text style={styles.title}>Онлайн-бар</Text>
          <Text style={styles.subtitle}>Виртуальное место где можно просто побыть</Text>

          {TABLES.map(t => (
            <TouchableOpacity
              key={t.id}
              style={styles.tableCard}
              onPress={() => enterTable(t.id)}
              activeOpacity={0.7}
            >
              <View style={styles.tableIconWrap}>
                <Ionicons name={t.icon} size={22} color={colors.accent} />
              </View>
              <View style={styles.tableInfo}>
                <Text style={styles.tableLabel}>{t.label}</Text>
                <Text style={styles.tableDesc}>{t.desc}</Text>
              </View>
              <View style={styles.tableRight}>
                <View style={[styles.activityDot, { backgroundColor: visitors[t.id] > 0 ? '#4CAF50' : '#444' }]} />
                <Text style={styles.tableCount}>
                  {visitors[t.id] > 0 ? `${visitors[t.id]} сообщ.` : 'тихо'}
                </Text>
              </View>
            </TouchableOpacity>
          ))}

          <View style={styles.tip}>
            <Ionicons name="information-circle-outline" size={15} color={colors.muted} style={{ marginTop: 1 }} />
            <Text style={styles.tipText}>
              Бар работает на базе общего чата. Уровень не важен — здесь все равны.
            </Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  const tableData = TABLES.find(t => t.id === table);

  return (
    <View style={styles.safeArea}>
      <View style={[styles.flex, { marginBottom: kbHeight }]}>
        <View style={styles.tableHeader}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={26} color={colors.white} />
          </TouchableOpacity>
          <View style={[styles.tableHeaderIcon, { backgroundColor: colors.accent + '22' }]}>
            <Ionicons name={tableData.icon} size={18} color={colors.accent} />
          </View>
          <View style={styles.tableHeaderInfo}>
            <Text style={styles.tableHeaderLabel}>{tableData.label}</Text>
            <Text style={styles.tableHeaderDesc}>{tableData.desc}</Text>
          </View>
        </View>

        <FlatList
          ref={flatRef}
          data={messages}
          keyExtractor={item => item.id?.toString()}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => {
            const isMe = item.sender_id === store.userId || item.username === store.username;
            const rxs = groupReactions(reactions[item.id]);
            return (
              <View>
                <TouchableOpacity onLongPress={() => setMenuMsg(item)} activeOpacity={0.8} delayLongPress={350}>
                  <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
                    <TouchableOpacity onPress={() => navigation.navigate('UserProfile', { user: { user_id: item.sender_id, username: item.username, level: isMe ? store.level : null, avatar_url: null, status: '' } })}>
                      <Avatar uri={isMe ? store.avatarUrl : null} username={item.username} level={isMe ? store.level : null} size={30} />
                    </TouchableOpacity>
                    <View style={[styles.msgBubble, isMe ? styles.msgBubbleMe : styles.msgBubbleOther]}>
                      {!isMe && <Text style={[styles.msgUsername, { color: colors.accent }]}>{item.username}</Text>}
                      {item.reply_to_text && <ReplyQuote username={item.reply_to_username} text={item.reply_to_text} />}
                      <Text style={styles.msgText}>{item.text}</Text>
                      <View style={styles.bubbleFoot}>
                        {item.edited_at && <Text style={styles.editedLabel}>ред.</Text>}
                        <Text style={styles.msgTime}>{formatTime(item.created_at)}</Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
                {rxs.length > 0 && (
                  <View style={[styles.reactRow, isMe ? styles.reactRowMe : styles.reactRowOther]}>
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
          ListEmptyComponent={
            <View style={styles.emptyBar}>
              <Ionicons name="moon-outline" size={36} color={colors.muted} style={{ marginBottom: 10 }} />
              <Text style={styles.emptyBarText}>Здесь пока тихо.{'\n'}Начни разговор первым.</Text>
            </View>
          }
        />

        {(replyTo || editing) && (
          <View style={styles.contextBar}>
            <Ionicons name={editing ? 'pencil-outline' : 'return-down-forward-outline'} size={14} color={colors.accent} />
            <View style={{ flex: 1 }}>
              {editing
                ? <Text style={styles.contextLabel}>Редактирование</Text>
                : <>
                    <Text style={styles.contextLabel}>{replyTo.username}</Text>
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
            placeholder={editing ? 'Редактировать...' : 'Что скажешь...'}
            placeholderTextColor={colors.muted}
            value={text}
            onChangeText={setText}
            onSubmitEditing={send}
            returnKeyType="send"
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendBtn, !text.trim() && styles.sendBtnDisabled]}
            onPress={send}
            disabled={!text.trim() || sending}
          >
            {sending
              ? <ActivityIndicator color="#fff" size="small" />
              : <Ionicons name={editing ? 'checkmark' : 'arrow-up'} size={20} color="#fff" />
            }
          </TouchableOpacity>
        </View>
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

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  lobbyContent: { padding: 24, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: 'bold', color: colors.white, marginBottom: 6 },
  subtitle: { fontSize: 15, color: colors.muted, marginBottom: 20 },
  tableCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.card, borderRadius: 16,
    padding: 16, marginBottom: 12, gap: 12,
  },
  tableIconWrap: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: colors.accent + '1a',
    alignItems: 'center', justifyContent: 'center',
  },
  tableInfo: { flex: 1 },
  tableLabel: { fontSize: 15, fontWeight: 'bold', color: colors.white, marginBottom: 3 },
  tableDesc: { fontSize: 13, color: colors.muted },
  tableRight: { alignItems: 'center', gap: 4 },
  activityDot: { width: 8, height: 8, borderRadius: 4 },
  tableCount: { fontSize: 11, color: colors.muted },

  tip: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: colors.card, borderRadius: 12, padding: 14, marginTop: 8,
  },
  tipText: { flex: 1, color: colors.muted, fontSize: 13, lineHeight: 19 },

  tableHeader: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14, borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.06)', gap: 10,
    backgroundColor: colors.background,
  },
  backBtn: { padding: 2 },
  tableHeaderIcon: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  tableHeaderInfo: { flex: 1 },
  tableHeaderLabel: { fontSize: 15, fontWeight: 'bold', color: colors.white },
  tableHeaderDesc: { fontSize: 12, color: colors.muted },

  messagesList: { padding: 16, paddingBottom: 8 },
  msgRow: { flexDirection: 'row', marginBottom: 12, alignItems: 'flex-end', gap: 8 },
  msgRowMe: { flexDirection: 'row-reverse' },
  msgBubble: { maxWidth: '75%', borderRadius: 16, padding: 12 },
  msgBubbleOther: { backgroundColor: colors.card, borderBottomLeftRadius: 4 },
  msgBubbleMe: { backgroundColor: '#EDE8FF', borderBottomRightRadius: 4 },
  msgUsername: { fontSize: 11, fontWeight: '600', marginBottom: 4 },
  msgText: { color: colors.white, fontSize: 15, lineHeight: 21 },
  bubbleFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 3 },
  editedLabel: { fontSize: 10, color: 'rgba(0,0,0,0.3)', fontStyle: 'italic' },
  msgTime: { fontSize: 10, color: 'rgba(0,0,0,0.35)' },
  replyQuote: { flexDirection: 'row', gap: 6, marginBottom: 6, backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 8, padding: 6 },
  replyAccent: { width: 2, borderRadius: 2, backgroundColor: colors.accent },
  replyAuthor: { fontSize: 11, fontWeight: '700', color: colors.accent, marginBottom: 1 },
  replyPreview: { fontSize: 12, color: colors.muted },
  reactRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 8, paddingHorizontal: 42 },
  reactRowMe: { justifyContent: 'flex-end' },
  reactRowOther: { justifyContent: 'flex-start' },
  reactPill: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.card, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: colors.border },
  reactPillMe: { borderColor: colors.accent, backgroundColor: colors.accent + '18' },
  reactEmoji: { fontSize: 14 },
  reactCount: { fontSize: 12, color: colors.white, fontWeight: '600' },
  contextBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border },
  contextLabel: { fontSize: 12, fontWeight: '700', color: colors.accent },
  contextSub: { fontSize: 12, color: colors.muted, marginTop: 1 },
  emptyBar: { alignItems: 'center', marginTop: 60 },
  emptyBarText: { color: colors.muted, fontSize: 15, textAlign: 'center', lineHeight: 22 },

  inputRow: {
    flexDirection: 'row', padding: 12, gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(0,0,0,0.06)',
    alignItems: 'center',
  },
  input: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.04)', borderRadius: 22,
    paddingHorizontal: 16, paddingVertical: 10,
    color: colors.white, fontSize: 15,
  },
  sendBtn: { backgroundColor: colors.accent, borderRadius: 22, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { opacity: 0.4 },
});
