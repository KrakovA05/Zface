import {
  StyleSheet, Text, View, TouchableOpacity,
  ScrollView, TextInput, Alert, Linking,
} from 'react-native';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../supabase';
import { store } from '../store';
import { LABELS } from '../constants';
import { colors } from '../theme';
import { EMAIL_CONFIRM_ENABLED } from '../config';

const validateName = (v) => {
  if (!v.trim()) return 'Введи имя';
  if (v.trim().length < 2) return 'Минимум 2 символа';
  if (v.trim().length > 20) return 'Максимум 20 символов';
  if (/[^a-zA-Zа-яёА-ЯЁ0-9_\- ]/.test(v.trim())) return 'Недопустимые символы';
  return '';
};

const validateEmail = (v) => {
  if (!v) return 'Введи email';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Неверный формат email';
  return '';
};

const validatePassword = (v) => {
  if (!v) return 'Введи пароль';
  if (v.length < 8) return 'Минимум 8 символов';
  if (v.length > 50) return 'Максимум 50 символов';
  if (/[а-яёА-ЯЁ]/.test(v)) return 'Без кириллицы';
  if (!/[A-Z]/.test(v)) return 'Нужна заглавная буква (A-Z)';
  if (!/[a-z]/.test(v)) return 'Нужна строчная буква (a-z)';
  if (!/[0-9]/.test(v)) return 'Нужна цифра';
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(v)) return 'Нужен спецсимвол (!@#$%...)';
  return '';
};

export default function RegisterScreen({ navigation }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [errors, setErrors] = useState({ name: '', email: '', password: '', labels: '' });

  const toggleLabel = (label) => {
    setSelected(prev => {
      const next = prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label];
      if (next.length > 0) setErrors(e => ({ ...e, labels: '' }));
      return next;
    });
  };

  const validate = () => {
    const newErrors = {
      name: validateName(name),
      email: validateEmail(email),
      password: validatePassword(password),
      labels: selected.length === 0 ? 'Выбери хотя бы один ярлык' : '',
    };
    setErrors(newErrors);
    return !Object.values(newErrors).some(Boolean);
  };

  const register = async () => {
    if (!validate()) return;
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setLoading(false);
      Alert.alert('Ошибка регистрации', error.message);
      return;
    }

    if (EMAIL_CONFIRM_ENABLED || !data.session) {
      setLoading(false);
      navigation.navigate('EmailConfirm', {
        email,
        password,
        username: name.trim(),
        labels: selected,
      });
      return;
    }

    const { error: insertError } = await supabase.from('users').upsert({
      username: name.trim(),
      labels: selected,
      user_id: data.user.id,
      email,
    }, { onConflict: 'user_id' });
    setLoading(false);
    if (insertError) {
      await supabase.auth.signOut();
      Alert.alert('Ошибка', insertError.message || 'Не удалось создать профиль.');
      return;
    }
    store.userId = data.user.id;
    store.username = name.trim();
    store.email = email;
    navigation.navigate('Test');
  };

  return (
    <View style={styles.safeArea}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Шапка */}
        <View style={styles.header}>
          <View style={styles.logoCircle}>
            <Ionicons name="moon" size={22} color={colors.accent} />
          </View>
          <Text style={styles.appName}>устал</Text>
        </View>

        <Text style={styles.title}>Расскажи о себе</Text>
        <Text style={styles.subtitle}>Это поможет найти своих</Text>

        {/* Имя */}
        <View style={[styles.field, errors.name && styles.fieldError]}>
          <Ionicons name="person-outline" size={18} color={colors.muted} style={styles.fieldIcon} />
          <TextInput
            style={styles.fieldInput}
            placeholder="Как тебя зовут?"
            placeholderTextColor={colors.muted}
            value={name}
            onChangeText={v => { setName(v); setErrors(e => ({ ...e, name: '' })); }}
          />
        </View>
        {errors.name ? <Text style={styles.errorText}>{errors.name}</Text> : null}

        {/* Email */}
        <View style={[styles.field, errors.email && styles.fieldError]}>
          <Ionicons name="mail-outline" size={18} color={colors.muted} style={styles.fieldIcon} />
          <TextInput
            style={styles.fieldInput}
            placeholder="Email"
            placeholderTextColor={colors.muted}
            value={email}
            onChangeText={v => { setEmail(v); setErrors(e => ({ ...e, email: '' })); }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}

        {/* Пароль */}
        <View style={[styles.field, errors.password && styles.fieldError]}>
          <Ionicons name="lock-closed-outline" size={18} color={colors.muted} style={styles.fieldIcon} />
          <TextInput
            style={styles.fieldInput}
            placeholder="Пароль"
            placeholderTextColor={colors.muted}
            value={password}
            onChangeText={v => { setPassword(v); setErrors(e => ({ ...e, password: '' })); }}
            secureTextEntry={!showPass}
          />
          <TouchableOpacity onPress={() => setShowPass(v => !v)} style={styles.eyeBtn}>
            <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.muted} />
          </TouchableOpacity>
        </View>
        {errors.password
          ? <Text style={styles.errorText}>{errors.password}</Text>
          : <Text style={styles.hintText}>Мин. 8 симв., заглавная, цифра, спецсимвол</Text>
        }

        {/* Ярлыки */}
        <Text style={styles.sectionLabel}>Выбери свои ярлыки</Text>
        <View style={styles.labelsWrap}>
          {LABELS.map(label => (
            <TouchableOpacity
              key={label}
              style={[styles.labelChip, selected.includes(label) && styles.labelChipActive]}
              onPress={() => toggleLabel(label)}
              activeOpacity={0.7}
            >
              <Text style={[styles.labelText, selected.includes(label) && styles.labelTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {errors.labels ? <Text style={styles.errorText}>{errors.labels}</Text> : null}

        <TouchableOpacity
          style={styles.privacyRow}
          onPress={() => setPrivacyAccepted(v => !v)}
          activeOpacity={0.7}
        >
          <View style={[styles.checkbox, privacyAccepted && styles.checkboxActive]}>
            {privacyAccepted && <Ionicons name="checkmark" size={13} color={colors.onAccent} />}
          </View>
          <Text style={styles.privacyText}>
            Я принимаю{' '}
            <Text
              style={styles.privacyLink}
              onPress={() => Linking.openURL('https://krakova05.github.io/Zface/')}
            >
              политику конфиденциальности
            </Text>
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, (!privacyAccepted || loading) && styles.buttonDisabled]}
          onPress={register}
          disabled={!privacyAccepted || loading}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>{loading ? 'Создаём аккаунт...' : 'Создать аккаунт'}</Text>
        </TouchableOpacity>

        <View style={styles.loginRow}>
          <Text style={styles.loginHint}>Уже есть аккаунт?</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.loginLink}> Войти</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 28, paddingTop: 48, paddingBottom: 40 },

  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 28 },
  logoCircle: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.accent + '1a',
    alignItems: 'center', justifyContent: 'center',
  },
  appName: {
    fontSize: 13, letterSpacing: 3,
    color: colors.muted, fontWeight: '500',
    textTransform: 'lowercase',
  },

  title: {
    fontSize: 26, fontWeight: 'bold',
    color: colors.white, marginBottom: 6,
  },
  subtitle: {
    fontSize: 15, color: colors.muted, marginBottom: 28,
  },

  field: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 14,
    paddingHorizontal: 14,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  fieldError: { borderColor: '#e74c3c' },
  fieldIcon: { marginRight: 10 },
  fieldInput: {
    flex: 1,
    color: colors.white,
    fontSize: 16,
    paddingVertical: 15,
  },
  eyeBtn: { padding: 4 },
  errorText: { color: '#e74c3c', fontSize: 12, marginBottom: 10, marginLeft: 4 },
  hintText: { color: colors.muted, fontSize: 11, marginBottom: 10, marginLeft: 4 },

  sectionLabel: {
    fontSize: 13, color: colors.muted, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.6,
    marginTop: 16, marginBottom: 12,
  },
  labelsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  labelChip: {
    borderWidth: 1, borderColor: colors.border,
    borderRadius: 20,
    paddingVertical: 8, paddingHorizontal: 14,
    backgroundColor: colors.card,
  },
  labelChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  labelText: { color: colors.muted, fontSize: 14 },
  labelTextActive: { color: colors.onAccent },

  privacyRow: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: 16, marginBottom: 4, gap: 10,
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  privacyText: { flex: 1, color: colors.muted, fontSize: 13, lineHeight: 18 },
  privacyLink: { color: colors.accent, textDecorationLine: 'underline' },

  button: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 16,
  },
  buttonDisabled: { opacity: 0.35 },
  buttonText: { color: colors.onAccent, fontSize: 16, fontWeight: '600' },

  loginRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  loginHint: { color: colors.muted, fontSize: 15 },
  loginLink: { color: colors.accent, fontSize: 15, fontWeight: '600' },
});
