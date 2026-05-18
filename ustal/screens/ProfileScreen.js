import {
  StyleSheet, Text, View, TouchableOpacity, Share,
  ScrollView, Alert, TextInput, ActivityIndicator, Linking, Switch,
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


const ALL_FISH = [
  { name: 'Тихий карась',     rarity: 'common' },
  { name: 'Задумчивый окунь', rarity: 'common' },
  { name: 'Мелкий ёрш',       rarity: 'common' },
  { name: 'Дремлющий лещ',    rarity: 'common' },
  { name: 'Неспешный судак',  rarity: 'uncommon' },
  { name: 'Молчаливый линь',  rarity: 'uncommon' },
  { name: 'Серебряный карп',  rarity: 'rare' },
  { name: 'Ночная щука',      rarity: 'rare' },
  { name: 'Глубокий сом',     rarity: 'rare' },
  { name: 'Золотая рыбка',    rarity: 'legendary' },
  { name: 'Лунная форель',    rarity: 'legendary' },
];

const FISH_RARITY_COLORS = {
  common:    '#888888',
  uncommon:  '#60B8A0',
  rare:      '#7B9BD5',
  legendary: '#AA7C00',
};

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

function calcDateStreak(rows, dateField) {
  if (!rows || rows.length === 0) return 0;
  const dates = [...new Set(rows.map(r => r[dateField]))].sort().reverse();
  let streak = 0;
  const cur = new Date();
  cur.setHours(0, 0, 0, 0);
  for (const d of dates) {
    const expected = [
      cur.getFullYear(),
      String(cur.getMonth() + 1).padStart(2, '0'),
      String(cur.getDate()).padStart(2, '0'),
    ].join('-');
    if (d === expected) { streak++; cur.setDate(cur.getDate() - 1); }
    else break;
  }
  return streak;
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
  const [earnedAchievementIds, setEarnedAchievementIds] = useState(new Set());
  const [showSimilar, setShowSimilar] = useState(true);
  const [presenceStats, setPresenceStats] = useState(null);
  const [moodHistory, setMoodHistory] = useState([]);
  const [fishCollection, setFishCollection] = useState([]);

  useFocusEffect(
    useCallback(() => {
      if (!store.userId) return;
      const loadProfile = async () => {
        try {
          const { data, error } = await supabase
            .from('users')
            .select('status, avatar_url, show_similar')
            .eq('user_id', store.userId)
            .single();
          if (error) throw error;
          if (data) {
            store.status = data.status || '';
            store.avatarUrl = data.avatar_url || '';
            setStatus(data.status || '');
            setAvatarUri(data.avatar_url || null);
            setShowSimilar(data.show_similar !== false);
          }
        } catch {
          // тихий fallback
        }

        const [
          { count: helpCount },
          { count: ansCount },
          { data: firstTest },
        ] = await Promise.all([
          supabase.from('user_helps').select('*', { count: 'exact', head: true }).eq('helper_id', store.userId),
          supabase.from('daily_answers').select('*', { count: 'exact', head: true }).eq('user_id', store.userId),
          supabase.from('test_results').select('created_at').eq('user_id', store.userId)
            .order('created_at', { ascending: true }).limit(1).maybeSingle(),
        ]);
        const daysHere = firstTest
          ? Math.max(1, Math.floor((Date.now() - new Date(firstTest.created_at)) / 86400000) + 1)
          : 1;
        setPresenceStats({ daysHere, helpedCount: helpCount || 0, answersGiven: ansCount || 0 });

        // 7-дневный тренд настроения
        const sevenAgo = new Date();
        sevenAgo.setDate(sevenAgo.getDate() - 6);
        const { data: moods } = await supabase
          .from('mood_checkins')
          .select('score, checkin_date')
          .eq('user_id', store.userId)
          .gte('checkin_date', sevenAgo.toISOString().split('T')[0])
          .order('checkin_date', { ascending: true });
        // Строим массив 7 дней
        const moodMap = {};
        (moods || []).forEach(m => { moodMap[m.checkin_date] = m.score; });
        const days = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const key = d.toISOString().split('T')[0];
          const dayLabel = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'][d.getDay()];
          days.push({ date: key, label: dayLabel, score: moodMap[key] ?? null });
        }
        setMoodHistory(days);

        const { data: fishData } = await supabase
          .from('caught_fish').select('fish_name').eq('user_id', store.userId);
        setFishCollection([...new Set((fishData || []).map(r => r.fish_name))]);

      };
      loadProfile();
      checkAndAwardAchievements();
    }, [])
  );

  const level = LEVEL_DATA[store.level] || LEVEL_DATA.green;

  const checkAndAwardAchievements = async () => {
    if (!store.userId) return;
    try {
      const uid = store.userId;
      const thirtyAgo = new Date();
      thirtyAgo.setDate(thirtyAgo.getDate() - 30);
      const thirtyAgoStr = thirtyAgo.toISOString().split('T')[0];

      const [
        { data: existing },
        { count: testCount },
        { data: recentTests },
        { count: friendCount },
        { count: dmCount },
        { count: postCount },
        { data: dailyAnswers },
        { count: helpCount },
        { data: myThoughts },
        { data: myThoughtReacts },
        { count: breathingCount },
        { data: caughtFish },
        { data: psychResults },
        { data: userRow },
        { data: checkinData },
      ] = await Promise.all([
        supabase.from('user_achievements').select('achievement_id').eq('user_id', uid),
        supabase.from('test_results').select('*', { count: 'exact', head: true }).eq('user_id', uid),
        supabase.from('test_results').select('level').eq('user_id', uid).order('created_at', { ascending: false }).limit(20),
        supabase.from('friendships').select('*', { count: 'exact', head: true }).or(`requester_id.eq.${uid},receiver_id.eq.${uid}`).eq('status', 'accepted'),
        supabase.from('direct_messages').select('*', { count: 'exact', head: true }).eq('sender_id', uid),
        supabase.from('feed_posts').select('*', { count: 'exact', head: true }).eq('author_id', uid),
        supabase.from('daily_answers').select('question_date').eq('user_id', uid).order('question_date', { ascending: false }).limit(35),
        supabase.from('user_helps').select('*', { count: 'exact', head: true }).eq('helper_id', uid),
        supabase.from('anonymous_thoughts').select('id').eq('user_id', uid),
        supabase.from('thought_reactions').select('id').eq('user_id', uid).limit(1),
        supabase.from('breathing_sessions').select('*', { count: 'exact', head: true }).eq('user_id', uid),
        supabase.from('caught_fish').select('fish_name').eq('user_id', uid),
        supabase.from('psych_test_results').select('test_id').eq('user_id', uid),
        supabase.from('users').select('login_streak, status, avatar_url').eq('user_id', uid).single(),
        supabase.from('mood_checkins').select('checkin_date').eq('user_id', uid).gte('checkin_date', thirtyAgoStr),
      ]);

      const earned = new Set((existing || []).map(e => e.achievement_id));
      const toAward = [];
      const levels = (recentTests || []).map(t => t.level);

      // Путь
      if ((testCount || 0) >= 1  && !earned.has('first_test'))   toAward.push('first_test');
      if ((testCount || 0) >= 5  && !earned.has('five_tests'))   toAward.push('five_tests');
      if ((testCount || 0) >= 10 && !earned.has('ten_tests'))    toAward.push('ten_tests');
      if ((testCount || 0) >= 20 && !earned.has('twenty_tests')) toAward.push('twenty_tests');
      if (!earned.has('comeback')) {
        for (let i = 0; i < levels.length - 1; i++) {
          if (levels[i] !== 'red' && levels[i + 1] === 'red') { toAward.push('comeback'); break; }
        }
      }
      if (!earned.has('stable') && levels.length >= 3 && levels.slice(0, 3).every(l => l === 'green')) {
        toAward.push('stable');
      }

      // Каждый день
      const dailyStreak = calcDateStreak(dailyAnswers, 'question_date');
      const checkinStreak = calcDateStreak(checkinData, 'checkin_date');
      if ((checkinData || []).length >= 1 && !earned.has('checkin_first')) toAward.push('checkin_first');
      if (checkinStreak >= 7  && !earned.has('checkin_7'))  toAward.push('checkin_7');
      if (dailyStreak   >= 7  && !earned.has('daily_7'))   toAward.push('daily_7');
      if (dailyStreak   >= 30 && !earned.has('daily_30'))  toAward.push('daily_30');
      const loginStreak = userRow?.login_streak || 0;
      if (loginStreak   >= 14 && !earned.has('streak_14')) toAward.push('streak_14');

      // Голос
      if (userRow?.status && userRow?.avatar_url && !earned.has('profile_done')) toAward.push('profile_done');
      if ((postCount || 0) >= 1 && !earned.has('first_post')) toAward.push('first_post');
      if ((myThoughts || []).length >= 1 && !earned.has('first_thought')) toAward.push('first_thought');
      if ((myThoughtReacts || []).length >= 1 && !earned.has('first_reaction')) toAward.push('first_reaction');
      if (!earned.has('thought_reactions_5') && (myThoughts || []).length > 0) {
        const ids = myThoughts.map(t => t.id);
        const { count: rxCount } = await supabase
          .from('thought_reactions').select('*', { count: 'exact', head: true }).in('thought_id', ids);
        if ((rxCount || 0) >= 5) toAward.push('thought_reactions_5');
      }

      // Связи
      if ((friendCount || 0) >= 1 && !earned.has('first_friend')) toAward.push('first_friend');
      if ((dmCount     || 0) >= 1 && !earned.has('first_dm'))     toAward.push('first_dm');
      if ((helpCount   || 0) >= 1 && !earned.has('helper_1'))     toAward.push('helper_1');
      if ((helpCount   || 0) >= 5 && !earned.has('helper_5'))     toAward.push('helper_5');
      if ((helpCount   || 0) >= 20&& !earned.has('helper_20'))    toAward.push('helper_20');

      // Глубина
      const uniquePsychTests = new Set((psychResults || []).map(r => r.test_id)).size;
      if (uniquePsychTests >= 1 && !earned.has('psych_first')) toAward.push('psych_first');
      if (uniquePsychTests >= 8 && !earned.has('psych_all'))   toAward.push('psych_all');
      if ((breathingCount || 0) >= 1  && !earned.has('breathing_first')) toAward.push('breathing_first');
      if ((breathingCount || 0) >= 10 && !earned.has('breathing_10'))    toAward.push('breathing_10');
      const hasFish = (caughtFish || []).length >= 1;
      const hasRareFish = (caughtFish || []).some(f => {
        const info = ALL_FISH.find(a => a.name === f.fish_name);
        return info?.rarity === 'rare' || info?.rarity === 'legendary';
      });
      if (hasFish     && !earned.has('fish_first')) toAward.push('fish_first');
      if (hasRareFish && !earned.has('fish_rare'))  toAward.push('fish_rare');

      if (toAward.length > 0) {
        await supabase.from('user_achievements').insert(
          toAward.map(id => ({ user_id: uid, achievement_id: id }))
        );
        toAward.forEach(id => earned.add(id));
      }

      setEarnedAchievementIds(new Set(earned));
    } catch {
      // тихий fallback
    }
  };


  const toggleShowSimilar = async (value) => {
    setShowSimilar(value);
    const { error } = await supabase.from('users').update({ show_similar: value }).eq('user_id', store.userId);
    if (error) setShowSimilar(!value);
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

    setUploadingAvatar(true);
    try {
      // base64 → Uint8Array
      const byteStr = atob(asset.base64);
      const bytes = new Uint8Array(byteStr.length);
      for (let i = 0; i < byteStr.length; i++) bytes[i] = byteStr.charCodeAt(i);

      const path = `${store.userId}/avatar.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, bytes, { contentType: 'image/jpeg', upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
      // Bust cache with timestamp
      const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      const { error: dbError } = await supabase
        .from('users')
        .update({ avatar_url: avatarUrl })
        .eq('user_id', store.userId);

      if (dbError) throw dbError;

      store.avatarUrl = avatarUrl;
      setAvatarUri(avatarUrl);
    } catch {
      Alert.alert('Ошибка', 'Не удалось сохранить аватар. Попробуй ещё раз.');
    }
    setUploadingAvatar(false);
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
            const { error } = await supabase.rpc('delete_user');
            if (error) {
              Alert.alert('Ошибка', error.message || 'Не удалось удалить аккаунт.');
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

        {/* Присутствие */}
        {presenceStats && (
          <View style={styles.presenceCard}>
            <View style={styles.presenceStat}>
              <Text style={styles.presenceNum}>{presenceStats.daysHere}</Text>
              <Text style={styles.presenceLabel}>{presenceStats.daysHere === 1 ? 'день' : presenceStats.daysHere < 5 ? 'дня' : 'дней'}{'\n'}здесь</Text>
            </View>
            <View style={styles.presenceDivider} />
            <View style={styles.presenceStat}>
              <Text style={styles.presenceNum}>{presenceStats.helpedCount}</Text>
              <Text style={styles.presenceLabel}>людей{'\n'}поддержал</Text>
            </View>
            <View style={styles.presenceDivider} />
            <View style={styles.presenceStat}>
              <Text style={styles.presenceNum}>{presenceStats.answersGiven}</Text>
              <Text style={styles.presenceLabel}>{presenceStats.answersGiven === 1 ? 'ответ' : presenceStats.answersGiven < 5 ? 'ответа' : 'ответов'}{'\n'}на вопрос дня</Text>
            </View>
          </View>
        )}


        {/* Аккаунт */}
        <Section title="Аккаунт">
          <Row icon="person-outline" label="Ник" value={store.username} valueColor={level.color} onPress={() => navigation.navigate('AccountSettings')} last={false} />
          <Row icon="mail-outline" label="Email" value={store.email} last={false} />
          <Row icon="stats-chart-outline" label="Моя аналитика" onPress={() => navigation.navigate('Analytics')} last={false} />
          <Row
            icon={LEVEL_ICONS[store.level] || 'ellipse-outline'}
            label="Уровень"
            value={level.label}
            valueColor={level.color}
            last={false}
          />
          <View style={[styles.row, styles.rowLast]}>
            <View style={[styles.rowIconWrap, { backgroundColor: colors.accent + '22' }]}>
              <Ionicons name="people-circle-outline" size={18} color={colors.accent} />
            </View>
            <Text style={styles.rowLabel}>Участвовать в «похожих людях»</Text>
            <TouchableOpacity
              onPress={() => Alert.alert(
                'Похожие люди',
                'Когда включено — алгоритм может предложить тебя другим пользователям как «похожего человека» на основе ответов на вопрос дня.\n\nЕсли хочешь, чтобы тебя не рекомендовали — выключи.'
              )}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="help-circle-outline" size={18} color={colors.muted} />
            </TouchableOpacity>
            <Switch
              value={showSimilar}
              onValueChange={toggleShowSimilar}
              trackColor={{ false: colors.border, true: colors.accent + '88' }}
              thumbColor={showSimilar ? colors.accent : colors.muted}
            />
          </View>
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
        <Section title="Достижения">
          <Row
            icon="trophy-outline"
            label="Достижения"
            value={`${earnedAchievementIds.size} из ${ACHIEVEMENTS.length}`}
            onPress={() => navigation.navigate('Achievements')}
            last={true}
          />
        </Section>

        {/* Коллекция рыб */}
        <Section title="Рыбалка">
          <View style={styles.fishProgress}>
            <Text style={styles.fishProgressText}>
              {fishCollection.length} из {ALL_FISH.length} поймано
            </Text>
            <View style={styles.fishProgressBar}>
              <View style={[styles.fishProgressFill, { width: `${(fishCollection.length / ALL_FISH.length) * 100}%` }]} />
            </View>
          </View>
          <View style={styles.fishGrid}>
            {ALL_FISH.map(fish => {
              const caught = fishCollection.includes(fish.name);
              return (
                <View key={fish.name} style={[styles.fishItem, !caught && styles.fishLocked]}>
                  {caught
                    ? <Ionicons name="fish-outline" size={22} color={FISH_RARITY_COLORS[fish.rarity]} />
                    : <Text style={styles.fishEmoji}>?</Text>
                  }
                  <Text style={[styles.fishName, !caught && { color: colors.muted }]} numberOfLines={2}>
                    {caught ? fish.name : '???'}
                  </Text>
                  <Text style={[styles.fishRarity, caught && { color: FISH_RARITY_COLORS[fish.rarity] }]}>
                    {caught ? fish.rarity : ''}
                  </Text>
                </View>
              );
            })}
          </View>
        </Section>

        {/* Если совсем плохо */}
        <TouchableOpacity
          style={styles.crisisBtn}
          onPress={() => Linking.openURL('tel:88002000122')}
          activeOpacity={0.8}
        >
          <Ionicons name="heart-outline" size={18} color={colors.accent} />
          <View style={styles.crisisInfo}>
            <Text style={styles.crisisBtnText}>Если совсем плохо</Text>
            <Text style={styles.crisisBtnSub}>Телефон доверия · 8-800-200-01-22 · бесплатно</Text>
          </View>
          <Ionicons name="call-outline" size={18} color={colors.muted} />
        </TouchableOpacity>

        {/* Действия */}
        <Section title="Действия">
          {store.isAdmin && (
            <Row icon="shield-checkmark-outline" label="Панель модератора" onPress={() => navigation.navigate('Admin')} last={false} />
          )}
          <Row icon="help-circle-outline" label="Как пользоваться приложением" onPress={() => navigation.navigate('OnboardingCarousel')} last={false} />
          <Row icon="mail-outline" label="Написать в поддержку" onPress={() => navigation.navigate('Support')} last={false} />
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

  // TopBar (кнопка Друзья)
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 4,
  },
  topBarBtn: {
    position: 'relative',
    padding: 6,
  },
  topBarBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#e74c3c',
    borderRadius: 7,
    minWidth: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  topBarBadgeText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: 'bold',
  },

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

  // Fish collection
  fishProgress: { paddingHorizontal: 16, paddingBottom: 12, gap: 6 },
  fishProgressText: { fontSize: 13, color: colors.muted },
  fishProgressBar: {
    height: 4, backgroundColor: colors.border, borderRadius: 2,
  },
  fishProgressFill: {
    height: 4, backgroundColor: colors.accent, borderRadius: 2,
  },
  fishGrid: {
    flexDirection: 'row', flexWrap: 'wrap', padding: 8, gap: 8,
  },
  fishItem: {
    width: '29%', flexGrow: 1,
    backgroundColor: colors.background,
    borderRadius: 12, padding: 10, alignItems: 'center', gap: 3,
  },
  fishLocked: { opacity: 0.3 },
  fishEmoji: { fontSize: 22 },
  fishName: { color: colors.white, fontSize: 10, fontWeight: '600', textAlign: 'center' },
  fishRarity: { color: colors.muted, fontSize: 9, textAlign: 'center' },

  // Delete
  crisisBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 16, marginBottom: 12,
    backgroundColor: colors.accent + '10',
    borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: colors.accent + '30',
  },
  crisisInfo: { flex: 1 },
  crisisBtnText: { fontSize: 15, fontWeight: '600', color: colors.accent, marginBottom: 2 },
  crisisBtnSub: { fontSize: 12, color: colors.muted },

  deleteBtn: { alignItems: 'center', paddingVertical: 16 },
  deleteBtnText: { color: colors.muted, fontSize: 13 },

  // Presence
  presenceCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.card, borderRadius: 16,
    marginHorizontal: 16, marginBottom: 8, padding: 16,
  },
  presenceStat: { flex: 1, alignItems: 'center', gap: 4 },
  presenceNum: { fontSize: 26, fontWeight: '700', color: colors.white },
  presenceLabel: { fontSize: 11, color: colors.muted, textAlign: 'center', lineHeight: 15 },
  presenceDivider: { width: 1, height: 36, backgroundColor: colors.border },

});
