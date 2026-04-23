import {
  StyleSheet, Text, View, FlatList, TouchableOpacity,
  TextInput, ActivityIndicator, ScrollView, Alert, Keyboard,
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

const ROOMS = [
  { id: 'green',  label: 'Зелёная комната', desc: 'Для тех кто держится', color: '#4CAF50', icon: 'leaf-outline' },
  { id: 'yellow', label: 'Жёлтая комната',  desc: 'Для тех на грани',     color: '#FFC107', icon: 'partly-sunny-outline' },
  { id: 'red',    label: 'Красная комната',  desc: 'Для тех кому тяжело',  color: '#F44336', icon: 'flame-outline' },
];

const LEVEL_ICONS = { green: 'leaf-outline', yellow: 'partly-sunny-outline', red: 'flame-outline' };

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
    if (openRoom && openRoom === userLevel) enterRoom(openRoom);
  }, []);

  const loadParticipants = async (roomId) => {
    const { data } = await supabase
      .from('users')
      .select('user_id, username, level, avatar_url, status')
      .eq('level', roomId);
    setParticipants(data || []);
  };

  const VALID_ROOMS = ['green', 'yellow', 'red'];

  const enterRoom = async (roomId) => {
    if (!VALID_ROOMS.includes(roomId)) return;
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
    setRoom(roomId);
    await markRead(`room_${roomId}`);

    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('level', roomId)
      .order('created_at', { ascending: false })
      .limit(50);
    setMessages((data || []).reverse());

    await loadParticipants(roomId);

    const channel = supabase
      .channel(`room_${roomId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `level=eq.${roomId}`,
      }, (payload) => {
        setMessages(prev => [...prev, payload.new]);
        setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
      })
      .on('postgres_changes', {
        event: 'DELETE', schema: 'public', table: 'messages',
        filter: `level=eq.${roomId}`,
      }, (payload) => {
        setMessages(prev => prev.filter(m => m.id !== payload.old.id));
      })
      .subscribe();
    channelRef.current = channel;

    const pChannel = supabase
      .channel(`participants_${roomId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users' }, () => loadParticipants(roomId))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'users' }, () => loadParticipants(roomId))
      .subscribe();
    participantsChannelRef.current = pChannel;
  };

  useEffect(() => {
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      if (participantsChannelRef.current) supabase.removeChannel(participantsChannelRef.current);
    };
  }, []);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardWillShow', e => setKbHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardWillHide', () => setKbHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  const sendMessage = async () => {
    if (!text2.trim() || !room) return;
    setSending(true);
    await supabase.from('messages').insert({
      username: store.username || 'Аноним',
      text: text2.trim(),
      level: room,
      sender_id: store.userId,
    });
    setText2('');
    setSending(false);
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
                onPress={() => isMyRoom ? enterRoom(r.id) : null}
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

  return (
    <View style={styles.safeArea}>
      <View style={[styles.flex, { marginBottom: kbHeight }]}>
        <View style={[styles.roomHeader, { borderBottomColor: roomData.color + '66' }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={26} color={colors.white} />
          </TouchableOpacity>
          <View style={[styles.roomHeaderDot, { backgroundColor: roomData.color }]} />
          <Text style={styles.roomHeaderLabel}>{roomData.label}</Text>
          <TouchableOpacity
            style={styles.participantsToggle}
            onPress={() => setShowParticipants(v => !v)}
          >
            <Ionicons name="people-outline" size={18} color={roomData.color} />
            <Text style={[styles.participantsCount, { color: roomData.color }]}>{participants.length}</Text>
          </TouchableOpacity>
        </View>

        {showParticipants && (
          <View style={[styles.participantsPanel, { borderBottomColor: roomData.color + '44' }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.participantsList}>
              {participants.map(p => (
                <TouchableOpacity
                  key={p.user_id}
                  style={styles.participantItem}
                  onPress={() => navigation.navigate('UserProfile', {
                    user: { username: p.username, user_id: p.user_id, level: p.level, avatar_url: p.avatar_url, status: p.status },
                  })}
                >
                  <Avatar uri={p.avatar_url} username={p.username} level={p.level} size={38} />
                  <Text style={[styles.participantName, { color: LEVEL_COLORS[p.level] || colors.white }]} numberOfLines={1}>
                    {p.username}
                  </Text>
                </TouchableOpacity>
              ))}
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
            return (
              <TouchableOpacity onLongPress={() => deleteMessage(item)} activeOpacity={0.8} delayLongPress={400}>
                <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
                  <TouchableOpacity onPress={() => navigation.navigate('UserProfile', { user: { user_id: item.sender_id, username: item.username, level: item.level, avatar_url: null, status: '' } })}>
                    <Avatar uri={isMe ? store.avatarUrl : null} username={item.username} level={item.level} size={30} />
                  </TouchableOpacity>
                  <View style={[styles.msgBubble, isMe ? styles.msgBubbleMe : styles.msgBubbleOther]}>
                    {!isMe && <Text style={[styles.msgUsername, { color: lvlColor }]}>{item.username}</Text>}
                    <Text style={styles.msgText}>{item.text}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Ionicons name="chatbubbles-outline" size={36} color={colors.muted} style={{ marginBottom: 10 }} />
              <Text style={styles.emptyChatText}>Будь первым в этой комнате</Text>
            </View>
          }
        />

        <View style={[styles.inputRow, { paddingBottom: kbHeight > 0 ? 12 : Math.max(insets.bottom, 12) }]}>
          <TextInput
            style={styles.input}
            placeholder="Написать..."
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
              : <Ionicons name="arrow-up" size={20} color="#fff" />
            }
          </TouchableOpacity>
        </View>
      </View>
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
  roomCardHighlight: { backgroundColor: '#1e1e2e' },
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
  roomHeaderLabel: { flex: 1, fontSize: 16, fontWeight: 'bold', color: colors.white },
  participantsToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 4 },
  participantsCount: { fontSize: 14, fontWeight: '600' },

  participantsPanel: { borderBottomWidth: 1, paddingVertical: 10 },
  participantsList: { paddingHorizontal: 12, gap: 16 },
  participantItem: { alignItems: 'center', width: 56 },
  participantName: { fontSize: 10, marginTop: 4, textAlign: 'center' },

  messagesList: { padding: 16, paddingBottom: 8 },
  msgRow: { flexDirection: 'row', marginBottom: 12, alignItems: 'flex-end', gap: 8 },
  msgRowMe: { flexDirection: 'row-reverse' },
  msgBubble: { maxWidth: '75%', borderRadius: 16, padding: 12 },
  msgBubbleOther: { backgroundColor: colors.card, borderBottomLeftRadius: 4 },
  msgBubbleMe: { backgroundColor: '#2a2a4a', borderBottomRightRadius: 4 },
  msgUsername: { fontSize: 11, fontWeight: '600', marginBottom: 4 },
  msgText: { color: colors.white, fontSize: 15, lineHeight: 21 },
  emptyChat: { alignItems: 'center', marginTop: 60 },
  emptyChatText: { color: colors.muted, fontSize: 15 },

  inputRow: {
    flexDirection: 'row', padding: 12, gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.08)',
  },
  input: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 22,
    paddingHorizontal: 16, paddingVertical: 10,
    color: colors.white, fontSize: 15,
  },
  sendBtn: { borderRadius: 22, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { opacity: 0.4 },
});
