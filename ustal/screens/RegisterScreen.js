import { StyleSheet, Text, View, TouchableOpacity, ScrollView, TextInput, Alert } from 'react-native';
import { useState } from 'react';
import { supabase } from '../supabase';
import { store } from '../store';
import { LABELS } from '../constants';
import { colors, shared } from '../theme';

const validateName = (v) => {
  if (!v.trim()) return 'Введи имя';
  if (v.trim().length < 2) return 'Имя слишком короткое — минимум 2 символа';
  if (v.trim().length > 20) return 'Имя слишком длинное — максимум 20 символов';
  if (/[^a-zA-Zа-яёА-ЯЁ0-9_\- ]/.test(v.trim())) return 'Имя содержит недопустимые символы';
  return '';
};

const validateEmail = (v) => {
  if (!v) return 'Введи email';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Неверный формат email';
  return '';
};

const validatePassword = (v) => {
  if (!v) return 'Введи пароль';
  if (v.length < 8) return 'Пароль слишком короткий — минимум 8 символов';
  if (v.length > 50) return 'Пароль слишком длинный — максимум 50 символов';
  if (/[а-яёА-ЯЁ]/.test(v)) return 'Пароль не должен содержать кириллицу';
  if (!/[A-Z]/.test(v)) return 'Пароль должен содержать хотя бы одну заглавную букву (A-Z)';
  if (!/[a-z]/.test(v)) return 'Пароль должен содержать хотя бы одну строчную букву (a-z)';
  if (!/[0-9]/.test(v)) return 'Пароль должен содержать хотя бы одну цифру';
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(v))
    return 'Пароль должен содержать хотя бы один спецсимвол (!@#$%...)';
  return '';
};

export default function RegisterScreen({ navigation }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
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

    const { error: insertError } = await supabase.from('users').insert({
      username: name.trim(),
      labels: selected,
      user_id: data.user.id,
      email,
    });

    if (insertError) {
      // Удаляем auth-аккаунт чтобы не оставлять сироту без профиля
      await supabase.auth.signOut();
      setLoading(false);
      Alert.alert('Ошибка', 'Не удалось создать профиль. Попробуй ещё раз.');
      return;
    }

    setLoading(false);

    store.userId = data.user.id;
    store.username = name.trim();
    store.email = email;
    navigation.navigate('Test');
  };

  return (
    <View style={styles.safeArea}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Расскажи о себе</Text>
        <Text style={shared.subtitle}>Это поможет найти своих 🖤</Text>

        <TextInput
          style={[shared.input, errors.name ? styles.inputError : null]}
          placeholder="Как тебя зовут?"
          placeholderTextColor={colors.muted}
          value={name}
          onChangeText={v => { setName(v); setErrors(e => ({ ...e, name: '' })); }}
        />
        {errors.name ? <Text style={styles.errorText}>{errors.name}</Text> : null}

        <TextInput
          style={[shared.input, errors.email ? styles.inputError : null]}
          placeholder="Email"
          placeholderTextColor={colors.muted}
          value={email}
          onChangeText={v => { setEmail(v); setErrors(e => ({ ...e, email: '' })); }}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}

        <TextInput
          style={[shared.input, errors.password ? styles.inputError : null]}
          placeholder="Пароль (мин. 8 симв., A-z, цифра, спецсимвол)"
          placeholderTextColor={colors.muted}
          value={password}
          onChangeText={v => { setPassword(v); setErrors(e => ({ ...e, password: '' })); }}
          secureTextEntry
        />
        {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}

        <Text style={styles.sectionTitle}>Выбери свои ярлыки:</Text>
        <View style={styles.labels}>
          {LABELS.map(label => (
            <TouchableOpacity
              key={label}
              style={[shared.label, selected.includes(label) && shared.labelSelected]}
              onPress={() => toggleLabel(label)}
            >
              <Text style={[shared.labelText, selected.includes(label) && shared.labelTextSelected]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {errors.labels ? <Text style={styles.errorText}>{errors.labels}</Text> : null}

        <TouchableOpacity
          style={[shared.button, loading && shared.buttonDisabled]}
          onPress={register}
          disabled={loading}
        >
          <Text style={shared.buttonText}>{loading ? 'Создаём аккаунт...' : 'Войти в своих 🖤'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.loginLink}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.loginLinkText}>Уже есть аккаунт? Войти</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: { padding: 24, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: 'bold', color: colors.white, marginBottom: 8 },
  sectionTitle: { fontSize: 16, color: colors.muted, marginTop: 12, marginBottom: 16 },
  labels: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  loginLink: { paddingVertical: 12, alignItems: 'center' },
  loginLinkText: { color: colors.pink, fontSize: 15 },
  inputError: { borderWidth: 1, borderColor: '#e74c3c' },
  errorText: { color: '#e74c3c', fontSize: 12, marginTop: -8, marginBottom: 10, marginLeft: 4 },
});
