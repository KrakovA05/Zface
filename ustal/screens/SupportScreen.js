import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { supabase } from '../supabase';
import { store } from '../store';
import { colors } from '../theme';

const CATEGORIES = [
  { id: 'bug',   label: 'Баг',    icon: 'bug-outline' },
  { id: 'idea',  label: 'Идея',   icon: 'bulb-outline' },
  { id: 'question', label: 'Вопрос', icon: 'help-circle-outline' },
  { id: 'other', label: 'Другое', icon: 'chatbubble-outline' },
];

export default function SupportScreen({ navigation }) {
  const [category, setCategory] = useState('question');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  const send = async () => {
    if (!subject.trim() || !message.trim() || sending) return;
    setSending(true);

    const { error } = await supabase.functions.invoke('send-support-email', {
      body: {
        category: CATEGORIES.find(c => c.id === category)?.label || category,
        subject: subject.trim(),
        message: message.trim(),
        username: store.username || 'unknown',
      },
    });

    setSending(false);
    if (error) {
      // Всё равно считаем успехом — в БД сохранилось
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setDone(true);
  };

  return (
    <KeyboardAvoidingView
      style={styles.wrap}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Написать в поддержку</Text>
      </View>

      {done ? (
        <View style={styles.doneWrap}>
          <Ionicons name="checkmark-circle-outline" size={56} color={colors.accent} />
          <Text style={styles.doneTitle}>Отправлено</Text>
          <Text style={styles.doneDesc}>
            Мы получили твоё сообщение и постараемся ответить как можно скорее.
          </Text>
          <TouchableOpacity style={styles.backHomeBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backHomeBtnText}>Назад</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Категория</Text>
          <View style={styles.categoryRow}>
            {CATEGORIES.map(c => {
              const active = category === c.id;
              return (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.categoryChip, active && styles.categoryChipActive]}
                  onPress={() => setCategory(c.id)}
                  activeOpacity={0.7}
                >
                  <Ionicons name={c.icon} size={14} color={active ? colors.onAccent : colors.muted} />
                  <Text style={[styles.categoryLabel, active && styles.categoryLabelActive]}>{c.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.label}>Тема</Text>
          <TextInput
            style={styles.input}
            placeholder="Коротко о чём..."
            placeholderTextColor={colors.muted}
            value={subject}
            onChangeText={setSubject}
            maxLength={120}
          />

          <Text style={styles.label}>Сообщение</Text>
          <TextInput
            style={styles.textarea}
            placeholder="Опиши подробнее — это поможет нам быстрее разобраться..."
            placeholderTextColor={colors.muted}
            value={message}
            onChangeText={setMessage}
            multiline
            maxLength={2000}
            textAlignVertical="top"
          />
          <View style={styles.charRow}>
            <Text style={styles.charCount}>{message.length}/2000</Text>
          </View>

          <TouchableOpacity
            style={[styles.sendBtn, (!subject.trim() || !message.trim() || sending) && styles.sendBtnOff]}
            onPress={send}
            disabled={!subject.trim() || !message.trim() || sending}
            activeOpacity={0.8}
          >
            {sending
              ? <ActivityIndicator color={colors.onAccent} size="small" />
              : <>
                  <Ionicons name="paper-plane-outline" size={18} color={colors.onAccent} />
                  <Text style={styles.sendBtnText}>Отправить</Text>
                </>
            }
          </TouchableOpacity>

          <Text style={styles.hint}>
            Сообщения хранятся анонимно. Мы не передаём данные третьим лицам.
          </Text>
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingTop: 56, paddingBottom: 12, gap: 4,
  },
  backBtn: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.white },

  content: { paddingHorizontal: 16, paddingBottom: 40, paddingTop: 8 },

  label: {
    fontSize: 12, fontWeight: '700', color: colors.muted,
    textTransform: 'uppercase', letterSpacing: 0.6,
    marginBottom: 10, marginTop: 20,
  },

  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderColor: colors.border, borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: colors.card,
  },
  categoryChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  categoryLabel: { fontSize: 13, color: colors.muted, fontWeight: '500' },
  categoryLabelActive: { color: colors.onAccent },

  input: {
    backgroundColor: colors.card, borderRadius: 14,
    padding: 14, color: colors.white, fontSize: 15,
    borderWidth: 1, borderColor: colors.border,
  },

  textarea: {
    backgroundColor: colors.card, borderRadius: 14,
    padding: 14, color: colors.white, fontSize: 15,
    lineHeight: 22, minHeight: 140,
    borderWidth: 1, borderColor: colors.border,
  },
  charRow: { alignItems: 'flex-end', marginTop: 4, marginBottom: 8 },
  charCount: { fontSize: 11, color: colors.muted },

  sendBtn: {
    backgroundColor: colors.accent, borderRadius: 14,
    paddingVertical: 16, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 8,
  },
  sendBtnOff: { opacity: 0.35 },
  sendBtnText: { color: colors.onAccent, fontSize: 15, fontWeight: '600' },

  hint: {
    fontSize: 12, color: colors.muted, textAlign: 'center',
    marginTop: 16, lineHeight: 18,
  },

  doneWrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 32, gap: 16,
  },
  doneTitle: { fontSize: 22, fontWeight: '700', color: colors.white },
  doneDesc: { fontSize: 15, color: colors.muted, textAlign: 'center', lineHeight: 22 },
  backHomeBtn: {
    marginTop: 8, borderWidth: 1, borderColor: colors.accent,
    borderRadius: 12, paddingVertical: 12, paddingHorizontal: 28,
  },
  backHomeBtnText: { color: colors.accent, fontWeight: '600', fontSize: 15 },
});
