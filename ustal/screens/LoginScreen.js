import { StyleSheet, Text, TouchableOpacity, TextInput, Alert } from 'react-native';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';
import { store } from '../store';
import { colors, shared } from '../theme';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Всё достало?</Text>
      <Text style={shared.subtitle}>Здесь вас поймут 🖤</Text>

      <TextInput
        style={shared.input}
        placeholder="Email"
        placeholderTextColor={colors.muted}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
      />
      <TextInput
        style={shared.input}
        placeholder="Пароль"
        placeholderTextColor={colors.muted}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity
        style={[shared.button, !isValid && shared.buttonDisabled]}
        onPress={login}
        disabled={!isValid || loading}
      >
        <Text style={shared.buttonText}>{loading ? 'Входим...' : 'Войти и выдохнуть'}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={() => navigation.navigate('Register')}
      >
        <Text style={styles.secondaryText}>Впервые здесь? Зарегистрироваться</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.white,
    marginBottom: 8,
    textAlign: 'center',
  },
  secondaryButton: {
    paddingVertical: 12,
  },
  secondaryText: {
    color: colors.pink,
    fontSize: 15,
  },
});
