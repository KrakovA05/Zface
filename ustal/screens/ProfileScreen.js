import {
  StyleSheet, Text, View, TouchableOpacity, Share,
  ScrollView, Alert, TextInput, ActivityIndicator,
} from 'react-native';
import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../supabase';
import { store } from '../store';
import { LEVEL_DATA, MOTIVATORS, ACHIEVEMENTS } from '../constants';
import { colors } from '../theme';
import Avatar from '../components/Avatar';

const LEVEL_ICONS = {
  green: 'leaf-outline',
  yellow: 'partly-sunny-outline',
  red: 'flame-outline',
};

function Section({ title, children }) {
  return (
    <View style={styles.section}>
      {title ? <Text style={styles.sectionTitle}>{title}</Text> : null}
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Row({ icon, label, value, valueColor, onPress, danger, last }) {
  return (
    <TouchableOpacity
      style={[styles.row, last && styles.rowLast]}
      onPress={onPress}
      activeOpacity={onPress ? 0.65 : 1}
      disabled={!onPress}
    >
      <View style={[styles.rowIconWrap, { backgroundColor: (danger ? colors.pink : colors.accent) + '22' }]}>
        <Ionicons name={icon} size={18} color={danger ? colors.pink : colors.accent} />
      </View>
      <Text style={[styles.rowLabel, danger && { color: colors.pink }]}>{label}</Text>
      {value ? (
        <Text style={[styles.rowValue, valueColor && { color: valueColor }]} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {onPress ? <Ionicons name="chevron-forward" size={15} color={colors.muted} style={{ marginLeft: 4 }} /> : null}
    </TouchableOpacity>
  );
}

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
          // тихий fallback
        }
      };
      loadProfile();
      checkAndAwardAchievements();
    }, [])
  );

  const level = LEVEL_DATA[store.level] || LEVEL_DATA.green;

  const checkAndAwardAchievements = async () => {
    if (!store.userId) return;

    const { data: existing } = await supabase
      .from('user_achievements')
      .select('achievement_id')
      .eq('user_id', store.userId);
    const earned = new Set((existing || []).map(e => e.achievement_id));

    const toAward = [];

    const { count: testCount } = await supabase
      .from('test_results').select('*', { count: 'exact', head: true }).eq('user_id', store.userId);
    if (testCount >= 1 && !earned.has('first_test')) toAward.push('first_test');
    if (testCount >= 5 && !earned.has('five_tests')) toAward.push('five_tests');
    if (testCount >= 10 && !earned.has('ten_tests')) toAward.push('ten_tests');

    if (!earned.has('comeback')) {
      const { data: tests } = await supabase
        .from('test_results').select('level').eq('user_id', store.userId)
        .order('created_at', { ascending: false }).limit(10);
      const levels = (tests || []).map(t => t.level);
      for (let i = 0; i < levels.length - 1; i++) {
        if (levels[i] !== 'red' && levels[i + 1] === 'red') { toAward.push('comeback'); break; }
      }
    }

    if (!earned.has('stable')) {
      const { data: tests } = await supabase
        .from('test_results').select('level').eq('user_id', store.userId)
        .order('created_at', { ascending: false }).limit(3);
      if (tests?.length === 3 && tests.every(t => t.level === 'green')) toAward.push('stable');
    }

    if (!earned.has('first_friend')) {
      const { count: fc } = await supabase
        .from('friendships').select('*', { count: 'exact', head: true })
        .or(`requester_id.eq.${store.userId},receiver_id.eq.${store.userId}`)
        .eq('status', 'accepted');
      if (fc >= 1) toAward.push('first_friend');
    }

    if (!earned.has('first_dm')) {
      const { count: dc } = await supabase
        .from('direct_messages').select('*', { count: 'exact', head: true }).eq('sender_id', store.userId);
      if (dc >= 1) toAward.push('first_dm');
    }

    if (!earned.has('profile_done') && store.status && store.avatarUrl) {
      toAward.push('profile_done');
    }

    if (!earned.has('first_post')) {
      const { count: pc } = await supabase
        .from('feed_posts').select('*', { count: 'exact', head: true }).eq('author_id', store.userId);
      if (pc >= 1) toAward.push('first_post');
    }

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

    if (toAward.length > 0) {
      await supabase.from('user_achievements').insert(
        toAward.map(id => ({ user_id: store.userId, achievement_id: id }))
      );
      toAward.forEach(id => earned.add(id));
    }

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
    const mimeType = asset.mimeType || '';
    if (!mimeType.startsWith('image/')) {
      Alert.alert('Ошибка', 'Можно загружать только изображения');
      return;
    }
    const base64Size = (asset.base64?.length || 0) * 0.75;
    if (base64Size > 2 * 1024 * 1024) {
      Alert.alert('Файл слишком большой', 'Максимальный размер аватара — 2 МБ. Выбери другое фото.');
      return;
    }

    const dataUri = `data:image/jpeg;base64,${asset.base64}`;
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
            const channels = supabase.getChannels();
            await Promise.all(channels.map(ch => supabase.removeChannel(ch)));
            store.username = ''; store.email = ''; store.level = 'green';
            store.userId = ''; store.avatarUrl = ''; store.status = '';
            navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
          },
        },
      ]
    );
  };

  const logout = async () => {
    const channels = supabase.getChannels();
    await Promise.all(channels.map(ch => supabase.removeChannel(ch)));
    const { error } = await supabase.auth.signOut();
    if (error) {
      Alert.alert('Ошибка', 'Не удалось выйти. Попробуй ещё раз.');
      return;
    }
    store.username = ''; store.email = ''; store.level = 'green';
    store.userId = ''; store.avatarUrl = ''; store.status = '';
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  return (
    <View style={styles.safeArea}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        contentInset={{ bottom: 80 }}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <TouchableOpacity style={styles.avatarWrap} onPress={pickAvatar} activeOpacity={0.8}>
            {uploadingAvatar
              ? <View style={styles.avatarLoader}><ActivityIndicator color={colors.accent} /></View>
              : <Avatar uri={avatarUri} username={store.username} level={store.level} size={88} />
            }
            <View style={styles.cameraBadge}>
              <Ionicons name="camera" size={14} color="#fff" />
            </View>
          </TouchableOpacity>

          <Text style={[styles.heroName, { color: level.color }]}>{store.username}</Text>

          <View style={[styles.levelBadge, { borderColor: level.color + '55' }]}>
            <Ionicons name={LEVEL_ICONS[store.level] || 'ellipse-outline'} size={12} color={level.color} />
            <Text style={[styles.levelBadgeText, { color: level.color }]}>{level.label}</Text>
          </View>

          {/* Статус */}
          {editingStatus ? (
            <View style={styles.statusEditWrap}>
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
                <TouchableOpacity style={styles.statusSaveBtn} onPress={saveStatus} disabled={savingStatus}>
                  {savingStatus
                    ? <ActivityIndicator color={colors.onAccent} size="small" />
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
            <TouchableOpacity onPress={() => setEditingStatus(true)} style={styles.statusRow}>
              <Text style={status ? styles.statusText : styles.statusPlaceholder} numberOfLines={2}>
                {status || 'Добавить статус...'}
              </Text>
              <Ionicons name="pencil-outline" size={13} color={colors.muted} style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          )}
        </View>

        {/* Аккаунт */}
        <Section title="Аккаунт">
          <Row icon="person-outline" label="Ник" value={store.username} valueColor={level.color} last={false} />
          <Row icon="mail-outline" label="Email" value={store.email} last={false} />
          <Row
            icon={LEVEL_ICONS[store.level] || 'ellipse-outline'}
            label="Уровень"
            value={level.label}
            valueColor={level.color}
            last
          />
        </Section>

        {/* Мотиватор */}
        <Section title="На сегодня">
          <View style={[styles.row, styles.rowLast, { alignItems: 'flex-start' }]}>
            <View style={[styles.rowIconWrap, { backgroundColor: colors.accent + '22', marginTop: 2 }]}>
              <Ionicons name="chatbox-outline" size={18} color={colors.accent} />
            </View>
            <Text style={styles.motivatorText}>{motivator}</Text>
          </View>
        </Section>

        {/* Достижения */}
        {earnedAchievements.length > 0 && (
          <Section title={`Достижения ${earnedAchievements.length}/${ACHIEVEMENTS.length}`}>
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
                    <Text style={[styles.achievementLabel, !earned && { color: colors.muted }]}>{a.label}</Text>
                    <Text style={styles.achievementDesc}>{earned ? a.desc : '?'}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Section>
        )}

        {/* Действия */}
        <Section title="Действия">
          <Row icon="share-outline" label="Пригласить друга" onPress={inviteFriend} last={false} />
          <Row icon="log-out-outline" label="Выйти" onPress={logout} danger last />
        </Section>

        <TouchableOpacity style={styles.deleteBtn} onPress={deleteAccount}>
          <Text style={styles.deleteBtnText}>Удалить аккаунт</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: { paddingBottom: 32 },

  // Hero
  hero: {
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 28,
    paddingHorizontal: 24,
  },
  avatarWrap: { position: 'relative', marginBottom: 14 },
  avatarLoader: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: colors.card,
    alignItems: 'center', justifyContent: 'center',
  },
  cameraBadge: {
    position: 'absolute', bottom: 2, right: 2,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.background,
  },
  heroName: { fontSize: 22, fontWeight: 'bold', marginBottom: 6 },
  levelBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4,
    marginBottom: 14,
  },
  levelBadgeText: { fontSize: 12, fontWeight: '600' },
  statusRow: {
    flexDirection: 'row', alignItems: 'center',
    maxWidth: '80%',
  },
  statusText: { color: colors.white, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  statusPlaceholder: { color: colors.muted, fontSize: 14, fontStyle: 'italic' },
  statusEditWrap: { width: '100%', marginTop: 4 },
  statusInput: {
    backgroundColor: colors.card, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    color: colors.white, fontSize: 15, marginBottom: 10,
  },
  statusActions: { flexDirection: 'row', gap: 10 },
  statusSaveBtn: {
    flex: 1, backgroundColor: colors.accent,
    borderRadius: 10, padding: 10, alignItems: 'center',
  },
  statusSaveBtnText: { color: colors.onAccent, fontWeight: '600' },
  statusCancelBtn: {
    flex: 1, borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, padding: 10, alignItems: 'center',
  },
  statusCancelBtnText: { color: colors.muted },

  // Sections
  section: { marginBottom: 8, paddingHorizontal: 16 },
  sectionTitle: {
    fontSize: 12, fontWeight: '600', color: colors.muted,
    textTransform: 'uppercase', letterSpacing: 0.6,
    marginBottom: 6, paddingLeft: 4,
  },
  sectionBody: {
    backgroundColor: colors.card,
    borderRadius: 16,
    overflow: 'hidden',
  },

  // Rows
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: 12,
  },
  rowLast: { borderBottomWidth: 0 },
  rowIconWrap: {
    width: 32, height: 32, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
  },
  rowLabel: { flex: 1, fontSize: 15, color: colors.white },
  rowValue: { fontSize: 15, color: colors.muted, maxWidth: '45%' },

  // Motivator
  motivatorText: {
    flex: 1, fontSize: 15, color: colors.white, lineHeight: 22,
  },

  // Achievements
  achievementsGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    padding: 10, gap: 8,
  },
  achievementItem: {
    width: '30%', flexGrow: 1,
    backgroundColor: colors.background,
    borderRadius: 12, padding: 10, alignItems: 'center', gap: 4,
  },
  achievementLocked: { opacity: 0.35 },
  achievementEmoji: { fontSize: 24 },
  achievementLabel: { color: colors.white, fontSize: 11, fontWeight: '600', textAlign: 'center' },
  achievementDesc: { color: colors.muted, fontSize: 9, textAlign: 'center', lineHeight: 13 },

  // Delete
  deleteBtn: { alignItems: 'center', paddingVertical: 16 },
  deleteBtnText: { color: colors.muted, fontSize: 13 },
});
