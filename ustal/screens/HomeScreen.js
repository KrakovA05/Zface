import { StyleSheet, Text, View, TouchableOpacity, ScrollView, ActivityIndicator, Alert, TextInput } from 'react-native';
import { useState, useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { supabase } from '../supabase';
import { store } from '../store';
import { LEVEL_COLORS, DAILY_QUESTIONS, DAILY_WORDS, DAILY_WORDS_CONTEXT } from '../constants';
import { colors } from '../theme';
import { scheduleLowMoodPush } from '../utils/notifications';
import { logEvent } from '../utils/analytics';

const LEVEL_NAMES  = { green: 'Зелёный', yellow: 'Жёлтый', red: 'Красный' };
const LEVEL_ICONS  = { green: 'leaf-outline', yellow: 'partly-sunny-outline', red: 'thunderstorm-outline' };
const LEVEL_TEXTS  = {
  green:  'Ты держишься. Это честный результат.',
  yellow: 'Сейчас непросто. Бывают лучше дни, бывают хуже — и это нормально.',
  red:    'Сейчас тяжело. Ты это замечаешь — и это важно. Ты не один.',
};

const MODULE_ITEMS = [
  { icon: 'newspaper-outline',  label: 'Лента',   route: 'Feed'    },
  { icon: 'chatbubble-outline', label: 'Чат',     route: 'Chat'    },
  { icon: 'people-outline',     label: 'Комнаты', route: 'Rooms'   },
  { icon: 'sync-outline',        label: 'Дыхание', route: 'Breathing' },
  { icon: 'fish-outline',       label: 'Рыбалка', route: 'Fishing' },
  { icon: 'pencil-outline',     label: 'Мысли',   route: 'Thoughts' },
  { icon: 'library-outline',    label: 'Материалы', route: 'Resources' },
  { icon: 'mail-outline',       label: 'Письмо',   route: 'Letter' },
];

let testReminderShown = false;
const wordTapCache = {}; // { 'YYYY-MM-DD': 'yes'|'no' }

function getDynamic(history) {
  if (history.length < 2) return null;
  const order = { green: 0, yellow: 1, red: 2 };
  const curr = order[history[0]?.level];
  const prev = order[history[1]?.level];
  if (curr < prev) return { label: 'Становится лучше',  color: '#4CAF50', icon: 'trending-up-outline'   };
  if (curr > prev) return { label: 'Становится хуже',   color: '#F44336', icon: 'trending-down-outline' };
  return               { label: 'Стабильно',            color: '#AA7C00', icon: 'remove-outline'        };
}

function getTodayQuestion() {
  const now   = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const day   = Math.floor((now - start) / 86400000);
  return DAILY_QUESTIONS[day % DAILY_QUESTIONS.length];
}

function getTodayDate() {
  const d = new Date();
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
}

function getTodayWord() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const day = Math.floor((now - start) / 86400000);
  return DAILY_WORDS[day % DAILY_WORDS.length];
}

function getTodayWordContext() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const day = Math.floor((now - start) / 86400000);
  return DAILY_WORDS_CONTEXT[day % DAILY_WORDS_CONTEXT.length];
}

function calcStreak(answers) {
  if (!answers || answers.length === 0) return 0;
  const dates = [...new Set(answers.map(a => a.question_date))].sort().reverse();
  let streak = 0;
  const cur = new Date();
  cur.setHours(0, 0, 0, 0);
  for (const d of dates) {
    const expected = [cur.getFullYear(), String(cur.getMonth()+1).padStart(2,'0'), String(cur.getDate()).padStart(2,'0')].join('-');
    if (d === expected) {
      streak++;
      cur.setDate(cur.getDate() - 1);
    } else break;
  }
  return streak;
}

function pluralPeople(n) {
  if (n < 0) return 'человек';
  const mod10 = n % 10, mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'человек';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'человека';
  return 'человек';
}

export default function HomeScreen({ navigation }) {
  const [level,        setLevel]        = useState(store.level || 'green');
  const [history,      setHistory]      = useState([]);
  const [allHistory,   setAllHistory]   = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [showAllChart, setShowAllChart] = useState(false);

  const [dailyAnswer,    setDailyAnswer]    = useState('');
  const [dailyAnswered,  setDailyAnswered]  = useState(null);
  const [dailySubmitting,setDailySubmitting]= useState(false);
  const [otherAnswers,   setOtherAnswers]   = useState([]);
  const [wordTapped,     setWordTapped]     = useState(false);
  const [wordCount,      setWordCount]      = useState(0);
  const [communityCount, setCommunityCount] = useState(0);
  const [moodScore,      setMoodScore]      = useState(null);
  const [moodCount,      setMoodCount]      = useState(0);
  const [moodSuggested,  setMoodSuggested]  = useState(null);
  const [similarUser,    setSimilarUser]    = useState(null);
  const [streak,         setStreak]         = useState(0);
  const [onlineCount,    setOnlineCount]    = useState(0);
  const [showHistory,    setShowHistory]    = useState(false);
  const [hasUnreadLetter, setHasUnreadLetter] = useState(false);
  const scrollRef    = useRef(null);
  const [moodCardY,  setMoodCardY]  = useState(0);
  const [dailyCardY, setDailyCardY] = useState(0);
  const dailyQuestion = getTodayQuestion();
  const todayWord = getTodayWord();
  const todayWordContext = getTodayWordContext();

  useFocusEffect(useCallback(() => {
    const load = async () => {
      setLoading(true);
      try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: recent } = await supabase
          .from('test_results').select('level, created_at')
          .eq('user_id', user.id).order('created_at', { ascending: false }).limit(5);

        let currentLevel = store.level || 'green';
        if (recent?.length) {
          currentLevel = recent[0].level;
          setLevel(currentLevel);
          store.level = currentLevel;
          setHistory(recent);

          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);
          const { count: cc } = await supabase
            .from('users')
            .select('*', { count: 'exact', head: true })
            .eq('level', currentLevel)
            .gte('last_seen', todayStart.toISOString())
            .neq('user_id', user.id);
          setCommunityCount(cc || 0);

          if (!testReminderShown) {
            const days = (Date.now() - new Date(recent[0].created_at).getTime()) / 86400000;
            if (days > 3) {
              testReminderShown = true;
              Alert.alert(
                'Как ты сейчас?',
                `Последний раз ты проверял состояние ${Math.floor(days)} дн. назад. Пройдём тест?`,
                [
                  { text: 'Позже', style: 'cancel' },
                  { text: 'Пройти тест', onPress: () => navigation.navigate('Test') },
                ]
              );
            }
          }
        }

        const { data: full } = await supabase
          .from('test_results').select('level, created_at')
          .eq('user_id', user.id).order('created_at', { ascending: false });
        setAllHistory(full || []);

        const today = getTodayDate();
        const { count: letterCount } = await supabase
          .from('anonymous_letters').select('*', { count: 'exact', head: true })
          .eq('recipient_id', user.id).eq('opened', false);
        setHasUnreadLetter((letterCount || 0) > 0);

        const { data: ans } = await supabase
          .from('daily_answers').select('answer')
          .eq('user_id', user.id).eq('question_date', today).maybeSingle();
        setDailyAnswered(ans ? ans.answer : false);
        if (ans) fetchOtherAnswers(user.id);

        await findSimilarUser(user.id, currentLevel);

        const { data: myMood } = await supabase
          .from('mood_checkins').select('score')
          .eq('user_id', user.id).eq('checkin_date', today).maybeSingle();
        if (myMood) {
          setMoodScore(myMood.score);
          setMoodSuggested(getMoodSuggestion(myMood.score));
          const { count: mc } = await supabase
            .from('mood_checkins').select('*', { count: 'exact', head: true })
            .eq('checkin_date', today).eq('score', myMood.score);
          setMoodCount(mc || 0);
        }

        const word = getTodayWord();
        const cacheKey = `${today}_${user.id}`;
        if (wordTapCache[cacheKey] !== undefined) {
          setWordTapped(wordTapCache[cacheKey]);
        } else {
          const { data: taps } = await supabase
            .from('daily_word_taps').select('reaction')
            .eq('user_id', user.id).eq('word_date', today).limit(1);
          const tapVal = taps?.[0]?.reaction || false;
          wordTapCache[cacheKey] = tapVal;
          setWordTapped(tapVal);
        }
        const { count } = await supabase
          .from('daily_word_taps').select('*', { count: 'exact', head: true })
          .eq('word_date', today).eq('word', word).eq('reaction', 'yes');
        setWordCount(count || 0);

        // Стрик: последовательные дни с ответом на вопрос дня
        const thirtyAgo = new Date();
        thirtyAgo.setDate(thirtyAgo.getDate() - 30);
        const { data: streakData } = await supabase
          .from('daily_answers').select('question_date')
          .eq('user_id', user.id)
          .gte('question_date', thirtyAgo.toISOString().split('T')[0]);
        setStreak(calcStreak(streakData));

        // Онлайн-счётчик: кто был активен последние 10 минут
        const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
        const { count: onlineC } = await supabase
          .from('users').select('*', { count: 'exact', head: true })
          .gte('last_seen', tenMinAgo).neq('user_id', user.id);
        setOnlineCount(onlineC || 0);
      }
      } catch {}
      setLoading(false);
    };
    load();
  }, []));

  const tapWord = async (reaction) => {
    if (wordTapped) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const today = getTodayDate();
    setWordTapped(reaction);
    if (reaction === 'yes') setWordCount(c => c + 1);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      wordTapCache[`${today}_${user.id}`] = reaction;
      await supabase.from('daily_word_taps').insert({
        user_id: user.id, word: todayWord, word_date: today, reaction,
      });
    }
  };

  const findSimilarUser = async (userId, level) => {
    // Показываем не чаще раз в 7 дней
    const { data: recent } = await supabase
      .from('similar_user_shown')
      .select('shown_at')
      .eq('user_id', userId)
      .order('shown_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (recent) {
      const daysSince = (Date.now() - new Date(recent.shown_at).getTime()) / 86400000;
      if (daysSince < 7) return;
    }

    // Берём свои последние ответы
    const { data: myAnswers } = await supabase
      .from('daily_answers')
      .select('answer')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(14);
    if (!myAnswers || myAnswers.length < 3) return;

    const myWords = new Set(
      myAnswers.flatMap(a => a.answer.toLowerCase().split(/\s+/).filter(w => w.length > 3))
    );
    if (myWords.size < 5) return;

    // Берём ответы других с тем же уровнем
    const { data: others } = await supabase
      .from('daily_answers')
      .select('user_id, answer')
      .neq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(200);
    if (!others || others.length === 0) return;

    // Фильтруем по уровню
    const { data: sameLevelUsers } = await supabase
      .from('users')
      .select('user_id, username, avatar_url')
      .eq('level', level)
      .neq('user_id', userId);
    if (!sameLevelUsers || sameLevelUsers.length === 0) return;
    const sameLevelSet = new Set(sameLevelUsers.map(u => u.user_id));

    // Исключаем уже показанных
    const { data: shownBefore } = await supabase
      .from('similar_user_shown')
      .select('matched_user_id')
      .eq('user_id', userId);
    const shownSet = new Set((shownBefore || []).map(s => s.matched_user_id));

    // Считаем совпадения слов по пользователям
    const scoreMap = {};
    others.forEach(({ user_id, answer }) => {
      if (!sameLevelSet.has(user_id) || shownSet.has(user_id)) return;
      const words = answer.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      const matches = words.filter(w => myWords.has(w)).length;
      if (matches > 0) scoreMap[user_id] = (scoreMap[user_id] || 0) + matches;
    });

    const sorted = Object.entries(scoreMap).sort((a, b) => b[1] - a[1]);
    if (sorted.length === 0) return;

    const [bestId] = sorted[0];
    const bestUser = sameLevelUsers.find(u => u.user_id === bestId);
    if (!bestUser) return;

    // Записываем показ
    await supabase.from('similar_user_shown').upsert(
      { user_id: userId, matched_user_id: bestId },
      { onConflict: 'user_id,matched_user_id' }
    );

    setSimilarUser(bestUser);
  };

  const dismissSimilar = async () => {
    setSimilarUser(null);
    if (!similarUser) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('similar_user_shown')
        .update({ dismissed: true })
        .eq('user_id', user.id)
        .eq('matched_user_id', similarUser.user_id);
    }
  };

  const getMoodSuggestion = (score) => {
    if (score <= 3) return { icon: 'sync-outline',       label: 'Может, подышать?',          route: 'Breathing' };
    if (score <= 6) return { icon: 'people-outline',     label: 'Загляни к своим в комнату', route: 'Rooms'     };
    return                 { icon: 'newspaper-outline',  label: 'Поделись в ленте',          route: 'Feed'      };
  };

  const tapMood = async (score) => {
    if (moodScore !== null) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMoodScore(score);
    setMoodSuggested(getMoodSuggestion(score));

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    logEvent('checkin', { score, level: store.level });
    await supabase.from('mood_checkins').upsert(
      { user_id: user.id, checkin_date: getTodayDate(), score },
      { onConflict: 'user_id,checkin_date' }
    );
    const { count: mc } = await supabase
      .from('mood_checkins').select('*', { count: 'exact', head: true })
      .eq('checkin_date', getTodayDate()).eq('score', score);
    setMoodCount(mc || 0);

    // C) Если 3 дня подряд оценка ≤3 — поддерживающий пуш через 3 часа
    if (score <= 3) {
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 2);
      const { data: recentMoods } = await supabase
        .from('mood_checkins')
        .select('score, checkin_date')
        .eq('user_id', user.id)
        .gte('checkin_date', threeDaysAgo.toISOString().split('T')[0])
        .order('checkin_date', { ascending: false })
        .limit(3);
      if (recentMoods && recentMoods.length >= 3 && recentMoods.every(m => m.score <= 3)) {
        scheduleLowMoodPush();
      }
    }
  };

  const fetchOtherAnswers = async (userId) => {
    const { data } = await supabase
      .from('daily_answers').select('answer')
      .eq('question_date', getTodayDate())
      .neq('user_id', userId)
      .limit(20);
    setOtherAnswers((data || []).map(a => a.answer));
  };

  const submitDailyAnswer = async () => {
    if (!dailyAnswer.trim()) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setDailySubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { error } = await supabase.from('daily_answers').insert({
        user_id: user.id, question_date: getTodayDate(),
        question_text: dailyQuestion, answer: dailyAnswer.trim(),
      });
      if (!error) {
        setDailyAnswered(dailyAnswer.trim());
        setDailyAnswer('');
        fetchOtherAnswers(user.id);
      }
    }
    setDailySubmitting(false);
  };

  const getMoodColor = (score) => {
    if (score <= 3) return '#E57373';
    if (score <= 6) return '#FFB74D';
    return '#81C784';
  };

  const lvlColor   = LEVEL_COLORS[level];
  const dynamic    = getDynamic(history);
  const chartData  = showAllChart ? allHistory : history;

  return (
    <View style={styles.safeArea}>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        contentInset={{ bottom: 80 }}
        scrollIndicatorInsets={{ bottom: 80 }}
      >

        <View style={styles.greetingRow}>
          <Text style={styles.greeting}>Привет, {store.username || 'друг'}</Text>
          <View style={styles.greetingBadges}>
            {streak > 0 && (
              <View style={styles.streakBadge}>
                <Ionicons name="flame-outline" size={12} color={colors.accent} />
                <Text style={styles.streakText}>{streak}</Text>
              </View>
            )}
            {onlineCount > 0 && (
              <View style={styles.onlineBadge}>
                <View style={styles.onlineDot} />
                <Text style={styles.onlineText}>{onlineCount}</Text>
              </View>
            )}
          </View>
        </View>

        {!loading && (hasUnreadLetter || dailyAnswered === false || moodScore === null) && (
          (() => {
            let icon, text, sub, onPress;
            if (hasUnreadLetter) {
              icon = 'mail-outline';
              text = 'тебе пришло письмо';
              sub = 'кто-то написал тебе';
              onPress = () => navigation.navigate('Letter');
            } else if (dailyAnswered === false) {
              icon = 'chatbubble-ellipses-outline';
              text = 'вопрос дня ждёт';
              sub = dailyQuestion;
              onPress = () => scrollRef.current?.scrollTo({ y: dailyCardY, animated: true });
            } else {
              icon = 'heart-outline';
              text = 'как ты сейчас?';
              sub = 'оцени своё состояние';
              onPress = () => scrollRef.current?.scrollTo({ y: moodCardY, animated: true });
            }
            return (
              <TouchableOpacity
                style={[styles.focusCard, { borderLeftColor: lvlColor }]}
                onPress={onPress}
                activeOpacity={0.75}
              >
                <View style={[styles.focusIconWrap, { backgroundColor: lvlColor + '18' }]}>
                  <Ionicons name={icon} size={22} color={lvlColor} />
                </View>
                <View style={styles.focusInfo}>
                  <Text style={[styles.focusTitle, { color: lvlColor }]}>{text}</Text>
                  <Text style={styles.focusSub} numberOfLines={2}>{sub}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.muted} />
              </TouchableOpacity>
            );
          })()
        )}

        {/* ── Чекин настроения — сразу под фокусом ── */}
        {!loading && (
          <View style={styles.moodCard} onLayout={e => setMoodCardY(e.nativeEvent.layout.y)}>
            {moodScore === null ? (
              <>
                <Text style={styles.moodLabel}>как ты сейчас?</Text>
                <View style={styles.moodRow}>
                  {[1,2,3,4,5,6,7,8,9,10].map(n => (
                    <TouchableOpacity key={n} style={[styles.moodBtn, { borderColor: getMoodColor(n) }]} onPress={() => tapMood(n)} activeOpacity={0.7}>
                      <Text style={[styles.moodBtnText, { color: getMoodColor(n) }]}>{n}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.moodHints}>
                  <Text style={styles.moodHint}>совсем плохо</Text>
                  <Text style={styles.moodHint}>отлично</Text>
                </View>
              </>
            ) : (
              <>
                <Text style={[styles.moodDoneScore, { color: getMoodColor(moodScore) }]}>
                  ты на {moodScore} из 10
                </Text>
                {moodCount > 1 && (
                  <Text style={styles.moodDoneCount}>
                    ты и ещё {moodCount - 1} {pluralPeople(moodCount - 1)} сегодня чувствуют себя так же
                  </Text>
                )}
                {moodSuggested && (
                  <TouchableOpacity
                    style={styles.moodSuggestion}
                    onPress={() => navigation.navigate(moodSuggested.route)}
                    activeOpacity={0.75}
                  >
                    <Ionicons name={moodSuggested.icon} size={15} color={colors.accent} />
                    <Text style={styles.moodSuggestionText}>{moodSuggested.label}</Text>
                    <Ionicons name="arrow-forward" size={13} color={colors.accent} />
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        )}

        {/* ── Статус уровня — тихая справка ── */}
        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginVertical: 16 }} />
        ) : (
          <View style={[styles.statusCard, { borderLeftColor: lvlColor }]}>
            <View style={[styles.statusIconWrap, { backgroundColor: lvlColor + '18' }]}>
              <Ionicons name={LEVEL_ICONS[level]} size={16} color={lvlColor} />
            </View>
            <View style={styles.statusInfo}>
              <View style={styles.statusRow}>
                <Text style={[styles.statusLevel, { color: lvlColor }]}>{LEVEL_NAMES[level]}</Text>
                {dynamic && (
                  <View style={styles.dynamicRow}>
                    <Ionicons name={dynamic.icon} size={11} color={dynamic.color} />
                    <Text style={[styles.dynamicLabel, { color: dynamic.color }]}>{dynamic.label}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.statusDesc}>{LEVEL_TEXTS[level]}</Text>
              {!history.length && (
                <Text style={styles.noTestHint}>Пройди тест чтобы узнать своё состояние</Text>
              )}
            </View>
          </View>
        )}

        {!loading && communityCount > 0 && (
          <View style={styles.communityStrip}>
            <Ionicons name="people-outline" size={13} color={colors.muted} />
            <Text style={styles.communityText}>
              сегодня {communityCount} {pluralPeople(communityCount)} с твоим уровнем заходили
            </Text>
          </View>
        )}

        {!loading && similarUser && (
          <View style={[styles.similarCard, { borderLeftColor: lvlColor }]}>
            <TouchableOpacity style={styles.similarDismiss} onPress={dismissSimilar} hitSlop={{ top:8, right:8, bottom:8, left:8 }}>
              <Ionicons name="close" size={16} color={colors.muted} />
            </TouchableOpacity>
            <Text style={styles.similarLabel}>кажется, вы похожи</Text>
            <Text style={[styles.similarName, { color: lvlColor }]}>{similarUser.username}</Text>
            <Text style={styles.similarDesc}>отвечает на вопросы дня похоже на тебя</Text>
            <View style={styles.similarBtns}>
              <TouchableOpacity
                style={[styles.similarBtn, { backgroundColor: lvlColor }]}
                onPress={() => {
                  dismissSimilar();
                  navigation.navigate('UserProfile', {
                    user: { user_id: similarUser.user_id, username: similarUser.username, level, avatar_url: similarUser.avatar_url, status: '' }
                  });
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.similarBtnText}>Посмотреть профиль</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.similarBtnSkip} onPress={dismissSimilar} activeOpacity={0.7}>
                <Text style={styles.similarBtnSkipText}>Не сейчас</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={styles.ctaRow}>
          <TouchableOpacity
            style={[styles.ctaPrimary, { backgroundColor: lvlColor }]}
            onPress={() => navigation.navigate('Test')}
            activeOpacity={0.8}
          >
            <Ionicons name="clipboard-outline" size={17} color="#fff" />
            <Text style={styles.ctaPrimaryText} numberOfLines={1} adjustsFontSizeToFit>Как ты сейчас?</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.ctaSecondary}
            onPress={() => navigation.navigate('Recommendations', { level })}
            activeOpacity={0.8}
          >
            <Ionicons name="bulb-outline" size={16} color={colors.muted} />
            <Text style={styles.ctaSecondaryText}>Рекомендации</Text>
          </TouchableOpacity>
        </View>

        {!loading && wordTapped !== 'no' && (
          <View style={styles.wordCard}>
            <Text style={styles.wordLabel}>Слово дня</Text>
            <Text style={[styles.wordText, { color: lvlColor }]}>{todayWord}</Text>
            {wordTapped === 'yes' ? (
              <>
                <Text style={styles.wordCount}>
                  ты и ещё {wordCount > 1 ? wordCount - 1 : 0} {pluralPeople(wordCount - 1)} чувствуют то же
                </Text>
                <Text style={styles.wordContext}>{todayWordContext}</Text>
              </>
            ) : (
              <View style={styles.wordBtns}>
                <TouchableOpacity style={[styles.wordBtn, { borderColor: lvlColor }]} onPress={() => tapWord('yes')}>
                  <Text style={[styles.wordBtnText, { color: lvlColor }]}>да, это про меня</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.wordBtnNo} onPress={() => tapWord('no')}>
                  <Text style={styles.wordBtnNoText}>мимо</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {!loading && (
          <View style={styles.dailyCard} onLayout={e => setDailyCardY(e.nativeEvent.layout.y)}>
            <Text style={styles.sectionLabel}>Вопрос дня</Text>
            <Text style={styles.dailyQuestion}>{dailyQuestion}</Text>
            {dailyAnswered === false ? (
              <View style={styles.dailyInputRow}>
                <TextInput
                  style={styles.dailyInput}
                  placeholder="Ответь честно..."
                  placeholderTextColor={colors.muted}
                  value={dailyAnswer}
                  onChangeText={setDailyAnswer}
                  maxLength={300}
                  multiline
                />
                <TouchableOpacity
                  style={[styles.dailySendBtn, !dailyAnswer.trim() && { opacity: 0.4 }]}
                  onPress={submitDailyAnswer}
                  disabled={!dailyAnswer.trim() || dailySubmitting}
                >
                  {dailySubmitting
                    ? <ActivityIndicator color={colors.onAccent} size="small" />
                    : <Ionicons name="arrow-forward" size={18} color={colors.onAccent} />
                  }
                </TouchableOpacity>
              </View>
            ) : dailyAnswered ? (
              <View>
                <Text style={styles.dailyAnswerText}>«{dailyAnswered}»</Text>
                <View style={styles.dailyOthersBlock}>
                  <Text style={styles.dailyOthersLabel}>
                    {otherAnswers.length > 0 ? 'Другие сегодня' : 'Ты пока единственный кто ответил'}
                  </Text>
                  {otherAnswers.map((a, i) => (
                    <Text key={i} style={styles.dailyOtherAnswer}>«{a}»</Text>
                  ))}
                </View>
              </View>
            ) : null}
          </View>
        )}

        {!loading && moodScore !== null && wordTapped && dailyAnswered && (
          <View style={styles.allDoneCard}>
            <Ionicons name="checkmark-circle-outline" size={22} color={colors.accent} />
            <View style={{ flex: 1 }}>
              <Text style={styles.allDoneTitle}>на сегодня всё</Text>
              <Text style={styles.allDoneSub}>ответил на вопрос дня и отметил настроение</Text>
            </View>
          </View>
        )}

        <Text style={styles.sectionTitle}>Модули</Text>
        <View style={styles.grid}>
          {MODULE_ITEMS.map(m => (
            <TouchableOpacity
              key={m.route}
              style={styles.moduleButton}
              onPress={() => navigation.navigate(m.route)}
              activeOpacity={0.7}
            >
              <Ionicons name={m.icon} size={22} color={colors.accent} />
              <Text style={styles.moduleLabel}>{m.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {chartData.length >= 1 && (
          <View style={styles.section}>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>Динамика</Text>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                {!showHistory && history.length > 0 && (
                  <TouchableOpacity onPress={() => setShowHistory(true)}>
                    <Text style={styles.chartToggle}>Список</Text>
                  </TouchableOpacity>
                )}
                {allHistory.length > 5 && (
                  <TouchableOpacity onPress={() => setShowAllChart(v => !v)}>
                    <Text style={styles.chartToggle}>
                      {showAllChart ? 'Последние 5' : `Все (${allHistory.length})`}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
            <TestChart history={chartData} />
          </View>
        )}

        {history.length > 0 && showHistory && (
          <View style={styles.section}>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>История тестов</Text>
              <TouchableOpacity onPress={() => setShowHistory(false)}>
                <Text style={styles.chartToggle}>Скрыть</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.historyBlock}>
              {history.map((r, i) => (
                <View key={i} style={[styles.historyRow, i < history.length - 1 && styles.historyRowBorder]}>
                  <View style={[styles.historyDot, { backgroundColor: LEVEL_COLORS[r.level] }]} />
                  <Text style={[styles.historyLevel, { color: LEVEL_COLORS[r.level] }]}>
                    {LEVEL_NAMES[r.level]}
                  </Text>
                  <Text style={styles.historyDate}>
                    {new Date(r.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

      </ScrollView>
    </View>
  );
}

const CHART_H = 90;
const PAD_X   = 16;
const PAD_Y   = 14;
const LEVEL_TO_VAL = { green: 1, yellow: 0.5, red: 0 };

function TestChart({ history }) {
  const [chartWidth, setChartWidth] = useState(0);
  const data   = [...history].reverse();
  const innerW = chartWidth - PAD_X * 2;
  const innerH = CHART_H - PAD_Y * 2;

  const points = chartWidth > 0 ? data.map((item, i) => ({
    x:     PAD_X + (data.length > 1 ? (i / (data.length - 1)) * innerW : innerW / 2),
    y:     PAD_Y + (1 - LEVEL_TO_VAL[item.level]) * innerH,
    level: item.level,
    date:  new Date(item.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }),
  })) : [];

  return (
    <View style={styles.chartCard}>
      <View
        style={{ height: CHART_H, position: 'relative' }}
        onLayout={e => setChartWidth(e.nativeEvent.layout.width)}
      >
        {[0, 0.5, 1].map((val, i) => (
          <View key={i} style={{
            position: 'absolute', left: 0, right: 0,
            top: PAD_Y + (1 - val) * innerH, height: 1,
            backgroundColor: val === 1 ? '#4CAF5033' : val === 0.5 ? '#AA7C0033' : '#F4433633',
          }} />
        ))}

        {points.slice(0, -1).map((p, i) => {
          const next  = points[i + 1];
          const dx    = next.x - p.x;
          const dy    = next.y - p.y;
          const len   = Math.sqrt(dx * dx + dy * dy);
          const angle = Math.atan2(dy, dx) * (180 / Math.PI);
          return (
            <View key={i} style={{
              position: 'absolute',
              width: len, height: 2,
              backgroundColor: LEVEL_COLORS[p.level],
              left: (p.x + next.x) / 2 - len / 2,
              top:  (p.y + next.y) / 2 - 1,
              transform: [{ rotate: `${angle}deg` }],
              opacity: 0.8,
            }} />
          );
        })}

        {points.map((p, i) => (
          <View key={i} style={{
            position: 'absolute',
            width: 10, height: 10, borderRadius: 5,
            backgroundColor: LEVEL_COLORS[p.level],
            left: p.x - 5, top: p.y - 5,
            borderWidth: 2, borderColor: colors.card,
          }} />
        ))}

        {points.length > 0 && [points[0], points[points.length - 1]].map((p, i) => (
          <Text key={i} style={{
            position: 'absolute', fontSize: 9, color: colors.muted,
            left: p.x - 18, top: CHART_H - 12, width: 36, textAlign: 'center',
          }}>
            {p.date}
          </Text>
        ))}

        {chartWidth > 0 && [
          { val: 1, color: '#4CAF50' },
          { val: 0.5, color: '#AA7C00' },
          { val: 0, color: '#F44336' },
        ].map((item, i) => (
          <View key={i} style={{
            position: 'absolute', right: 2,
            top: PAD_Y + (1 - item.val) * innerH - 4,
            width: 8, height: 8, borderRadius: 4,
            backgroundColor: item.color, opacity: 0.7,
          }} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea:  { flex: 1, backgroundColor: colors.background },
  scroll:    { flex: 1 },
  content:   { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 20 },

  focusCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: colors.card, borderRadius: 16,
    marginBottom: 16, padding: 18,
    borderWidth: 1, borderColor: colors.border,
    borderLeftWidth: 3,
  },
  focusIconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  focusInfo: { flex: 1 },
  focusTitle: { fontSize: 16, fontWeight: '700', marginBottom: 3 },
  focusSub: { fontSize: 13, color: colors.muted, lineHeight: 18 },

  greetingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  greeting:  { fontSize: 22, fontWeight: '700', color: colors.white },
  greetingBadges: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  streakBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: colors.accent + '15', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  streakText: { fontSize: 12, fontWeight: '700', color: colors.accent },
  onlineBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#4CAF5015', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#4CAF50' },
  onlineText: { fontSize: 12, fontWeight: '600', color: '#4CAF50' },

  // Status card — compact, secondary info
  statusCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.card, borderRadius: 12,
    paddingVertical: 10, paddingHorizontal: 12,
    borderLeftWidth: 3, marginBottom: 12,
  },
  statusIconWrap: {
    width: 30, height: 30, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  statusInfo:   { flex: 1 },
  statusRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  statusLevel:  { fontSize: 13, fontWeight: '700' },
  statusDesc:   { fontSize: 11, color: colors.muted, lineHeight: 15 },
  dynamicRow:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dynamicLabel: { fontSize: 11, fontWeight: '600' },
  noTestHint:   { fontSize: 11, color: colors.muted, fontStyle: 'italic' },

  communityStrip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginBottom: 14, paddingHorizontal: 4,
  },
  communityText: { fontSize: 13, color: colors.muted },

  // Similar user
  similarCard: {
    backgroundColor: colors.card, borderRadius: 16,
    padding: 16, marginBottom: 16, borderLeftWidth: 3, position: 'relative',
  },
  similarDismiss: { position: 'absolute', top: 12, right: 12 },
  similarLabel: {
    fontSize: 11, fontWeight: '700', color: colors.muted,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6,
  },
  similarName: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  similarDesc: { fontSize: 13, color: colors.muted, marginBottom: 14 },
  similarBtns: { flexDirection: 'row', gap: 8 },
  similarBtn: { flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  similarBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  similarBtnSkip: {
    flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  similarBtnSkipText: { color: colors.muted, fontSize: 14 },

  // Mood checkin
  moodCard: {
    backgroundColor: colors.card, borderRadius: 16,
    padding: 16, marginBottom: 16,
  },
  moodLabel: {
    fontSize: 11, fontWeight: '700', color: colors.muted,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12,
  },
  moodRow: { flexDirection: 'row', justifyContent: 'space-between' },
  moodBtn: {
    width: 28, height: 28, borderRadius: 8, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  moodBtnText: { fontSize: 11, fontWeight: '700' },
  moodHints: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  moodHint: { fontSize: 10, color: colors.muted },
  moodDoneScore: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  moodDoneCount: { fontSize: 13, color: colors.muted, fontStyle: 'italic', marginBottom: 12 },
  moodSuggestion: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4,
    backgroundColor: colors.accent + '12', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 9,
    alignSelf: 'flex-start',
  },
  moodSuggestionText: { fontSize: 13, fontWeight: '600', color: colors.accent },

  // CTA row
  ctaRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  ctaPrimary: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: 14, paddingVertical: 14,
  },
  ctaPrimaryText:   { color: '#fff', fontWeight: '700', fontSize: 14 },
  ctaSecondary: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: 14, paddingVertical: 14,
    borderWidth: 1, borderColor: colors.border,
  },
  ctaSecondaryText: { color: colors.muted, fontWeight: '600', fontSize: 14 },

  // Word of the day
  wordCard: {
    backgroundColor: colors.card, borderRadius: 16,
    padding: 18, marginBottom: 16, alignItems: 'flex-start',
  },
  wordLabel: { fontSize: 11, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  wordText: { fontSize: 32, fontWeight: 'bold', marginBottom: 14 },
  wordBtns: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  wordBtn: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  wordBtnText: { fontSize: 14, fontWeight: '600' },
  wordBtnNo: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, borderColor: colors.border },
  wordBtnNoText: { fontSize: 14, color: colors.muted },
  wordCount: { fontSize: 13, color: colors.muted, fontStyle: 'italic', marginBottom: 6 },
  wordContext: { fontSize: 12, color: colors.accent, fontStyle: 'italic', opacity: 0.8 },

  // Daily question
  dailyCard: {
    backgroundColor: colors.card, borderRadius: 16,
    padding: 16, marginBottom: 28, borderLeftWidth: 3, borderLeftColor: colors.accent,
  },
  dailyQuestion:   { color: colors.white, fontSize: 15, fontWeight: '600', lineHeight: 22, marginBottom: 12 },
  dailyInputRow:   { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  dailyInput: {
    flex: 1, backgroundColor: colors.background, borderRadius: 10,
    padding: 10, color: colors.white, fontSize: 14, maxHeight: 80,
  },
  dailySendBtn: {
    backgroundColor: colors.accent, borderRadius: 10,
    width: 40, height: 40, alignItems: 'center', justifyContent: 'center',
  },
  dailyAnswerText: { color: colors.muted, fontSize: 14, fontStyle: 'italic', lineHeight: 20 },
  dailyOthersBlock: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.border, gap: 8 },
  dailyOthersLabel: { fontSize: 11, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 4 },
  dailyOtherAnswer: { fontSize: 14, color: colors.white, fontStyle: 'italic', lineHeight: 20, opacity: 0.7 },

  // Section headers
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: colors.muted,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10,
  },
  allDoneCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.accent + '10', borderRadius: 14,
    padding: 16, marginBottom: 20,
    borderWidth: 1, borderColor: colors.accent + '30',
  },
  allDoneTitle: { fontSize: 15, fontWeight: '700', color: colors.accent },
  allDoneSub: { fontSize: 13, color: colors.muted, marginTop: 2 },

  sectionTitle: {
    fontSize: 12, fontWeight: '700', color: colors.muted,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 14,
  },
  section:    { marginBottom: 28 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  chartToggle:{ color: colors.accent, fontSize: 12, fontWeight: '600' },

  // Modules grid
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 28 },
  moduleButton: {
    backgroundColor: colors.card, borderRadius: 12,
    padding: 12, alignItems: 'center', justifyContent: 'center',
    width: '30%', flexGrow: 1, gap: 6,
  },
  moduleLabel: { color: colors.muted, fontSize: 11, fontWeight: '500', textAlign: 'center' },

  // Chart
  chartCard: { backgroundColor: colors.card, borderRadius: 14, padding: 14 },

  // History
  historyBlock: { backgroundColor: colors.card, borderRadius: 14, overflow: 'hidden' },
  historyRow:   { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 16, gap: 12 },
  historyRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  historyDot:   { width: 8, height: 8, borderRadius: 4 },
  historyLevel: { fontSize: 14, fontWeight: '600', flex: 1 },
  historyDate:  { fontSize: 12, color: colors.muted },
});
