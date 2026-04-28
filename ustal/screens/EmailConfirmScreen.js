import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../supabase';
import { store } from '../store';
import { colors } from '../theme';

export default function EmailConfirmScreen({ route, navigation }) {
  const { email, password, username, labels } = route.params;
  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);

  const checkConfirmed = async () => {
    setChecking(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (data?.session) {
        await supabase.from('users').upsert({
          user_id: data.user.id,
          username,
          email,
          labels: labels || [],
        }, { onConflict: 'user_id' });
        store.userId = data.user.id;
        store.username = username;
        store.email = email;
        navigation.navigate('Test');
      } else if (error?.message?.toLowerCase().includes('email')) {
        Alert.alert(
          'Письмо ещё не подтверждено',
          'Открой письмо от нас и нажми на ссылку подтверждения.',
          [{ text: 'Понятно' }]
        );
      } else {
        Alert.alert('Ошибка', error?.message || 'Попробуй ещё раз.');
      }
    } catch {
      Alert.alert('Ошибка', 'Не удалось проверить. Попробуй ещё раз.');
    }
    setChecking(false);
  };

  const resendEmail = async () => {
    setResending(true);
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    setResending(false);
    if (error) {
      Alert.alert('Ошибка', error.message);
    } else {
      Alert.alert('Готово', 'Письмо отправлено повторно.');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Ionicons name="mail-outline" size={48} color={colors.accent} />
      </View>

      <Text style={styles.title}>Подтверди email</Text>
      <Text style={styles.subtitle}>
        Мы отправили письмо на{'\n'}
        <Text style={styles.emailText}>{email}</Text>
      </Text>
      <Text style={styles.hint}>
        Открой письмо и нажми на ссылку подтверждения. После этого вернись сюда.
      </Text>

      <TouchableOpacity
        style={styles.primaryBtn}
        onPress={checkConfirmed}
        disabled={checking}
        activeOpacity={0.8}
      >
        {checking
          ? <ActivityIndicator color={colors.onAccent} />
          : <Text style={styles.primaryBtnText}>Я подтвердил</Text>
        }
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.secondaryBtn}
        onPress={resendEmail}
        disabled={resending}
        activeOpacity={0.7}
      >
        <Text style={styles.secondaryBtnText}>
          {resending ? 'Отправляем...' : 'Отправить письмо снова'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: colors.background,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 32,
  },
  iconWrap: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: colors.accent + '18',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24, fontWeight: '700', color: colors.white,
    marginBottom: 12, textAlign: 'center',
  },
  subtitle: {
    fontSize: 15, color: colors.muted, textAlign: 'center',
    lineHeight: 22, marginBottom: 12,
  },
  emailText: { color: colors.white, fontWeight: '600' },
  hint: {
    fontSize: 13, color: colors.muted, textAlign: 'center',
    lineHeight: 20, marginBottom: 36,
  },
  primaryBtn: {
    backgroundColor: colors.accent, borderRadius: 14,
    paddingVertical: 15, paddingHorizontal: 40,
    alignItems: 'center', width: '100%', marginBottom: 12,
  },
  primaryBtnText: { color: colors.onAccent, fontSize: 16, fontWeight: '600' },
  secondaryBtn: {
    paddingVertical: 10, alignItems: 'center',
  },
  secondaryBtnText: { color: colors.muted, fontSize: 14 },
});
