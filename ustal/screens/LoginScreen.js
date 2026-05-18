import {
  View, StyleSheet, Text, TouchableOpacity,
  TextInput, Alert, KeyboardAvoidingView, Platform, ScrollView,
  Image, Modal,
} from 'react-native';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../supabase';
import { store } from '../store';
import { colors } from '../theme';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [supportEmail, setSupportEmail] = useState('');
  const [supportTopic, setSupportTopic] = useState('');
  const [supportText, setSupportText] = useState('');
  const [supportLoading, setSupportLoading] = useState(false);

  const openSupport = () => { setSupportEmail(email); setShowSupport(true); };

  const sendSupport = async () => {
    if (!supportTopic.trim() || !supportText.trim()) return;
    setSupportLoading(true);
    try {
      await supabase.functions.invoke('send-support-email', {
        body: { category: 'general', topic: supportTopic.trim(), text: supportText.trim(), email: supportEmail.trim() },
      });
      setSupportTopic('');
      setSupportText('');
      setShowSupport(false);
      Alert.alert('Отправлено', 'Мы получили твоё сообщение и ответим на почту.');
    } catch {
      Alert.alert('Ошибка', 'Не удалось отправить. Попробуй позже.');
    }
    setSupportLoading(false);
  };

  const login = async () => {
    if (!email || !password) return;
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      Alert.alert('Ошибка', 'Неверный email или пароль');
      return;
    }
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('username, level, email, avatar_url, status, goal, is_admin, banned_until')
      .eq('user_id', data.user.id)
      .single();
    setLoading(false);
    if (userError || !userData) {
      Alert.alert('Ошибка', 'Не удалось загрузить профиль');
      return;
    }
    store.userId = data.user.id;
    store.username = userData.username;
    store.level = userData.level || 'green';
    store.email = userData.email || email;
    store.avatarUrl = userData.avatar_url || '';
    store.status = userData.status || '';
    store.goal = userData.goal || '';
    store.isAdmin = userData.is_admin || false;
    // Проверка бана
    if (userData.banned_until) {
      const until = new Date(userData.banned_until)
      const isPermanent = until.getFullYear() >= 2099
      const msg = isPermanent
        ? 'Ваш аккаунт заблокирован навсегда за нарушение правил сообщества.'
        : `Ваш аккаунт заблокирован до ${until.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}.`
      if (until > new Date()) {
        await supabase.auth.signOut()
        Alert.alert('Аккаунт заблокирован', msg)
        return
      }
    }
    navigation.navigate('Main');
  };

  const isValidEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  const isValid = isValidEmail(email) && password.length >= 6;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        {/* Лого */}
        <View style={styles.logoArea}>
          <Image source={require('../assets/icon.png')} style={styles.appIcon} />
          <Text style={styles.appName}>не один</Text>
        </View>

        <Text style={styles.title}>Всё достало?</Text>
        <Text style={styles.subtitle}>Здесь тебя поймут</Text>

        {/* Email */}
        <View style={styles.field}>
          <Ionicons name="mail-outline" size={18} color={colors.muted} style={styles.fieldIcon} />
          <TextInput
            style={styles.fieldInput}
            placeholder="Email"
            placeholderTextColor={colors.muted}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* Пароль */}
        <View style={styles.field}>
          <Ionicons name="lock-closed-outline" size={18} color={colors.muted} style={styles.fieldIcon} />
          <TextInput
            style={styles.fieldInput}
            placeholder="Пароль"
            placeholderTextColor={colors.muted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPass}
          />
          <TouchableOpacity onPress={() => setShowPass(v => !v)} style={styles.eyeBtn}>
            <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.muted} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.button, !isValid && styles.buttonDisabled]}
          onPress={login}
          disabled={!isValid || loading}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>{loading ? 'Входим...' : 'Войти'}</Text>
        </TouchableOpacity>

        <View style={styles.registerRow}>
          <Text style={styles.registerHint}>Впервые здесь?</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <Text style={styles.registerLink}> Создать аккаунт</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.supportBtn} onPress={openSupport}>
          <Ionicons name="chatbubble-ellipses-outline" size={15} color={colors.muted} />
          <Text style={styles.supportBtnText}>Написать в поддержку</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={showSupport} transparent animationType="slide" onRequestClose={() => setShowSupport(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <TouchableOpacity style={styles.supportOverlay} activeOpacity={1} onPress={() => setShowSupport(false)}>
            <TouchableOpacity activeOpacity={1} style={styles.supportModal}>
              <View style={styles.supportModalHandle} />
              <Text style={styles.supportModalTitle}>Написать в поддержку</Text>
              <Text style={styles.supportModalSub}>Опиши проблему — ответим на почту</Text>

              <TextInput
                style={styles.supportInput}
                placeholder="Твой email для ответа"
                placeholderTextColor={colors.muted}
                value={supportEmail}
                onChangeText={setSupportEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <TextInput
                style={styles.supportInput}
                placeholder="Тема"
                placeholderTextColor={colors.muted}
                value={supportTopic}
                onChangeText={setSupportTopic}
              />
              <TextInput
                style={[styles.supportInput, { height: 100, textAlignVertical: 'top' }]}
                placeholder="Сообщение"
                placeholderTextColor={colors.muted}
                value={supportText}
                onChangeText={setSupportText}
                multiline
              />

              <TouchableOpacity
                style={[styles.supportSendBtn, (!supportTopic.trim() || !supportText.trim()) && { opacity: 0.4 }]}
                onPress={sendSupport}
                disabled={!supportTopic.trim() || !supportText.trim() || supportLoading}
              >
                <Text style={styles.supportSendText}>{supportLoading ? 'Отправляем...' : 'Отправить'}</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  container: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 48,
  },

  logoArea: { alignItems: 'center', marginBottom: 32 },
  appIcon: { width: 72, height: 72, borderRadius: 18, marginBottom: 10 },
  appName: {
    fontSize: 22, fontWeight: '800',
    color: colors.white, letterSpacing: 0.5,
  },

  title: {
    fontSize: 30, fontWeight: 'bold',
    color: colors.white, marginBottom: 6, textAlign: 'center',
  },
  subtitle: {
    fontSize: 15, color: colors.muted,
    marginBottom: 36, textAlign: 'center',
  },

  field: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 14,
    paddingHorizontal: 14,
    marginBottom: 12,
    width: '100%',
    borderWidth: 1,
    borderColor: colors.border,
  },
  fieldIcon: { marginRight: 10 },
  fieldInput: {
    flex: 1,
    color: colors.white,
    fontSize: 16,
    paddingVertical: 15,
  },
  eyeBtn: { padding: 4 },

  button: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    width: '100%',
    marginTop: 4,
    marginBottom: 16,
  },
  buttonDisabled: { opacity: 0.35 },
  buttonText: { color: colors.onAccent, fontSize: 16, fontWeight: '600' },

  registerRow: { flexDirection: 'row', alignItems: 'center' },
  registerHint: { color: colors.muted, fontSize: 15 },
  registerLink: { color: colors.accent, fontSize: 15, fontWeight: '600' },

  supportBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 28, paddingVertical: 8 },
  supportBtnText: { color: colors.muted, fontSize: 13 },

  supportOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.3)' },
  supportModal: { backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  supportModalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#D0C4B0', alignSelf: 'center', marginBottom: 20 },
  supportModalTitle: { fontSize: 18, fontWeight: '700', color: colors.white, marginBottom: 6 },
  supportModalSub: { fontSize: 13, color: colors.muted, marginBottom: 20 },
  supportInput: {
    backgroundColor: colors.card, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: colors.white, borderWidth: 1, borderColor: colors.border, marginBottom: 12,
  },
  supportSendBtn: { backgroundColor: colors.accent, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 4 },
  supportSendText: { color: colors.onAccent, fontSize: 16, fontWeight: '600' },
});
