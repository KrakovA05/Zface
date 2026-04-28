import {
  StyleSheet, Text, View, FlatList, TouchableOpacity,
  TextInput, ActivityIndicator, ScrollView, Alert, Keyboard, Platform,
} from 'react-native';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../supabase';
import { store } from '../store';
import { LEVEL_COLORS } from '../constants';
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

const ROOMS = [
  { id: 'green',  label: 'Зелёная комната', desc: 'Для тех кто держится', color: '#4CAF50', icon: 'leaf-outline' },
  { id: 'yellow', label: 'Жёлтая комната',  desc: 'Для тех на грани',     color: '#FFC107', icon: 'partly-sunny-outline' },
  { id: 'red',    label: 'Красная комната',  desc: 'Для тех кому тяжело',  color: '#F44336', icon: 'flame-outline' },
];

function formatTime(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

export default function RoomsScreen({ route, navigation }) {
  const userLevel = store.level || 'green';
  const openRoom = route?.params?.openRoom;
  const insets = useSafeAreaInsets();
  const [room, setRoom] = useState(openRoom === userLevel ? openRoom : null);
  const [messages, setMessages] = useState([]);
  const [text2, setText2] = useState('');
  const [kbHeight, setKbHeight] = useState(0);
  const [onlineCount, setOnlineCount] = useState({});
  const [sending, setSending] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [showParticipants, setShowParticipants] = useState(false);
  const [menuMsg, setMenuMsg] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [editing, setEditing] = useState(null);
  const [reactions, setReactions] = useState({});
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [presenceCounts, setPresenceCounts] = useState({ named: 0, anon: 0 });
  const flatRef = useRef(null);
  const channelRef = useRef(null);
  const participantsChannelRef = useRef(null);

  useFocusEffect(useCallback(() => {
    const loadCounts = async () => {
      const counts = {};
      for (const r of ROOMS) {
        const { count } = await supabase
          .from('users')
          .select('*', { count: 'exact', head: true })
          .eq('level', r.id);
        counts[r.id] = count || 0;
      }
      setOnlineCount(counts);
    };
    loadCounts();
  }, []));

  useEffect(() => {
    if (openRoom && openRoom === userLevel) promptEnterRoom(openRoom);
  }, []);

  const loadParticipants = async (roomId) => {
    const { data } = await supabase
      .from('users')
      .select('user_id, username, level, avatar_url, status, last_seen')
      .eq('level', roomId);
    setParticipants(data || []);
  };

  const promptEnterRoom = (roomId) => {
    Alert.alert(
      'Как зайти?',
      'Можно участвовать в разговоре или просто посидеть молча',
      [
        { text: 'С именем', onPress: () => enterRoom(roomId, false) },
        { text: 'Анонимно', onPress: () => enterRoom(roomId, true) },
        { text: 'Отмена', style: 'cancel' },
      ]
    );
  };

  const enterRoom = async (roomId, anonymous = false) => {
    if (roomId !== userLevel) return;
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    if (participantsChannelRef.current) {
      supabase.removeChannel(participantsChannelRef.current);
      participantsChannelRef.current = null;
    }

    setMessages([]);
    setIsAnonymous(anonymous);
    setPresenceCounts({ named: 0, anon: 0 });
    setRoom(roomId);
    await markRead(`room_${roomId}`);

    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('level', roomId)
      .order('created_at', { ascending: false })
      .limit(50);
    const msgs = (data || []).reverse();
    setMessages(msgs);
    loadReactions(msgs);

    if (!anonymous) await loadParticipants(roomId);

    const channel = supabase
      .channel(`room_${roomId}`, { config: { presence: { key: store.userId } } })
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `level=eq.${roomId}`,
      }, (payload) => {
        setMessages(prev => [...prev, payload.new]);
        setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'messages',
        filter: `level=eq.${roomId}`,
      }, (payload) => {
        setMessages(prev => prev.map(m => m.id === payload.new.id ? payload.new : m));
      })
      .on('postgres_changes', {
        event: 'DELETE', schema: 'public', table: 'messages',
        filter: `level=eq.${roomId}`,
      }, (payload) => {
        setMessages(prev => prev.filter(m => m.id !== payload.old.id));
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        let named = 0, anon = 0;
        Object.values(state).forEach(presences => {
          presences.forEach(p => { p.is_anonymous ? anon++ : named++; });
        });
        setPresenceCounts({ named, anon });
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ user_id: store.userId, is_anonymous: anonymous });
        }
      });
    channelRef.current = channel;

    if (!anonymous) {
      const pChannel = supabase
        .channel(`participants_${roomId}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users' }, () => loadParticipants(roomId))
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'users' }, () => loadParticipants(roomId))
        .subscribe();
      participantsChannelRef.current = pChannel;
    }
  };

  useEffect(() => {
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      if (participantsChannelRef.current) supabase.removeChannel(participantsChannelRef.current);
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

  const sendMessage = async () => {
    if (editing) { await saveEdit(); return; }
    if (!text2.trim() || !room) return;
    setSending(true);
    const payload = { username: store.username || 'Аноним', text: text2.trim(), level: room, sender_id: store.userId };
    if (replyTo) {
      payload.reply_to_id = replyTo.id;
      payload.reply_to_text = replyTo.text;
      payload.reply_to_username = replyTo.username;
      setReplyTo(null);
    }
    await supabase.from('messages').insert(payload);
    setText2('');
    setSending(false);
  };

  const saveEdit = async () => {
    const trimmed = text2.trim();
    if (!trimmed || !editing) return;
    await supabase.from('messages').update({ text: trimmed, edited_at: new Date().toISOString() })
      .eq('id', editing.id).eq('sender_id', store.userId);
    setMessages(prev => prev.map(m => m.id === editing.id ? { ...m, text: trimmed, edited_at: new Date().toISOString() } : m));
    setText2(''); setEditing(null); setSending(false);
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

  const startEdit = (item) => { setEditing(item); setText2(item.text); setReplyTo(null); };
  const startReply = (item) => { setReplyTo(item); setEditing(null); };
  const cancelContext = () => { setEditing(null); setReplyTo(null); setText2(''); };

  if (!room) {
    const myRoom = ROOMS.find(r => r.id === userLevel);
    return (
      <View style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.lobbyContent}>
          <Text style={styles.title}>Комнаты</Text>
          <Text style={styles.subtitle}>Зайди к людям с похожим состоянием</Text>

          {myRoom && (
            <View style={[styles.myLevelCard, { borderColor: myRoom.color + '55' }]}>
              <View style={[styles.myLevelIcon, { backgroundColor: myRoom.color + '22' }]}>
                <Ionicons name={myRoom.icon} size={18} color={myRoom.color} />
              </View>
              <Text style={styles.myLevelText}>Твой уровень:</Text>
              <Text style={[styles.myLevelValue, { color: myRoom.color }]}>{myRoom.label}</Text>
            </View>
          )}

          {ROOMS.map(r => {
            const isMyRoom = r.id === userLevel;
            return (
              <TouchableOpacity
                key={r.id}
                style={[
                  styles.roomCard,
                  { borderLeftColor: r.color },
                  isMyRoom && styles.roomCardHighlight,
                  !isMyRoom && styles.roomCardLocked,
                ]}
                onPress={() => isMyRoom ? promptEnterRoom(r.id) : null}
                activeOpacity={isMyRoom ? 0.7 : 1}
              >
                <View style={[styles.roomIcon, { backgroundColor: r.color + '22' }]}>
                  <Ionicons name={r.icon} size={20} color={r.color} />
                </View>
                <View style={styles.roomInfo}>
                  <Text style={[styles.roomLabel, !isMyRoom && { color: colors.muted }]}>{r.label}</Text>
                  <Text style={styles.roomDesc}>{r.desc}</Text>
                </View>
                <View style={styles.roomRight}>
                  {isMyRoom ? (
                    <>
                      <Text style={styles.roomCount}>{onlineCount[r.id] ?? '—'}</Text>
                      <Text style={styles.roomCountLabel}>чел.</Text>
                      <View style={[styles.matchBadge, { backgroundColor: r.color }]}>
                        <Text style={styles.matchText}>ТВОЯ</Text>
                      </View>
                    </>
                  ) : (
                    <Ionicons name="lock-closed" size={16} color={colors.muted} />
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  }

  const roomData = ROOMS.find(r => r.id === room);
  const totalPresence = presenceCounts.named + presenceCounts.anon;

  return (
    <View style={styles.safeArea}>
      <View style={[styles.flex, { marginBottom: kbHeight }]}>
        <View style={[styles.roomHeader, { borderBottomColor: roomData.color + '66' }]}>
          <TouchableOpacity onPress={() => { setRoom(null); setIsAnonymous(false); }} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={26} color={colors.white} />
          </TouchableOpacity>
          <View style={[styles.roomHeaderDot, { backgroundColor: roomData.color }]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.roomHeaderLabel}>{roomData.label}</Text>
            {totalPresence > 0 && (
              <Text style={styles.roomPresenceText}>
                {presenceCounts.named > 0 ? `${presenceCounts.named} в разговоре` : ''}
                {presenceCounts.named > 0 && presenceCounts.anon > 0 ? ' · ' : ''}
                {presenceCounts.anon > 0 ? `${presenceCounts.anon} просто сидят` : ''}
              </Text>
            )}
          </View>
          {!isAnonymous && (
            <TouchableOpacity
              style={styles.participantsToggle}
              onPress={() => setShowParticipants(v => !v)}
            >
              <Ionicons name="people-outline" size={18} color={roomData.color} />
              <Text style={[styles.participantsCount, { color: roomData.color }]}>{participants.length}</Text>
            </TouchableOpacity>
          )}
          {isAnonymous && (
            <View style={styles.anonBadge}>
              <Ionicons name="eye-outline" size={14} color={colors.muted} />
              <Text style={styles.anonBadgeText}>анонимно</Text>
            </View>
          )}
        </View>

        {!isAnonymous && showParticipants && (
          <View style={[styles.participantsPanel, { borderBottomColor: roomData.color + '44' }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.participantsList}>
              {participants.map(p => {
                const isOnline = p.last_seen && (Date.now() - new Date(p.last_seen).getTime()) < 10 * 60 * 1000;
                return (
                  <TouchableOpacity
                    key={p.user_id}
                    style={styles.participantItem}
                    onPress={() => navigation.navigate('UserProfile', {
                      user: { username: p.username, user_id: p.user_id, level: p.level, avatar_url: p.avatar_url, status: p.status },
                    })}
                  >
                    <View>
                      <Avatar uri={p.avatar_url} username={p.username} level={p.level} size={38} />
                      {isOnline && <View style={styles.onlineDot} />}
                    </View>
                    <Text style={[styles.participantName, { color: LEVEL_COLORS[p.level] || colors.white }]} numberOfLines={1}>
                      {p.username}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              {presenceCounts.anon > 0 && (
                <View style={styles.participantItem}>
                  <View style={styles.anonAvatarCircle}>
                    <Ionicons name="eye-outline" size={18} color={colors.muted} />
                  </View>
                  <Text style={styles.participantName} numberOfLines={1}>
                    {presenceCounts.anon} сидят
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        )}

        <FlatList
          ref={flatRef}
          data={messages}
          keyExtractor={item => item.id?.toString()}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => {
            const isMe = item.sender_id === store.userId || item.username === store.username;
            const lvlColor = LEVEL_COLORS[item.level] || colors.accent;
            const rxs = groupReactions(reactions[item.id]);
            return (
              <View>
                <TouchableOpacity onLongPress={() => !isAnonymous && setMenuMsg(item)} activeOpacity={0.8} delayLongPress={350}>
                  <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
                    <TouchableOpacity onPress={() => navigation.navigate('UserProfile', { user: { user_id: item.sender_id, username: item.username, level: item.level, avatar_url: null, status: '' } })}>
                      <Avatar uri={isMe ? store.avatarUrl : null} username={item.username} level={item.level} size={30} />
                    </TouchableOpacity>
                    <View style={[styles.msgBubble, isMe ? styles.msgBubbleMe : styles.msgBubbleOther]}>
                      {!isMe && <Text style={[styles.msgUsername, { color: lvlColor }]}>{item.username}</Text>}
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
            <View style={styles.emptyChat}>
              <Ionicons name="chatbubbles-outline" size={36} color={colors.muted} style={{ marginBottom: 10 }} />
              <Text style={styles.emptyChatText}>Будь первым в этой комнате</Text>
            </View>
          }
        />

        {isAnonymous ? (
          <View style={styles.anonBar}>
            <Ionicons name="eye-outline" size={16} color={colors.muted} />
            <Text style={styles.anonBarText}>Вы наблюдаете анонимно</Text>
            <TouchableOpacity onPress={() => enterRoom(room, false)}>
              <Text style={[styles.anonBarAction, { color: roomData.color }]}>Войти с именем</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
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
                placeholder={editing ? 'Редактировать...' : 'Написать...'}
                placeholderTextColor={colors.muted}
                value={text2}
                onChangeText={setText2}
                onSubmitEditing={sendMessage}
                returnKeyType="send"
                maxLength={500}
              />
              <TouchableOpacity
                style={[styles.sendBtn, { backgroundColor: roomData.color }, !text2.trim() && styles.sendBtnDisabled]}
                onPress={sendMessage}
                disabled={!text2.trim() || sending}
              >
                {sending
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Ionicons name={editing ? 'checkmark' : 'arrow-up'} size={20} color="#fff" />
                }
              </TouchableOpacity>
            </View>
          </>
        )}
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
  subtitle: { fontSize: 15, color: colors.muted, marginBottom: 24 },

  myLevelCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.card, borderRadius: 14,
    padding: 14, borderWidth: 1, marginBottom: 20,
  },
  myLevelIcon: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  myLevelText: { color: colors.muted, fontSize: 14 },
  myLevelValue: { fontSize: 15, fontWeight: 'bold' },

  roomCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.card, borderRadius: 16,
    padding: 16, marginBottom: 12, borderLeftWidth: 3, gap: 12,
  },
  roomCardHighlight: { backgroundColor: colors.accent + '12' },
  roomCardLocked: { opacity: 0.4 },
  roomIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  roomInfo: { flex: 1 },
  roomLabel: { fontSize: 15, fontWeight: 'bold', color: colors.white, marginBottom: 3 },
  roomDesc: { fontSize: 13, color: colors.muted },
  roomRight: { alignItems: 'center', gap: 2 },
  roomCount: { fontSize: 20, fontWeight: 'bold', color: colors.white },
  roomCountLabel: { fontSize: 10, color: colors.muted },
  matchBadge: { borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, marginTop: 4 },
  matchText: { fontSize: 9, color: '#fff', fontWeight: 'bold' },

  roomHeader: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14, borderBottomWidth: 1, gap: 10,
    backgroundColor: colors.background,
  },
  backBtn: { padding: 2 },
  roomHeaderDot: { width: 10, height: 10, borderRadius: 5 },
  roomHeaderLabel: { fontSize: 16, fontWeight: 'bold', color: colors.white },
  roomPresenceText: { fontSize: 11, color: colors.muted, marginTop: 1 },
  participantsToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 4 },
  participantsCount: { fontSize: 14, fontWeight: '600' },
  anonBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.card, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  anonBadgeText: { fontSize: 11, color: colors.muted },

  participantsPanel: { borderBottomWidth: 1, paddingVertical: 10 },
  participantsList: { paddingHorizontal: 12, gap: 16 },
  participantItem: { alignItems: 'center', width: 56 },
  participantName: { fontSize: 10, marginTop: 4, textAlign: 'center', color: colors.muted },
  onlineDot: {
    position: 'absolute', bottom: 0, right: 0,
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#4CAF50',
    borderWidth: 2, borderColor: colors.background,
  },
  anonAvatarCircle: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },

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

  anonBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  anonBarText: { flex: 1, fontSize: 13, color: colors.muted },
  anonBarAction: { fontSize: 13, fontWeight: '600' },

  contextBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border },
  contextLabel: { fontSize: 12, fontWeight: '700', color: colors.accent },
  contextSub: { fontSize: 12, color: colors.muted, marginTop: 1 },

  emptyChat: { alignItems: 'center', marginTop: 60 },
  emptyChatText: { color: colors.muted, fontSize: 15 },

  inputRow: {
    flexDirection: 'row', padding: 12, gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(0,0,0,0.06)',
  },
  input: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.04)', borderRadius: 22,
    paddingHorizontal: 16, paddingVertical: 10,
    color: colors.white, fontSize: 15,
  },
  sendBtn: { borderRadius: 22, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { opacity: 0.4 },
});
