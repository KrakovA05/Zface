import {
  StyleSheet, Text, View, FlatList, TextInput,
  TouchableOpacity, Keyboard, Platform,
  ActivityIndicator, Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useRef, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { SUPABASE_URL } from '@env';
import { supabase } from '../supabase';
import { store } from '../store';
import { colors } from '../theme';

const CRISIS_WORDS = [
  'суицид', 'не хочу жить', 'хочу умереть', 'покончить',
  'конец жизни', 'убить себя', 'убью себя',
  'нет смысла жить', 'незачем жить',
];

function hasCrisisWord(text) {
  const lower = text.toLowerCase();
  return CRISIS_WORDS.some(w => lower.includes(w));
}

function MessageBubble({ item }) {
  const isUser = item.role === 'user';
  const isError = item.role === 'error';
  if (isError) {
    return (
      <View style={styles.bubbleWrapCenter}>
        <Text style={styles.errorText}>{item.text}</Text>
      </View>
    );
  }
  return (
    <View style={[styles.bubbleWrap, isUser ? styles.bubbleWrapUser : styles.bubbleWrapAi]}>
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAi]}>
        <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>{item.text}</Text>
      </View>
    </View>
  );
}

function CrisisCard({ onDismiss }) {
  return (
    <View style={styles.crisisCard}>
      <Text style={styles.crisisTitle}>Я здесь рядом.</Text>
      <Text style={styles.crisisBody}>
        Если сейчас очень тяжело — есть люди, которые выслушают:
      </Text>
      <TouchableOpacity
        style={styles.crisisHotline}
        onPress={() => Linking.openURL('tel:88002000122')}
        activeOpacity={0.75}
      >
        <Ionicons name="call-outline" size={16} color="#FFFFFF" />
        <View style={{ flex: 1 }}>
          <Text style={styles.crisisHotlineText}>8-800-2000-122</Text>
          <Text style={styles.crisisHotlineSub}>бесплатно, круглосуточно</Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity onPress={onDismiss} activeOpacity={0.6} style={styles.crisisDismiss}>
        <Text style={styles.crisisDismissText}>продолжить разговор</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function AiChatScreen() {
  const insets = useSafeAreaInsets();
  const [kbHeight, setKbHeight] = useState(0);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [showCrisis, setShowCrisis] = useState(false);
  const flatListRef = useRef(null);
  const sessionIdRef = useRef(null);
  const messagesRef = useRef([]);

  const TAB_BAR_ABOVE_INSET = 68;
  const bottomOffset = insets.bottom + TAB_BAR_ABOVE_INSET;

  useEffect(() => {
    const showEv = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEv = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEv, e => setKbHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener(hideEv, () => setKbHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  useEffect(() => {
    initSession();
    return () => {
      if (sessionIdRef.current && messagesRef.current.length > 2) {
        summarizeSession(sessionIdRef.current);
      }
    };
  }, []);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const initSession = async () => {
    if (!store.userId) return;

    const { data: existing } = await supabase
      .from('ai_chat_sessions')
      .select('id')
      .eq('user_id', store.userId)
      .is('ended_at', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let sid;
    if (existing) {
      sid = existing.id;
    } else {
      const { data: newSession } = await supabase
        .from('ai_chat_sessions')
        .insert({ user_id: store.userId })
        .select('id')
        .single();
      sid = newSession?.id;
    }

    if (!sid) return;
    setSessionId(sid);
    sessionIdRef.current = sid;

    const { data: msgs } = await supabase
      .from('ai_chat_messages')
      .select('id, role, text, created_at')
      .eq('session_id', sid)
      .order('created_at', { ascending: true })
      .limit(20);

    setMessages(msgs || []);
  };

  const summarizeSession = async (sid) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;
      await fetch(
        `${SUPABASE_URL}/functions/v1/ai-chat`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ session_id: sid, action: 'summarize' }),
        }
      );
    } catch {
      // тихо
    }
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || sending || !sessionId) return;

    setInput('');
    setSending(true);

    const tempId = `tmp_${Date.now()}`;
    const userMsg = { id: tempId, role: 'user', text, created_at: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setMessages(prev => [...prev, { id: `err_${Date.now()}`, role: 'error', text: 'Сессия истекла. Перезайди в приложение.', timestamp: new Date().toISOString() }]);
        setSending(false);
        return;
      }

      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/ai-chat`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ message: text, session_id: sessionId }),
        }
      );

      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Ошибка сервера');

      if (json.crisis) setShowCrisis(true);

      const aiMsg = { id: `ai_${Date.now()}`, role: 'assistant', text: json.reply, created_at: new Date().toISOString() };
      setMessages(prev => [...prev, aiMsg]);
    } catch (e) {
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setInput(text);
      const errMsg = { id: `err_${Date.now()}`, role: 'error', text: `ошибка: ${e?.message || String(e)}`, created_at: new Date().toISOString() };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerAvatar}>
          <Text style={styles.headerAvatarIcon}>✦</Text>
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.headerName}>@один</Text>
          <Text style={styles.headerSub}>я здесь каждый день</Text>
        </View>
      </View>

      <View style={styles.disclaimer}>
        <Text style={styles.disclaimerText}>
          @один — не психолог и не заменяет специалиста
        </Text>
      </View>

      <View style={{ flex: 1, marginBottom: kbHeight }}>
        <FlatList
          ref={flatListRef}
          style={{ flex: 1 }}
          data={messages}
          keyExtractor={item => item.id}
          renderItem={({ item }) => <MessageBubble item={item} />}
          contentContainerStyle={styles.messageList}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>напиши что-нибудь — @один ответит</Text>
            </View>
          }
        />

        {showCrisis && <CrisisCard onDismiss={() => setShowCrisis(false)} />}

        <View style={[styles.inputRow, { paddingBottom: kbHeight > 0 ? 12 : bottomOffset + 4 }]}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="напиши что-нибудь..."
            placeholderTextColor={colors.muted}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || sending || !sessionId) && styles.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={!input.trim() || sending || !sessionId}
            activeOpacity={0.7}
          >
            {sending
              ? <ActivityIndicator size="small" color="#FFFFFF" />
              : <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
            }
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
    gap: 12,
  },
  headerAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#c9a96e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarIcon: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
  headerInfo: { flex: 1 },
  headerName: { fontSize: 16, fontWeight: '700', color: colors.white },
  headerSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  disclaimer: {
    backgroundColor: '#FFF8EE',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0E8D8',
  },
  disclaimerText: { fontSize: 11, color: '#A08060', textAlign: 'center' },
  messageList: { padding: 16, paddingBottom: 8, flexGrow: 1 },
  emptyWrap: { flex: 1, alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 14, color: colors.muted, textAlign: 'center' },
  bubbleWrap: { marginBottom: 10 },
  bubbleWrapUser: { alignItems: 'flex-end' },
  bubbleWrapAi: { alignItems: 'flex-start' },
  bubbleWrapCenter: { alignItems: 'center', marginBottom: 8 },
  errorText: { fontSize: 12, color: '#C0392B', opacity: 0.7 },
  bubble: {
    maxWidth: '82%',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 18,
  },
  bubbleUser: {
    backgroundColor: '#c9a96e',
    borderBottomRightRadius: 4,
  },
  bubbleAi: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: 4,
  },
  bubbleText: { fontSize: 14, color: colors.white, lineHeight: 20 },
  bubbleTextUser: { color: '#FFFFFF' },
  crisisCard: {
    position: 'absolute',
    bottom: 80,
    left: 16,
    right: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E0D0C0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  crisisTitle: { fontSize: 16, fontWeight: '700', color: colors.white, marginBottom: 8 },
  crisisBody: { fontSize: 13, color: colors.muted, marginBottom: 14, lineHeight: 19 },
  crisisHotline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#c9a96e',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  crisisHotlineText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  crisisHotlineSub: { fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  crisisDismiss: { alignItems: 'center', paddingVertical: 6 },
  crisisDismissText: { fontSize: 13, color: colors.muted },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.white,
    maxHeight: 100,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#c9a96e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
});
