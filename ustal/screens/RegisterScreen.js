import { StyleSheet, Text, View, TouchableOpacity, ScrollView, TextInput, Alert } from 'react-native';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';
import { store } from '../store';
import { LABELS } from '../constants';
import { colors, shared } from '../theme';

export default function RegisterScreen({ navigation }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);

  const toggleLabel = (label) => {
    setSelected(prev =>
      prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]
    );
  };

  const register = async () => {
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setLoading(false);
      Alert.alert('Ошибка', error.message);
      return;
    }

    const { error: insertError } = await supabase.from('users').insert({
      username: name,
      labels: selected,
      user_id: data.user.id,
      email,
    });

    setLoading(false);

    if (insertError) {
      Alert.alert('Ошибка', 'Не удалось создать профиль. Попробуй ещё раз.');
      return;
    }

    store.userId = data.user.id;
    store.username = name;
    store.email = email;
    navigation.navigate('Test');
  };

  const isValid = !!name && !!email && password.length >= 6 && selected.length > 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Расскажи о себе</Text>
        <Text style={shared.subtitle}>Это поможет найти своих 🖤</Text>

        <TextInput
          style={shared.input}
          placeholder="Как тебя зовут?"
          placeholderTextColor={colors.muted}
          value={name}
          onChangeText={setName}
        />
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
          placeholder="Пароль (минимум 6 символов)"
          placeholderTextColor={colors.muted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

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

        <TouchableOpacity
          style={[shared.button, !isValid && shared.buttonDisabled]}
          onPress={register}
          disabled={!isValid || loading}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.white,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    color: colors.muted,
    marginTop: 12,
    marginBottom: 16,
  },
  labels: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 32,
  },
  loginLink: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  loginLinkText: {
    color: colors.pink,
    fontSize: 15,
  },
});
