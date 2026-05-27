import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../supabase'
import { store } from '../store'
import { colors, shared } from '../theme'
import { showAlert } from '../utils/alert';

export default function AccountSettingsScreen({ navigation }) {
  const [newUsername, setNewUsername] = useState('')
  const [savingNick, setSavingNick] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPass, setSavingPass] = useState(false)

  async function saveNickname() {
    const trimmed = newUsername.trim()
    if (trimmed.length < 3 || trimmed.length > 20) {
      showAlert('Ошибка', 'Ник должен быть от 3 до 20 символов')
      return
    }
    if (!/^[a-zA-Zа-яА-ЯёЁ0-9_]+$/.test(trimmed)) {
      showAlert('Ошибка', 'Только буквы, цифры и _')
      return
    }
    if (trimmed === store.username) {
      showAlert('Ошибка', 'Ник не изменился')
      return
    }
    setSavingNick(true)
    try {
      const { data: existing } = await supabase
        .from('users')
        .select('user_id')
        .eq('username', trimmed)
        .neq('user_id', store.userId)
        .maybeSingle()
      if (existing) { showAlert('Занято', 'Этот ник уже занят'); return }
      const { error } = await supabase
        .from('users')
        .update({ username: trimmed })
        .eq('user_id', store.userId)
      if (error) throw error
      store.username = trimmed
      setNewUsername('')
      showAlert('Готово', 'Ник изменён')
    } catch (e) {
      showAlert('Ошибка', e.message || 'Не удалось изменить ник')
    } finally {
      setSavingNick(false)
    }
  }

  async function savePassword() {
    if (newPassword.length < 6) { showAlert('Ошибка', 'Пароль минимум 6 символов'); return }
    if (newPassword !== confirmPassword) { showAlert('Ошибка', 'Пароли не совпадают'); return }
    setSavingPass(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      setNewPassword('')
      setConfirmPassword('')
      supabase.functions.invoke('password-notify')
      showAlert('Готово', 'Пароль изменён')
    } catch (e) {
      showAlert('Ошибка', e.message || 'Не удалось изменить пароль')
    } finally {
      setSavingPass(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Настройки аккаунта</Text>
          <View style={{ width: 24 }} />
        </View>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

          <Text style={styles.sectionLabel}>Никнейм</Text>
          <View style={styles.card}>
            <Text style={styles.currentLabel}>Текущий ник</Text>
            <Text style={styles.currentValue}>{store.username}</Text>
            <TextInput
              style={[shared.input, styles.input]}
              placeholder="Новый ник"
              placeholderTextColor={colors.muted}
              value={newUsername}
              onChangeText={setNewUsername}
              autoCapitalize="none"
              maxLength={20}
            />
            <TouchableOpacity
              style={[shared.button, savingNick && { opacity: 0.6 }]}
              onPress={saveNickname}
              disabled={savingNick}
            >
              {savingNick
                ? <ActivityIndicator color="white" size="small" />
                : <Text style={shared.buttonText}>Сохранить ник</Text>}
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionLabel}>Пароль</Text>
          <View style={styles.card}>
            <TextInput
              style={[shared.input, styles.input]}
              placeholder="Новый пароль"
              placeholderTextColor={colors.muted}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
            />
            <TextInput
              style={[shared.input, styles.input]}
              placeholder="Повторить пароль"
              placeholderTextColor={colors.muted}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
            />
            <TouchableOpacity
              style={[shared.button, savingPass && { opacity: 0.6 }]}
              onPress={savePassword}
              disabled={savingPass}
            >
              {savingPass
                ? <ActivityIndicator color="white" size="small" />
                : <Text style={shared.buttonText}>Сменить пароль</Text>}
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E8DFD0',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  scroll: { flex: 1 },
  content: { padding: 20, gap: 12 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.muted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 8,
    marginBottom: 4,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8DFD0',
    gap: 10,
  },
  currentLabel: { fontSize: 12, color: colors.muted },
  currentValue: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 4 },
  input: { marginBottom: 0 },
})
