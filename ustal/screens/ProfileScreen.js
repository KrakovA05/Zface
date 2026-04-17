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
import { LEVEL_DATA, MOTIVATORS, ACHIEVEMENTS } from '../constants';
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
  const [earnedAchievements, setEarnedAchievements] = useState([]);

  useFocusEffect(
    useCallback(() => {
      if (!store.userId) return;
      const loadProfile = async () => {
        try {
          const { data, error } = await supabase
            .from('users')
            .select('status, avatar_url')
            .eq('user_id', store.userId)
            .single();
          if (error) throw error;
          if (data) {
            store.status = data.status || '';
            store.avatarUrl = data.avatar_url || '';
            setStatus(data.status || '');
            setAvatarUri(data.avatar_url || null);
          }
        } catch {
          // тихий fallback — не раскрываем детали ошибки
        }
      };
      loadProfile();
      checkAndAwardAchievements();
    }, [])
  );

  const level = LEVEL_DATA[store.level] || LEVEL_DATA.green;

  const checkAndAwardAchievements = async () => {
    if (!store.userId) return;

    // Загружаем уже выданные достижения
    const { data: existing } = await supabase
      .from('user_achievements')
      .select('achievement_id')
      .eq('user_id', store.userId);
    const earned = new Set((existing || []).map(e => e.achievement_id));

    const toAward = [];

    // first_test: есть хоть один результат теста
    const { count: testCount } = await supabase
      .from('test_results').select('*', { count: 'exact', head: true }).eq('user_id', store.userId);
    if (testCount >= 1 && !earned.has('first_test')) toAward.push('first_test');
    if (testCount >= 5 && !earned.has('five_tests')) toAward.push('five_tests');
    if (testCount >= 10 && !earned.has('ten_tests')) toAward.push('ten_tests');

    // comeback: есть переход red→yellow/green
    if (!earned.has('comeback')) {
      const { data: tests } = await supabase
        .from('test_results').select('level').eq('user_id', store.userId)
        .order('created_at', { ascending: false }).limit(10);
      const levels = (tests || []).map(t => t.level);
      for (let i = 0; i < levels.length - 1; i++) {
        if (levels[i] !== 'red' && levels[i + 1] === 'red') { toAward.push('comeback'); break; }
      }
    }

    // stable: три зелёных подряд
    if (!earned.has('stable')) {
      const { data: tests } = await supabase
        .from('test_results').select('level').eq('user_id', store.userId)
        .order('created_at', { ascending: false }).limit(3);
      if (tests?.length === 3 && tests.every(t => t.level === 'green')) toAward.push('stable');
    }

    // first_friend: есть принятая дружба
    if (!earned.has('first_friend')) {
      const { count: fc } = await supabase
        .from('friendships').select('*', { count: 'exact', head: true })
        .or(`requester_id.eq.${store.userId},receiver_id.eq.${store.userId}`)
        .eq('status', 'accepted');
      if (fc >= 1) toAward.push('first_friend');
    }

    // first_dm: отправил хоть одно личное сообщение
    if (!earned.has('first_dm')) {
      const { count: dc } = await supabase
        .from('direct_messages').select('*', { count: 'exact', head: true }).eq('sender_id', store.userId);
      if (dc >= 1) toAward.push('first_dm');
    }

    // profile_done: есть статус и аватар
    if (!earned.has('profile_done') && store.status && store.avatarUrl) {
      toAward.push('profile_done');
    }

    // first_post: написал пост в ленту
    if (!earned.has('first_post')) {
      const { count: pc } = await supabase
        .from('feed_posts').select('*', { count: 'exact', head: true }).eq('author_id', store.userId);
      if (pc >= 1) toAward.push('first_post');
    }

    // daily_7: 7 дней подряд отвечал на вопрос
    if (!earned.has('daily_7')) {
      const { data: answers } = await supabase
        .from('daily_answers').select('question_date').eq('user_id', store.userId)
        .order('question_date', { ascending: false }).limit(7);
      if (answers?.length === 7) {
        let consecutive = true;
        for (let i = 0; i < answers.length - 1; i++) {
          const d1 = new Date(answers[i].question_date);
          const d2 = new Date(answers[i + 1].question_date);
          if ((d1 - d2) / (1000 * 60 * 60 * 24) !== 1) { consecutive = false; break; }
        }
        if (consecutive) toAward.push('daily_7');
      }
    }

    // Сохраняем новые достижения
    if (toAward.length > 0) {
      await supabase.from('user_achievements').insert(
        toAward.map(id => ({ user_id: store.userId, achievement_id: id }))
      );
      toAward.forEach(id => earned.add(id));
    }

    // Загружаем все выданные для отображения
    const allEarned = ACHIEVEMENTS.filter(a => earned.has(a.id));
    setEarnedAchievements(allEarned);
  };

  const saveStatus = async () => {
    setSavingStatus(true);
    const { data, error } = await supabase
      .from('users')
      .update({ status })
      .eq('user_id', store.userId)
      .select('status')
      .single();
    setSavingStatus(false);
    if (error || !data) {
      Alert.alert('Ошибка', 'Не удалось сохранить статус. Попробуй ещё раз.');
      return;
    }
    store.status = data.status;
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

    const asset = result.assets[0];

    // Проверяем тип файла
    const mimeType = asset.mimeType || '';
    if (!mimeType.startsWith('image/')) {
      Alert.alert('Ошибка', 'Можно загружать только изображения');
      return;
    }

    // Проверяем размер (base64 ~= 4/3 * размер файла)
    const base64Size = (asset.base64?.length || 0) * 0.75;
    const maxSize = 2 * 1024 * 1024; // 2 MB
    if (base64Size > maxSize) {
      Alert.alert('Файл слишком большой', 'Максимальный размер аватара — 2 МБ. Выбери другое фото.');
      return;
    }

    const base64 = asset.base64;
    const dataUri = `data:image/jpeg;base64,${base64}`;

    setUploadingAvatar(true);
    const { data, error } = await supabase
      .from('users')
      .update({ avatar_url: dataUri })
      .eq('user_id', store.userId)
      .select('avatar_url')
      .single();
    setUploadingAvatar(false);

    if (error || !data) {
      Alert.alert('Ошибка', 'Не удалось сохранить аватар. Попробуй ещё раз.');
      return;
    }
    store.avatarUrl = data.avatar_url;
    setAvatarUri(data.avatar_url);
  };

  const inviteFriend = async () => {
    await Share.share({
      message: 'Я в приложении "Устал" — там можно просто быть, без дедлайнов и forced happiness 🖤 Присоединяйся!',
    });
  };

  const deleteAccount = () => {
    Alert.alert(
      'Удалить аккаунт',
      'Это действие необратимо. Все твои данные, сообщения и история будут удалены навсегда.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить', style: 'destructive',
          onPress: async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const { error } = await supabase.functions.invoke('delete-account');
            if (error) {
              Alert.alert('Ошибка', 'Не удалось удалить аккаунт. Попробуй позже.');
              return;
            }

            // Чистим каналы и store
            const channels = supabase.getChannels();
            await Promise.all(channels.map(ch => supabase.removeChannel(ch)));
            store.username = '';
            store.email = '';
            store.level = 'green';
            store.userId = '';
            store.avatarUrl = '';
            store.status = '';

            navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
          },
        },
      ]
    );
  };

  const logout = async () => {
    // Отписываемся от всех активных realtime-каналов
    const channels = supabase.getChannels();
    await Promise.all(channels.map(ch => supabase.removeChannel(ch)));

    const { error } = await supabase.auth.signOut();
    if (error) {
      Alert.alert('Ошибка', 'Не удалось выйти. Попробуй ещё раз.');
      return;
    }

    // Чистим store
    store.username = '';
    store.email = '';
    store.level = 'green';
    store.userId = '';
    store.avatarUrl = '';
    store.status = '';

    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
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

        {/* Достижения */}
        {earnedAchievements.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Достижения ({earnedAchievements.length}/{ACHIEVEMENTS.length})</Text>
            <View style={styles.achievementsGrid}>
              {ACHIEVEMENTS.map(a => {
                const earned = earnedAchievements.some(e => e.id === a.id);
                return (
                  <TouchableOpacity
                    key={a.id}
                    style={[styles.achievementItem, !earned && styles.achievementLocked]}
                    onPress={() => !earned && Alert.alert(a.label, `Как получить:\n${a.desc}`)}
                    activeOpacity={earned ? 1 : 0.7}
                  >
                    <Text style={styles.achievementEmoji}>{earned ? a.emoji : '🔒'}</Text>
                    <Text style={[styles.achievementLabel, !earned && styles.achievementLabelLocked]}>{a.label}</Text>
                    <Text style={styles.achievementDesc}>{earned ? a.desc : '?'}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        <TouchableOpacity style={styles.inviteButton} onPress={inviteFriend}>
          <Text style={styles.inviteText}>👋 Пригласи друга</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutButton} onPress={logout}>
          <Text style={styles.logoutText}>Выйти</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.deleteButton} onPress={deleteAccount}>
          <Text style={styles.deleteText}>Удалить аккаунт</Text>
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

  achievementsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
  },
  achievementItem: {
    width: '30%', flexGrow: 1,
    backgroundColor: colors.background,
    borderRadius: 12, padding: 10, alignItems: 'center', gap: 4,
  },
  achievementLocked: { opacity: 0.35 },
  achievementEmoji: { fontSize: 24 },
  achievementLabel: { color: colors.white, fontSize: 11, fontWeight: '600', textAlign: 'center' },
  achievementLabelLocked: { color: colors.muted },
  achievementDesc: { color: colors.muted, fontSize: 9, textAlign: 'center', lineHeight: 13 },

  inviteButton: {
    backgroundColor: colors.pink, borderRadius: 12,
    padding: 18, alignItems: 'center', marginBottom: 12,
  },
  inviteText: { color: colors.white, fontSize: 16, fontWeight: '600' },
  logoutButton: {
    borderWidth: 1, borderColor: colors.pink,
    borderRadius: 12, padding: 18, alignItems: 'center',
    marginBottom: 12,
  },
  logoutText: { color: colors.pink, fontSize: 16 },
  deleteButton: {
    borderRadius: 12, padding: 18, alignItems: 'center',
  },
  deleteText: { color: colors.muted, fontSize: 14 },
});
