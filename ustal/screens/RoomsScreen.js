import {
  StyleSheet, Text, View, FlatList, TouchableOpacity,
  TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useState, useEffect, useRef, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../supabase';
import { store } from '../store';
import { LEVEL_COLORS, LEVEL_DATA } from '../constants';
import { colors } from '../theme';
import { markRead } from '../utils/unread';
import Avatar from '../components/Avatar';

const ROOMS = [
  { id: 'green',  label: '🌿 Зелёная комната', desc: 'Для тех кто держится', color: '#4CAF50' },
  { id: 'yellow', label: '🌤 Жёлтая комната',  desc: 'Для тех на грани',     color: '#FFC107' },
  { id: 'red',    label: '🌪 Красная комната',  desc: 'Для тех кому тяжело',  color: '#F44336' },
];

export default function RoomsScreen({ route, navigation }) {
  const userLevel = store.level || 'green';
  const openRoom = route?.params?.openRoom;
  const [room, setRoom] = useState(openRoom === userLevel ? openRoom : null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState([]);
  const [text2, setText2] = useState('');
  const [onlineCount, setOnlineCount] = useState({});
  const [sending, setSending] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [showParticipants, setShowParticipants] = useState(false);
  const flatRef = useRef(null);
  const channelRef = useRef(null);
  const participantsChannelRef = useRef(null);

  // Загрузка количества онлайн в каждой комнате
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

  // Если открыли через route.params — входим только если совпадает уровень
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

  const enterRoom = async (roomId) => {
    if (roomId !== userLevel) return; // защита на уровне функции
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

    // Загружаем историю
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('level', roomId)
      .order('created_at', { ascending: false })
      .limit(50);
    setMessages((data || []).reverse());

    // Загружаем участников
    await loadParticipants(roomId);

    // Realtime подписка на сообщения
    const channel = supabase
      .channel(`room_${roomId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `level=eq.${roomId}`,
      }, (payload) => {
        setMessages(prev => [...prev, payload.new]);
        setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
      })
      .subscribe();
    channelRef.current = channel;

    // Realtime подписка на изменения уровней участников
    const pChannel = supabase
      .channel(`participants_${roomId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'users',
      }, () => {
        loadParticipants(roomId);
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'users',
      }, () => {
        loadParticipants(roomId);
      })
      .subscribe();
    participantsChannelRef.current = pChannel;
  };

  useEffect(() => {
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      if (participantsChannelRef.current) supabase.removeChannel(participantsChannelRef.current);
    };
  }, []);

  const sendMessage = async () => {
    if (!text2.trim() || !room) return;
    setSending(true);
    await supabase.from('messages').insert({
      username: store.username || 'Аноним',
      text: text2.trim(),
      level: room,
    });
    setText2('');
    setSending(false);
  };

  if (!room) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.lobbyContent}>
          <Text style={styles.title}>🚪 Комнаты</Text>
          <Text style={styles.subtitle}>Зайди к людям с похожим состоянием</Text>

          <View style={[styles.myLevelCard, { borderColor: LEVEL_COLORS[userLevel] }]}>
            <Text style={styles.myLevelText}>Твой уровень:</Text>
            <Text style={[styles.myLevelValue, { color: LEVEL_COLORS[userLevel] }]}>
              {LEVEL_DATA[userLevel]?.label}
            </Text>
          </View>

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
                <View style={styles.roomInfo}>
                  <Text style={[styles.roomLabel, !isMyRoom && styles.roomLabelLocked]}>{r.label}</Text>
                  <Text style={styles.roomDesc}>{r.desc}</Text>
                </View>
                <View style={styles.roomRight}>
                  {isMyRoom ? (
                    <>
                      <Text style={styles.roomCount}>{onlineCount[r.id] ?? '—'}</Text>
                      <Text style={styles.roomCountLabel}>чел.</Text>
                      <View style={[styles.matchBadge, { backgroundColor: r.color }]}>
                        <Text style={styles.matchText}>твоя</Text>
                      </View>
                    </>
                  ) : (
                    <Text style={styles.lockIcon}>🔒</Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </SafeAreaView>
    );
  }

  const roomData = ROOMS.find(r => r.id === room);

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <View style={[styles.roomHeader, { borderBottomColor: roomData.color }]}>
          <TouchableOpacity onPress={() => setRoom(null)} style={styles.backBtn}>
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.roomHeaderLabel}>{roomData.label}</Text>
          <TouchableOpacity
            style={styles.participantsToggle}
            onPress={() => setShowParticipants(v => !v)}
          >
            <Text style={[styles.participantsToggleText, { color: roomData.color }]}>
              👥 {participants.length}
            </Text>
          </TouchableOpacity>
        </View>

        {showParticipants && (
          <View style={[styles.participantsPanel, { borderBottomColor: roomData.color }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.participantsList}>
              {participants.map(p => (
                <TouchableOpacity
                  key={p.user_id}
                  style={styles.participantItem}
                  onPress={() => navigation.navigate('UserProfile', {
                    user: { username: p.username, userId: p.user_id, level: p.level, avatarUrl: p.avatar_url, status: p.status },
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
            const isMe = item.username === store.username;
            const lvlColor = LEVEL_COLORS[item.level] || colors.accent;
            return (
              <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
                {!isMe && (
                  <View style={[styles.msgAvatar, { backgroundColor: lvlColor }]}>
                    <Text style={styles.msgAvatarText}>{item.username?.[0]?.toUpperCase()}</Text>
                  </View>
                )}
                <View style={[styles.msgBubble, isMe ? styles.msgBubbleMe : styles.msgBubbleOther]}>
                  {!isMe && <Text style={[styles.msgUsername, { color: lvlColor }]}>{item.username}</Text>}
                  <Text style={styles.msgText}>{item.text}</Text>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <Text style={styles.emptyChat}>Будь первым в этой комнате 👋</Text>
          }
        />

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Написать..."
            placeholderTextColor={colors.muted}
            value={text2}
            onChangeText={setText2}
            onSubmitEditing={sendMessage}
            returnKeyType="send"
          />
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: roomData.color }, !text2.trim() && styles.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={!text2.trim() || sending}
          >
            {sending
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.sendText}>→</Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  lobbyContent: { flex: 1, padding: 24 },
  title: { fontSize: 26, fontWeight: 'bold', color: colors.white, marginBottom: 8 },
  subtitle: { fontSize: 15, color: colors.muted, marginBottom: 24 },
  myLevelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    marginBottom: 24,
  },
  myLevelText: { color: colors.muted, fontSize: 14 },
  myLevelValue: { fontSize: 15, fontWeight: 'bold' },
  roomCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    borderLeftWidth: 4,
  },
  roomCardHighlight: { backgroundColor: '#1e1e2e' },
  roomCardLocked: { opacity: 0.45 },
  roomLabelLocked: { color: colors.muted },
  lockIcon: { fontSize: 20 },
  roomInfo: { flex: 1 },
  roomLabel: { fontSize: 16, fontWeight: 'bold', color: colors.white, marginBottom: 4 },
  roomDesc: { fontSize: 13, color: colors.muted },
  roomRight: { alignItems: 'center', minWidth: 44 },
  roomCount: { fontSize: 22, fontWeight: 'bold', color: colors.white },
  roomCountLabel: { fontSize: 11, color: colors.muted },
  matchBadge: { borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, marginTop: 4 },
  matchText: { fontSize: 10, color: '#fff', fontWeight: 'bold' },
  roomHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 2,
    gap: 12,
  },
  backBtn: { padding: 4 },
  backText: { color: colors.white, fontSize: 22 },
  roomHeaderLabel: { fontSize: 17, fontWeight: 'bold', color: colors.white },
  messagesList: { padding: 16, paddingBottom: 8 },
  msgRow: { flexDirection: 'row', marginBottom: 12, alignItems: 'flex-end', gap: 8 },
  msgRowMe: { flexDirection: 'row-reverse' },
  msgAvatar: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  msgAvatarText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  msgBubble: { maxWidth: '75%', borderRadius: 16, padding: 12 },
  msgBubbleOther: { backgroundColor: colors.card, borderBottomLeftRadius: 4 },
  msgBubbleMe: { backgroundColor: '#2a2a4a', borderBottomRightRadius: 4 },
  msgUsername: { fontSize: 11, fontWeight: '600', marginBottom: 4 },
  msgText: { color: colors.white, fontSize: 15, lineHeight: 21 },
  emptyChat: { color: colors.muted, textAlign: 'center', marginTop: 60, fontSize: 15 },
  inputRow: {
    flexDirection: 'row',
    padding: 12,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  input: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: colors.white,
    fontSize: 15,
  },
  sendBtn: { borderRadius: 12, width: 44, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { opacity: 0.4 },
  sendText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  participantsToggle: { marginLeft: 'auto', paddingHorizontal: 4 },
  participantsToggleText: { fontSize: 14, fontWeight: '600' },
  participantsPanel: {
    borderBottomWidth: 1,
    paddingVertical: 10,
    backgroundColor: colors.background,
  },
  participantsList: { paddingHorizontal: 12, gap: 16 },
  participantItem: { alignItems: 'center', width: 56 },
  participantName: { fontSize: 10, marginTop: 4, textAlign: 'center' },
});
