import {
  StyleSheet, Text, View, TouchableOpacity, Share,
  ScrollView, Alert, TextInput, ActivityIndicator,
} from 'react-native';
import { useState, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../supabase';
import { store } from '../store';
import { LEVEL_DATA, MOTIVATORS } from '../constants';
import { colors } from '../theme';
import Avatar from '../components/Avatar';

export default function ProfileScreen({ navigation }) {
  const [status, setStatus] = useState(store.status || '');
  const [avatarUri, setAvatarUri] = useState(store.avatarUrl || null);
  const [editingStatus, setEditingStatus] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [motivator] = useState(
    () => MOTIVATORS[Math.floor(Math.random() * MOTIVATORS.length)]
  );

  useFocusEffect(
    useCallback(() => {
      setStatus(store.status || '');
      setAvatarUri(store.avatarUrl || null);
    }, [])
  );

  const level = LEVEL_DATA[store.level] || LEVEL_DATA.green;

  const saveStatus = async () => {
    setSavingStatus(true);
    const { error } = await supabase
      .from('users')
      .update({ status })
      .eq('user_id', store.userId);
    setSavingStatus(false);
    if (error) {
      Alert.alert('Ошибка', 'Не удалось сохранить статус');
      return;
    }
    store.status = status;
    setEditingStatus(false);
  };

  const pickAvatar = async () => {
    const { status: permStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permStatus !== 'granted') {
      Alert.alert('Нет доступа', 'Разреши доступ к фото в настройках телефона');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.4,
      base64: true,
    });
    if (result.canceled) return;

    const base64 = result.assets[0].base64;
    const dataUri = `data:image/jpeg;base64,${base64}`;

    setUploadingAvatar(true);
    const { error } = await supabase
      .from('users')
      .update({ avatar_url: dataUri })
      .eq('user_id', store.userId);
    setUploadingAvatar(false);

    if (error) {
      Alert.alert('Ошибка', 'Не удалось сохранить аватар');
      return;
    }
    store.avatarUrl = dataUri;
    setAvatarUri(dataUri);
  };

  const inviteFriend = async () => {
    await Share.share({
      message: 'Я в приложении "Устал" — там можно просто быть, без дедлайнов и forced happiness 🖤 Присоединяйся!',
    });
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      Alert.alert('Ошибка', 'Не удалось выйти. Попробуй ещё раз.');
      return;
    }
    store.username = '';
    store.email = '';
    store.level = 'green';
    store.userId = '';
    store.avatarUrl = '';
    store.status = '';
    navigation.navigate('Login');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.title}>👤 Мой профиль</Text>

        {/* Avatar */}
        <View style={styles.avatarSection}>
          {uploadingAvatar
            ? <ActivityIndicator size="large" color={colors.accent} />
            : <Avatar uri={avatarUri} username={store.username} level={store.level} size={90} />
          }
          <TouchableOpacity style={styles.avatarButton} onPress={pickAvatar}>
            <Text style={styles.avatarButtonText}>Изменить фото</Text>
          </TouchableOpacity>
        </View>

        {/* Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Личная информация</Text>
          <Text style={styles.infoLabel}>Ник</Text>
          <Text style={[styles.infoValue, { color: level.color }]}>{store.username}</Text>
          <Text style={styles.infoLabel}>Email</Text>
          <Text style={styles.infoValue}>{store.email}</Text>
        </View>

        {/* Status */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Статус</Text>
          {editingStatus ? (
            <View>
              <TextInput
                style={styles.statusInput}
                value={status}
                onChangeText={setStatus}
                placeholder="Как ты сейчас?"
                placeholderTextColor={colors.muted}
                maxLength={100}
                autoFocus
              />
              <View style={styles.statusActions}>
                <TouchableOpacity
                  style={styles.statusSaveBtn}
                  onPress={saveStatus}
                  disabled={savingStatus}
                >
                  {savingStatus
                    ? <ActivityIndicator color={colors.white} size="small" />
                    : <Text style={styles.statusSaveBtnText}>Сохранить</Text>
                  }
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.statusCancelBtn}
                  onPress={() => { setStatus(store.status || ''); setEditingStatus(false); }}
                >
                  <Text style={styles.statusCancelBtnText}>Отмена</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity onPress={() => setEditingStatus(true)}>
              <Text style={status ? styles.statusText : styles.statusPlaceholder}>
                {status || 'Добавить статус...'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Level */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Уровень погружённости</Text>
          <Text style={[styles.levelLabel, { color: level.color }]}>{level.label}</Text>
          <Text style={styles.levelText}>{level.text}</Text>
        </View>

        {/* Motivator */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>💬 Мотиватор дня</Text>
          <Text style={styles.motivator}>{motivator}</Text>
        </View>

        <TouchableOpacity style={styles.inviteButton} onPress={inviteFriend}>
          <Text style={styles.inviteText}>👋 Пригласи друга</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutButton} onPress={logout}>
          <Text style={styles.logoutText}>Выйти</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: { padding: 24, paddingBottom: 40 },
  title: {
    fontSize: 28, fontWeight: 'bold', color: colors.white, marginBottom: 24,
  },

  avatarSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarButton: {
    marginTop: 12,
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  avatarButtonText: {
    color: colors.accent,
    fontSize: 14,
  },

  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  cardTitle: { color: colors.muted, fontSize: 14, marginBottom: 12 },
  infoLabel: { color: colors.muted, fontSize: 12, marginBottom: 4 },
  infoValue: { color: colors.white, fontSize: 16, fontWeight: '600', marginBottom: 12 },

  statusText: { color: colors.white, fontSize: 15, lineHeight: 22 },
  statusPlaceholder: { color: colors.muted, fontSize: 15, fontStyle: 'italic' },
  statusInput: {
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: 12,
    color: colors.white,
    fontSize: 15,
    marginBottom: 10,
  },
  statusActions: { flexDirection: 'row', gap: 10 },
  statusSaveBtn: {
    flex: 1, backgroundColor: colors.accent,
    borderRadius: 10, padding: 10, alignItems: 'center',
  },
  statusSaveBtnText: { color: colors.white, fontWeight: '600' },
  statusCancelBtn: {
    flex: 1, borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, padding: 10, alignItems: 'center',
  },
  statusCancelBtnText: { color: colors.muted },

  levelLabel: { fontSize: 20, fontWeight: 'bold', marginBottom: 8 },
  levelText: { color: colors.white, fontSize: 15 },
  motivator: { color: colors.white, fontSize: 15, lineHeight: 22 },

  inviteButton: {
    backgroundColor: colors.pink, borderRadius: 12,
    padding: 18, alignItems: 'center', marginBottom: 12,
  },
  inviteText: { color: colors.white, fontSize: 16, fontWeight: '600' },
  logoutButton: {
    borderWidth: 1, borderColor: colors.pink,
    borderRadius: 12, padding: 18, alignItems: 'center',
  },
  logoutText: { color: colors.pink, fontSize: 16 },
});
