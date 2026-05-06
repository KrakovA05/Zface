import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as StoreReview from 'expo-store-review';
import { supabase } from '../supabase';
import { store } from '../store';
import { colors } from '../theme';
import { sendPushNotification } from '../utils/notifications';

let reviewRequested = false;

function getTodayDate() {
  const d = new Date();
  return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-');
}

export default function LetterScreen({ navigation }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [inbox, setInbox] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sentToday, setSentToday] = useState(false);
  const [tab, setTab] = useState('write');

  useFocusEffect(useCallback(() => {
    loadData();
  }, []));

  const loadData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const today = getTodayDate();

    // Проверяем отправляли ли сегодня
    const { data: myLetter } = await supabase
      .from('anonymous_letters')
      .select('id')
      .eq('author_id', user.id)
      .eq('sent_date', today)
      .maybeSingle();
    setSentToday(!!myLetter);

    // Входящие письма
    const { data: letters } = await supabase
      .from('anonymous_letters')
      .select('id, text, opened, created_at, author_level, author_id')
      .eq('recipient_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    setInbox(letters || []);

    setLoading(false);
  };

  const sendLetter = async () => {
    if (!text.trim() || sending || sentToday) return;
    setSending(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSending(false); return; }

    const level = store.level || 'green';
    const today = getTodayDate();

    // Находим случайного пользователя с тем же уровнем, которому сегодня ещё не писали
    const { data: recipients } = await supabase
      .from('users')
      .select('user_id')
      .eq('level', level)
      .neq('user_id', user.id)
      .limit(50);

    if (!recipients || recipients.length === 0) {
      setSending(false);
      Alert.alert('Пока некому отправить', 'Нет других пользователей с твоим уровнем. Попробуй позже.');
      return;
    }

    // Исключаем тех кто уже получил от нас письмо
    const { data: sentAlready } = await supabase
      .from('anonymous_letters')
      .select('recipient_id')
      .eq('author_id', user.id);
    const sentSet = new Set((sentAlready || []).map(l => l.recipient_id));

    const candidates = recipients.filter(r => !sentSet.has(r.user_id));
    const pool = candidates.length > 0 ? candidates : recipients;
    const recipient = pool[Math.floor(Math.random() * pool.length)];

    const { error } = await supabase.from('anonymous_letters').insert({
      author_id: user.id,
      recipient_id: recipient.user_id,
      author_level: level,
      text: text.trim(),
      sent_date: today,
    });

    setSending(false);
    if (error) {
      Alert.alert('Ошибка', 'Не удалось отправить. Попробуй ещё раз.');
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setText('');
    setSentToday(true);
    setSent(true);
  };

  const openLetter = async (letter) => {
    if (!letter.opened) {
      await supabase.from('anonymous_letters').update({ opened: true }).eq('id', letter.id);
      setInbox(prev => prev.map(l => l.id === letter.id ? { ...l, opened: true } : l));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (letter.author_id) {
        const { data: author } = await supabase.from('users').select('push_token').eq('user_id', letter.author_id).single();
        if (author?.push_token) sendPushNotification(author.push_token, 'Письмо дошло', 'твоё письмо дошло');
      }
      if (!reviewRequested) {
        reviewRequested = true;
        setTimeout(async () => {
          if (await StoreReview.isAvailableAsync()) StoreReview.requestReview();
        }, 1500);
      }
    }
    Alert.alert(
      'Письмо для тебя',
      letter.text,
      [{ text: 'Закрыть', style: 'cancel' }]
    );
  };

  const levelColor = { green: '#4CAF50', yellow: '#AA7C00', red: '#F44336' };
  const unreadCount = inbox.filter(l => !l.opened).length;

  return (
    <KeyboardAvoidingView
      style={styles.wrap}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Анонимные письма</Text>
      </View>

      {/* Таб-свитч */}
      <View style={styles.switchRow}>
        <TouchableOpacity
          style={[styles.switchBtn, tab === 'write' && styles.switchActive]}
          onPress={() => setTab('write')}
        >
          <Text style={[styles.switchLabel, tab === 'write' && styles.switchLabelActive]}>Написать</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.switchBtn, tab === 'inbox' && styles.switchActive]}
          onPress={() => setTab('inbox')}
        >
          <Text style={[styles.switchLabel, tab === 'inbox' && styles.switchLabelActive]}>Входящие</Text>
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {tab === 'write' ? (
            <>
              <View style={styles.infoCard}>
                <Ionicons name="mail-outline" size={28} color={colors.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoTitle}>Письмо в никуда</Text>
                  <Text style={styles.infoDesc}>
                    Напиши что угодно — случайный человек с твоим уровнем получит это завтра. Анонимно, без ответа.
                  </Text>
                </View>
              </View>

              {sent || sentToday ? (
                <View style={styles.sentCard}>
                  <Ionicons name="checkmark-circle-outline" size={40} color={colors.accent} />
                  <Text style={styles.sentTitle}>Письмо отправлено</Text>
                  <Text style={styles.sentDesc}>
                    Кто-то с твоим уровнем получит его завтра. Ты можешь проверить входящие — может, и тебе пришло что-то.
                  </Text>
                  <TouchableOpacity onPress={() => setTab('inbox')} style={styles.inboxBtn}>
                    <Text style={styles.inboxBtnText}>Посмотреть входящие</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <TextInput
                    style={styles.textarea}
                    placeholder="Напиши что-нибудь честное..."
                    placeholderTextColor={colors.muted}
                    value={text}
                    onChangeText={setText}
                    multiline
                    maxLength={600}
                    textAlignVertical="top"
                  />
                  <View style={styles.charRow}>
                    <Text style={styles.charCount}>{text.length}/600</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
                    onPress={sendLetter}
                    disabled={!text.trim() || sending}
                    activeOpacity={0.8}
                  >
                    {sending
                      ? <ActivityIndicator color={colors.onAccent} size="small" />
                      : <>
                          <Ionicons name="paper-plane-outline" size={18} color={colors.onAccent} />
                          <Text style={styles.sendBtnText}>Отправить в никуда</Text>
                        </>
                    }
                  </TouchableOpacity>
                </>
              )}
            </>
          ) : (
            <>
              {inbox.length === 0 ? (
                <View style={styles.emptyBlock}>
                  <Ionicons name="mail-open-outline" size={48} color={colors.muted} />
                  <Text style={styles.emptyText}>Пока ничего не прилетело</Text>
                  <Text style={styles.emptyDesc}>Напиши кому-нибудь сам — иногда начать первым и есть поддержка</Text>
                </View>
              ) : (
                inbox.map(letter => (
                  <TouchableOpacity
                    key={letter.id}
                    style={[styles.letterCard, !letter.opened && styles.letterCardUnread]}
                    onPress={() => openLetter(letter)}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.letterDot, { backgroundColor: levelColor[letter.author_level] || colors.accent }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.letterPreview} numberOfLines={2}>{letter.text}</Text>
                      <Text style={styles.letterDate}>
                        {new Date(letter.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                        {!letter.opened && <Text style={styles.letterNew}> · новое</Text>}
                      </Text>
                    </View>
                    <Ionicons name={letter.opened ? 'mail-open-outline' : 'mail-outline'} size={18} color={letter.opened ? colors.muted : colors.accent} />
                  </TouchableOpacity>
                ))
              )}
            </>
          )}
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingTop: 56, paddingBottom: 12,
    gap: 4,
  },
  backBtn: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.white },

  switchRow: {
    flexDirection: 'row', margin: 16, marginTop: 4,
    backgroundColor: colors.card, borderRadius: 14, padding: 4,
  },
  switchBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', paddingVertical: 10, borderRadius: 11, gap: 6,
  },
  switchActive: { backgroundColor: colors.accent },
  switchLabel: { fontSize: 15, fontWeight: '600', color: colors.muted },
  switchLabelActive: { color: colors.onAccent },
  badge: {
    backgroundColor: '#e74c3c', borderRadius: 10,
    minWidth: 18, height: 18, paddingHorizontal: 4,
    alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },

  content: { paddingHorizontal: 16, paddingBottom: 40 },

  infoCard: {
    backgroundColor: colors.card, borderRadius: 16,
    padding: 16, marginBottom: 16,
    flexDirection: 'row', alignItems: 'flex-start', gap: 14,
  },
  infoTitle: { fontSize: 15, fontWeight: '700', color: colors.white, marginBottom: 4 },
  infoDesc: { fontSize: 13, color: colors.muted, lineHeight: 18 },

  textarea: {
    backgroundColor: colors.card, borderRadius: 16,
    padding: 16, color: colors.white, fontSize: 15,
    lineHeight: 22, minHeight: 160, marginBottom: 4,
    borderWidth: 1, borderColor: colors.border,
  },
  charRow: { alignItems: 'flex-end', marginBottom: 16 },
  charCount: { fontSize: 11, color: colors.muted },

  sendBtn: {
    backgroundColor: colors.accent, borderRadius: 14,
    paddingVertical: 16, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  sendBtnDisabled: { opacity: 0.35 },
  sendBtnText: { color: colors.onAccent, fontSize: 15, fontWeight: '600' },

  sentCard: {
    backgroundColor: colors.card, borderRadius: 16,
    padding: 24, alignItems: 'center', gap: 12,
  },
  sentTitle: { fontSize: 18, fontWeight: '700', color: colors.white },
  sentDesc: { fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 20 },
  inboxBtn: {
    marginTop: 4, borderWidth: 1, borderColor: colors.accent,
    borderRadius: 12, paddingVertical: 10, paddingHorizontal: 20,
  },
  inboxBtnText: { color: colors.accent, fontWeight: '600' },

  letterCard: {
    backgroundColor: colors.card, borderRadius: 14,
    padding: 14, marginBottom: 8,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  letterCardUnread: { borderLeftWidth: 3, borderLeftColor: colors.accent },
  letterDot: { width: 8, height: 8, borderRadius: 4, marginTop: 2 },
  letterPreview: { fontSize: 14, color: colors.white, lineHeight: 19, marginBottom: 4 },
  letterDate: { fontSize: 11, color: colors.muted },
  letterNew: { color: colors.accent, fontWeight: '600' },

  emptyBlock: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 16, color: colors.muted, fontWeight: '600' },
  emptyDesc: { fontSize: 13, color: colors.muted, textAlign: 'center' },
});
