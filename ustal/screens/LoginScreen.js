import {
  View, StyleSheet, Text, TouchableOpacity,
  TextInput, Alert, KeyboardAvoidingView, Platform, ScrollView,
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
      .select('username, level, email, avatar_url, status')
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
          <View style={styles.logoCircle}>
            <Ionicons name="moon" size={30} color={colors.accent} />
          </View>
          <Text style={styles.appName}>устал</Text>
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
      </ScrollView>
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
  logoCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: colors.accent + '1a',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 10,
  },
  appName: {
    fontSize: 13, letterSpacing: 3,
    color: colors.muted, fontWeight: '500',
    textTransform: 'lowercase',
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
});
