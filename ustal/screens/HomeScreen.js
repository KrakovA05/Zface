import { StyleSheet, Text, View, TouchableOpacity, ScrollView, ActivityIndicator, TextInput, Modal, Pressable } from 'react-native';
import { useState, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { supabase } from '../supabase';
import { store } from '../store';
import { LEVEL_COLORS, DAILY_QUESTIONS, DAILY_QUESTIONS_RED, DAILY_QUESTIONS_GREEN, DAILY_WORDS, DAILY_WORDS_CONTEXT } from '../constants';
import { colors } from '../theme';
import { scheduleLowMoodPush, scheduleFeatureDiscoveryPush } from '../utils/notifications';
import { logEvent } from '../utils/analytics';
import { getNextTestId } from '../utils/psychScheduler';
import { PSYCH_TESTS, WEEKLY_PHRASES } from '../utils/psychTests';
import { computeLiveProfile } from '../utils/computeLiveProfile';
import { showAlert } from '../utils/alert';

const LEVEL_NAMES  = { green: 'Зелёный', yellow: 'Жёлтый', red: 'Красный' };
const LEVEL_ICONS  = { green: 'leaf-outline', yellow: 'partly-sunny-outline', red: 'thunderstorm-outline' };
const LEVEL_TEXTS  = {
  green:  'Ты держишься. Это честный результат.',
  yellow: 'Сейчас непросто. Бывают лучше дни, бывают хуже — и это нормально.',
  red:    'Сейчас тяжело. Ты это замечаешь — и это важно. Ты не один.',
};

const ALL_MODULES = [
  { icon: 'newspaper-outline',  label: 'Лента',     route: 'Feed',      goals: ['social'] },
  { icon: 'chatbubble-outline', label: 'Чат',       route: 'Chat',      goals: ['social'] },
  { icon: 'people-outline',     label: 'Комнаты',   route: 'Rooms',     goals: ['social'] },
  { icon: 'sync-outline',       label: 'Дыхание',   route: 'Breathing', goals: ['anxiety', 'meditative'] },
  { icon: 'fish-outline',       label: 'Рыбалка',   route: 'Fishing',   goals: ['meditative'] },
  { icon: 'pencil-outline',     label: 'Мысли',     route: 'Thoughts',  goals: [] },
  { icon: 'library-outline',    label: 'Материалы', route: 'Resources', goals: ['anxiety'] },
  { icon: 'mail-outline',       label: 'Письмо',    route: 'Letter',    goals: ['social', 'meditative'] },
  { icon: 'trophy-outline',    label: 'Достижения', route: 'Achievements', goals: [] },
];

function getModuleItems(goal) {
  if (!goal) return ALL_MODULES;
  return [...ALL_MODULES].sort((a, b) => {
    const aMatch = a.goals.includes(goal) ? -1 : 0;
    const bMatch = b.goals.includes(goal) ? -1 : 0;
    return aMatch - bMatch;
  });
}

const DIMENSION_HINTS = {
  anxiety:        { text: 'тревога даёт о себе знать — 4 минуты дыхания могут помочь', route: 'Breathing' },
  stress:         { text: 'стресс накапливается. закинь удочку — медитативно и без давления', route: 'Fishing' },
  apathy:         { text: 'апатия — это сигнал. в комнатах можно просто сидеть молча', route: 'Rooms' },
  loneliness:     { text: 'одиночество — приходи в комнату. там не надо ничего говорить', route: 'Rooms' },
  burnout:        { text: 'выгорание требует паузы. рыбалка без цели и давления', route: 'Fishing' },
  self_esteem:    { text: 'нелегко с собой. посмотри что пишут другие — ты не один с этим', route: 'Feed' },
  social_anxiety: { text: 'тяжело общаться? в ленте можно просто читать, не писать', route: 'Feed' },
  attachment:     { text: 'тревога в отношениях знакома многим здесь. комнаты открыты', route: 'Rooms' },
};

const wordTapCache = {};
let wordTapCacheDate = '';

function getDynamic(history) {
  if (history.length < 2) return null;
  const order = { green: 0, yellow: 1, red: 2 };
  const curr = order[history[0]?.level];
  const prev = order[history[1]?.level];
  if (curr < prev) return { label: 'Становится лучше',  color: '#4CAF50', icon: 'trending-up-outline'   };
  if (curr > prev) return { label: 'Становится хуже',   color: '#F44336', icon: 'trending-down-outline' };
  return               { label: 'Стабильно',            color: '#AA7C00', icon: 'remove-outline'        };
}

function getAdaptiveQuestion(recentHistory) {
  const now = new Date();
  const start = new Date('2024-01-01');
  const dayIdx = Math.floor((now - start) / 86400000);

  if (!recentHistory || recentHistory.length < 3) {
    return DAILY_QUESTIONS[dayIdx % DAILY_QUESTIONS.length];
  }

  const levelOrder = { green: 2, yellow: 1, red: 0 };
  const scores = recentHistory.slice(0, 3).map(r => levelOrder[r.level] ?? 1);

  const isWorsening = scores[0] < scores[1] && scores[1] <= scores[2];
  const isImproving = scores[0] > scores[1] && scores[1] >= scores[2];

  if (isWorsening) return DAILY_QUESTIONS_RED[dayIdx % DAILY_QUESTIONS_RED.length];
  if (isImproving) return DAILY_QUESTIONS_GREEN[dayIdx % DAILY_QUESTIONS_GREEN.length];
  return DAILY_QUESTIONS[dayIdx % DAILY_QUESTIONS.length];
}

function getTodayDate() {
  const d = new Date();
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
}

function getLocalDayIndex() {
  const now = new Date();
  const local = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = new Date(2024, 0, 1);
  return Math.floor((local - start) / 86400000);
}

function getTodayWord() {
  return DAILY_WORDS[getLocalDayIndex() % DAILY_WORDS.length];
}

function getTodayWordContext() {
  return DAILY_WORDS_CONTEXT[getLocalDayIndex() % DAILY_WORDS_CONTEXT.length];
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

const FOCUS_OPTIONS = [
  { value: 'anxiety',    label: 'тревога и стресс' },
  { value: 'loneliness', label: 'одиночество' },
  { value: 'burnout',    label: 'усталость и выгорание' },
  { value: 'self_esteem',label: 'самооценка' },
];

function FocusAskCard({ onSelect, onDismiss }) {
  return (
    <View style={focusStyles.card}>
      <Text style={focusStyles.q}>что сейчас важнее всего?</Text>
      <View style={focusStyles.chips}>
        {FOCUS_OPTIONS.map(o => (
          <TouchableOpacity key={o.value} style={focusStyles.chip} onPress={() => onSelect(o.value)} activeOpacity={0.7}>
            <Text style={focusStyles.chipText}>{o.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity onPress={onDismiss} activeOpacity={0.6}>
        <Text style={focusStyles.skip}>пропустить</Text>
      </TouchableOpacity>
    </View>
  );
}

const focusStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.card, borderRadius: 16, padding: 18,
    marginBottom: 16, borderWidth: 1, borderColor: colors.border,
  },
  q: { fontSize: 15, fontWeight: '600', color: colors.white, marginBottom: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: {
    paddingVertical: 7, paddingHorizontal: 14,
    backgroundColor: colors.background, borderRadius: 20,
    borderWidth: 1, borderColor: colors.border,
  },
  chipText: { fontSize: 13, color: colors.white },
  skip: { fontSize: 12, color: colors.muted },
});

export default function HomeScreen({ navigation }) {
  const [level,        setLevel]        = useState(store.level || null);
  const [history,      setHistory]      = useState([]);
  const [loading,      setLoading]      = useState(true);

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
  const [moodNote,       setMoodNote]       = useState(null);
  const [similarUser,    setSimilarUser]    = useState(null);
  const [streak,         setStreak]         = useState(0);
  const [onlineCount,    setOnlineCount]    = useState(0);
  const [hasUnreadLetter, setHasUnreadLetter] = useState(false);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [showStreakInfo, setShowStreakInfo]   = useState(false);
  const scrollRef    = useRef(null);
  const [nextTestId,    setNextTestId]    = useState(null);
  const [lastDoneTestId, setLastDoneTestId] = useState(null);
  const [proactiveMsg, setProactiveMsg] = useState(null);
  const [modNotice,    setModNotice]    = useState(null);
  const testJustDoneRef = useRef(false);
  const [weeklyInsight, setWeeklyInsight] = useState(null);
  const [showFocusAsk,  setShowFocusAsk]  = useState(false);
  const [navHint,       setNavHint]       = useState(null);
  const [profileUpdated, setProfileUpdated] = useState(false);
  const dailyQuestion = getAdaptiveQuestion(history);
  const todayWord = getTodayWord();
  const todayWordContext = getTodayWordContext();

  const checkNavHint = async (recentHistory, userId) => {
    const todayStr = getTodayDate();
    const lastShown = await AsyncStorage.getItem('nav_hint_last_shown');
    if (lastShown === todayStr) return;

    if (recentHistory && recentHistory.length >= 3) {
      const levelOrder = { green: 2, yellow: 1, red: 0 };
      const scores = recentHistory.slice(0, 3).map(r => levelOrder[r.level] ?? 1);
      const isWorsening = scores[0] < scores[1] && scores[1] <= scores[2];
      if (isWorsening) {
        setNavHint({ text: 'несколько дней подряд нелегко. в ленте есть посты для таких моментов', route: 'Feed' });
        await AsyncStorage.setItem('nav_hint_last_shown', todayStr);
        return;
      }
    }

    const FEATURE_CHECKS = [
      { key: 'last_breathing_visit',  route: 'Breathing', gapDays: 4,  pushFeature: 'breathing',
        neverText: 'ещё не пробовал дыхание? 4 минуты — и немного полегче',
        gapText:   'давно не дышал с нами — может сейчас самое время?' },
      { key: 'last_fishing_visit',    route: 'Fishing',   gapDays: 7,  pushFeature: 'fishing',
        neverText: 'в приложении есть медитативная рыбалка — попробуй когда нужна пауза',
        gapText:   'давно не заходил на рыбалку — медитативно и без давления' },
      { key: 'last_thoughts_visit',   route: 'Thoughts',  gapDays: 10, pushFeature: 'thoughts',
        neverText: 'можно написать анонимную мысль дня — тебя поймут',
        gapText:   'давно не писал мыслей — там ждут люди которые поймут' },
      { key: 'last_resources_visit',  route: 'Resources', gapDays: 14, pushFeature: 'resources',
        neverText: 'есть материалы подобранные под твоё состояние — ещё не заходил',
        gapText:   'давно не заходил в материалы — там есть кое-что для тебя' },
      { key: 'last_feed_visit',       route: 'Feed',      gapDays: 7,  pushFeature: 'feed',
        neverText: 'в ленте посты от людей с таким же уровнем — загляни',
        gapText:   'давно не заходил в ленту — там пишут люди как ты' },
    ];

    const hasHistory = recentHistory && recentHistory.length >= 2;
    if (hasHistory) {
      for (const feat of FEATURE_CHECKS) {
        const lastVisit = await AsyncStorage.getItem(feat.key);
        if (!lastVisit) {
          setNavHint({ text: feat.neverText, route: feat.route });
          await AsyncStorage.setItem('nav_hint_last_shown', todayStr);
          scheduleFeatureDiscoveryPush(feat.pushFeature, 'never');
          return;
        }
        const daysSince = (Date.now() - new Date(lastVisit)) / 86400000;
        if (daysSince >= feat.gapDays) {
          setNavHint({ text: feat.gapText, route: feat.route });
          await AsyncStorage.setItem('nav_hint_last_shown', todayStr);
          scheduleFeatureDiscoveryPush(feat.pushFeature, 'gap');
          return;
        }
      }
    }

    if (userId) {
      const { data: metric } = await supabase
        .from('user_metrics')
        .select('dominant_dimension')
        .eq('user_id', userId)
        .order('week_start', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (metric?.dominant_dimension && DIMENSION_HINTS[metric.dominant_dimension]) {
        setNavHint(DIMENSION_HINTS[metric.dominant_dimension]);
        await AsyncStorage.setItem('nav_hint_last_shown', todayStr);
      }
    }
  };

  const markProactiveRead = async (id) => {
    setProactiveMsg(null);
    await supabase
      .from('ai_proactive_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id);
  };

  const dismissModNotice = async () => {
    if (!modNotice) return;
    setModNotice(null);
    await supabase
      .from('moderation_notices')
      .update({ read_at: new Date().toISOString() })
      .eq('id', modNotice.id);
  };

  useFocusEffect(useCallback(() => {
    const load = async () => {
      setLoading(true);
      AsyncStorage.getItem('profile_updated').then(v => {
        if (v === 'true') setProfileUpdated(true);
      });
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setLoading(false); return; }

        const today = getTodayDate();
        const word = getTodayWord();
        const thirtyAgoStr = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
        const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
        const cacheKey = `${today}_${user.id}`;

        if (wordTapCacheDate !== today) {
          Object.keys(wordTapCache).forEach(k => delete wordTapCache[k]);
          wordTapCacheDate = today;
        }

        // Фаза 1: все независимые запросы параллельно
        const [
          { data: recent },
          { count: letterCount },
          { count: notifCount },
          { data: ans },
          { data: myMood },
          wordTapRes,
          { count: wordCountVal },
          { data: streakData },
          { count: onlineC },
          { data: focusData },
          { data: metrics },
          { data: proactive },
          { data: notice },
          testIdResult,
          { data: userRow },
        ] = await Promise.all([
          supabase.from('test_results').select('level, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(5),
          supabase.from('anonymous_letters').select('*', { count: 'exact', head: true }).eq('recipient_id', user.id).eq('opened', false),
          supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('read', false),
          supabase.from('daily_answers').select('answer').eq('user_id', user.id).eq('question_date', today).maybeSingle(),
          supabase.from('mood_checkins').select('score, note').eq('user_id', user.id).eq('checkin_date', today).maybeSingle(),
          wordTapCache[cacheKey] !== undefined
            ? Promise.resolve(null)
            : supabase.from('daily_word_taps').select('reaction').eq('user_id', user.id).eq('word_date', today).eq('word', word).limit(1),
          supabase.from('daily_word_taps').select('*', { count: 'exact', head: true }).eq('word_date', today).eq('word', word).eq('reaction', 'yes'),
          supabase.from('daily_answers').select('question_date').eq('user_id', user.id).gte('question_date', thirtyAgoStr),
          supabase.from('users').select('*', { count: 'exact', head: true }).gte('last_seen', tenMinAgo).neq('user_id', user.id),
          supabase.from('users').select('focus_updated_at').eq('user_id', user.id).maybeSingle(),
          supabase.from('user_metrics').select('dominant_dimension, composite_score').eq('user_id', user.id).order('week_start', { ascending: false }).limit(1).maybeSingle(),
          supabase.from('ai_proactive_messages').select('id, text, created_at').eq('user_id', user.id).is('read_at', null).order('created_at', { ascending: false }).limit(1).maybeSingle(),
          supabase.from('moderation_notices').select('id, message_preview, created_at, type').eq('user_id', user.id).is('read_at', null).order('created_at', { ascending: false }).limit(1).maybeSingle(),
          testJustDoneRef.current ? Promise.resolve(null) : getNextTestId(user.id),
          supabase.from('users').select('level').eq('user_id', user.id).maybeSingle(),
        ]);

        // Уровень из users.level (composite) — null пока не накоплено достаточно данных
        const dbLevel = userRow?.level || null;
        setLevel(dbLevel);
        store.level = dbLevel;
        const currentLevel = dbLevel;
        if (recent?.length) {
          setHistory(recent);
          checkNavHint(recent, user.id);
        }

        // Простые состояния
        setHasUnreadLetter((letterCount || 0) > 0);
        setUnreadNotifCount(notifCount || 0);
        setDailyAnswered(ans ? ans.answer : false);
        if (ans) fetchOtherAnswers(user.id);

        if (wordTapRes === null) {
          setWordTapped(wordTapCache[cacheKey]);
        } else {
          const tapVal = wordTapRes?.data?.[0]?.reaction || false;
          wordTapCache[cacheKey] = tapVal;
          setWordTapped(tapVal);
        }
        setWordCount(wordCountVal || 0);
        setStreak(calcStreak(streakData));
        setOnlineCount(onlineC || 0);

        if (focusData) {
          const lastSet = focusData.focus_updated_at;
          const daysSince = lastSet ? Math.floor((Date.now() - new Date(lastSet).getTime()) / 86400000) : 999;
          if (daysSince >= 30) setShowFocusAsk(true);
        }

        if (metrics) setWeeklyInsight(WEEKLY_PHRASES[metrics.dominant_dimension] || WEEKLY_PHRASES.ok);
        setProactiveMsg(proactive || null);
        setModNotice(notice || null);

        // Тест
        if (testJustDoneRef.current) {
          testJustDoneRef.current = false;
          setNextTestId(null);
        } else {
          setNextTestId(testIdResult);
          if (!testIdResult) {
            const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
            const { data: todayResult } = await supabase
              .from('psych_test_results').select('test_id').eq('user_id', user.id)
              .gte('created_at', startOfToday.toISOString()).order('created_at', { ascending: false }).limit(1).maybeSingle();
            setLastDoneTestId(todayResult?.test_id || null);
          } else {
            setLastDoneTestId(null);
          }
        }

        // Фаза 2: уровень-зависимые запросы параллельно
        const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
        await Promise.all([
          dbLevel && recent?.length
            ? supabase.from('users').select('*', { count: 'exact', head: true })
                .eq('level', dbLevel).gte('last_seen', todayStart.toISOString()).neq('user_id', user.id)
                .then(({ count: cc }) => setCommunityCount(cc || 0))
            : Promise.resolve(),
          dbLevel ? findSimilarUser(user.id, dbLevel) : Promise.resolve(),
          myMood
            ? (setMoodScore(myMood.score),
               setMoodNote(myMood.note ?? ''),
               setMoodSuggested(getMoodSuggestion(myMood.score)),
               supabase.from('mood_checkins').select('*', { count: 'exact', head: true })
                 .eq('checkin_date', today).eq('score', myMood.score)
                 .then(({ count: mc }) => setMoodCount(mc || 0)))
            : Promise.resolve(),
          recent?.length
            ? AsyncStorage.getItem(`test_reminder_${today}`).then(async alreadyShown => {
                if (!alreadyShown) {
                  const days = (Date.now() - new Date(recent[0].created_at).getTime()) / 86400000;
                  if (days > 3) {
                    await AsyncStorage.setItem(`test_reminder_${today}`, '1');
                    showAlert('Как ты сейчас?', `Последний раз ты проверял состояние ${Math.floor(days)} дн. назад. Пройдём тест?`, [
                      { text: 'Позже', style: 'cancel' },
                      { text: 'Пройти тест', onPress: () => navigation.navigate('Test') },
                    ]);
                  }
                }
              })
            : Promise.resolve(),
        ]);
      } catch (e) {
        console.error('HomeScreen load error', e);
      }
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
      myAnswers.flatMap(a => (a.answer || '').toLowerCase().split(/\s+/).filter(w => w.length > 3))
    );
    if (myWords.size < 5) return;

    // Берём пользователей того же уровня, согласных на рекомендации
    const { data: sameLevelUsers } = await supabase
      .from('users')
      .select('user_id, username, avatar_url')
      .eq('level', level)
      .eq('show_similar', true)
      .neq('user_id', userId);
    if (!sameLevelUsers || sameLevelUsers.length === 0) return;
    const sameLevelSet = new Set(sameLevelUsers.map(u => u.user_id));
    const sameLevelIds = sameLevelUsers.map(u => u.user_id);

    // Берём ответы только от пользователей того же уровня
    const { data: others } = await supabase
      .from('daily_answers')
      .select('user_id, answer')
      .in('user_id', sameLevelIds)
      .order('created_at', { ascending: false })
      .limit(200);
    if (!others || others.length === 0) return;

    // Исключаем уже существующих друзей
    const { data: friendships } = await supabase
      .from('friendships')
      .select('requester_id, receiver_id')
      .or(`requester_id.eq.${userId},receiver_id.eq.${userId}`)
      .eq('status', 'accepted');
    const friendIds = new Set((friendships || []).map(f =>
      f.requester_id === userId ? f.receiver_id : f.requester_id
    ));

    // Исключаем уже показанных
    const { data: shownBefore } = await supabase
      .from('similar_user_shown')
      .select('matched_user_id')
      .eq('user_id', userId);
    const shownSet = new Set((shownBefore || []).map(s => s.matched_user_id));

    // Считаем совпадения слов по пользователям
    const scoreMap = {};
    others.forEach(({ user_id, answer }) => {
      if (!sameLevelSet.has(user_id) || shownSet.has(user_id) || friendIds.has(user_id)) return;
      const words = (answer || '').toLowerCase().split(/\s+/).filter(w => w.length > 3);
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
      { user_id: userId, matched_user_id: bestId, shown_at: new Date().toISOString() },
      { onConflict: 'user_id,matched_user_id' }
    );

    setSimilarUser(bestUser);
  };

  const dismissSimilar = useCallback(async () => {
    const captured = similarUser;
    setSimilarUser(null);
    if (!captured) return;
    const { data } = await supabase.auth.getUser();
    const user = data?.user;
    if (user) {
      await supabase.from('similar_user_shown')
        .update({ dismissed: true })
        .eq('user_id', user.id)
        .eq('matched_user_id', captured.user_id);
    }
  }, [similarUser]);

  const getMoodSuggestion = (score) => {
    if (score <= 3) return { icon: 'sync-outline',       label: 'Может, подышать?',          route: 'Breathing' };
    if (score <= 6) return { icon: 'people-outline',     label: 'Загляни к своим в комнату', route: 'Rooms'     };
    return                 { icon: 'newspaper-outline',  label: 'Поделись в ленте',          route: 'Feed'      };
  };

  const tapMood = async (score) => {
    if (moodScore !== null) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMoodScore(score);
    // moodNote stays null → показывается follow-up шаг

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    logEvent('checkin', { score, level: store.level });
    await supabase.from('mood_checkins').upsert(
      { user_id: user.id, checkin_date: getTodayDate(), score },
      { onConflict: 'user_id,checkin_date' }
    );

    // Пересчитываем composite — чекин влияет на stress и burnout
    computeLiveProfile(user.id, { updateLevel: true });

    // C) Если 3 дня подряд оценка ≤3 — поддерживающий пуш через 3 часа
    if (score <= 3) {
      const requiredDates = [0, 1, 2].map(d => {
        const dt = new Date();
        dt.setDate(dt.getDate() - d);
        return dt.toISOString().split('T')[0];
      });
      const { data: recentMoods } = await supabase
        .from('mood_checkins')
        .select('score, checkin_date')
        .eq('user_id', user.id)
        .in('checkin_date', requiredDates);
      const moodMap = Object.fromEntries((recentMoods || []).map(m => [m.checkin_date, m.score]));
      const allThreeBad = requiredDates.every(d => moodMap[d] !== undefined && moodMap[d] <= 3);
      if (allThreeBad) scheduleLowMoodPush();
    }
  };

  const submitMoodNote = async (note) => {
    const noteVal = note ?? '';
    setMoodNote(noteVal);
    setMoodSuggested(getMoodSuggestion(moodScore));
    const { data: { user } } = await supabase.auth.getUser();
    if (user && noteVal) {
      await supabase.from('mood_checkins')
        .update({ note: noteVal })
        .eq('user_id', user.id)
        .eq('checkin_date', getTodayDate());
    }
    const { count: mc } = await supabase
      .from('mood_checkins').select('*', { count: 'exact', head: true })
      .eq('checkin_date', getTodayDate()).eq('score', moodScore);
    setMoodCount(mc || 0);
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

  const buildDiaryLine = () => {
    const parts = [];
    if (moodScore !== null) {
      parts.push(`настроение ${moodScore}/10${moodNote ? ` · ${moodNote}` : ''}`);
    }
    if (dailyAnswered) parts.push('ответил на вопрос дня');
    if (wordTapped === 'yes') parts.push('слово дня — совпало');
    return parts.join(' · ');
  };

  const lvlColor    = LEVEL_COLORS[level] || '#A09080';
  const dynamic     = getDynamic(history);
  const moduleItems = getModuleItems(store.goal);

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
            <TouchableOpacity
              style={styles.bellBtn}
              onPress={() => navigation.navigate('Notifications')}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="notifications-outline" size={20} color={colors.white} />
              {unreadNotifCount > 0 && (
                <View style={styles.bellBadge}>
                  <Text style={styles.bellBadgeText}>
                    {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            {streak > 0 && (
              <TouchableOpacity
                style={styles.streakBadge}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowStreakInfo(true); }}
                activeOpacity={0.7}
              >
                <Ionicons name="flame-outline" size={12} color={colors.accent} />
                <Text style={styles.streakText}>{streak}</Text>
              </TouchableOpacity>
            )}
            {onlineCount > 0 && (
              <View style={styles.onlineBadge}>
                <View style={styles.onlineDot} />
                <Text style={styles.onlineText}>{onlineCount}</Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Проактивное сообщение от @одного ── */}
        {!loading && proactiveMsg && (
          <TouchableOpacity
            style={styles.proactiveCard}
            onPress={() => {
              markProactiveRead(proactiveMsg.id);
              navigation.navigate('AiChat', { initialMessage: proactiveMsg.text });
            }}
            activeOpacity={0.75}
          >
            <View style={styles.proactiveIconWrap}>
              <Ionicons name="sparkles-outline" size={18} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.proactiveLabel}>@один</Text>
              <Text style={styles.proactiveText} numberOfLines={2}>{proactiveMsg.text}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.muted} />
          </TouchableOpacity>
        )}

        {/* ── MainCard — единая карточка действий ── */}
        {!loading && (
          <View style={[styles.mainCard, { borderLeftColor: lvlColor }]}>
            {hasUnreadLetter ? (
              <TouchableOpacity
                style={styles.mainCardRow}
                onPress={() => navigation.navigate('Letter')}
                activeOpacity={0.75}
              >
                <View style={[styles.mainCardIconWrap, { backgroundColor: lvlColor + '18' }]}>
                  <Ionicons name="mail-outline" size={22} color={lvlColor} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.mainCardTitle, { color: lvlColor }]}>тебе пришло письмо</Text>
                  <Text style={styles.mainCardSub}>кто-то написал тебе</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.muted} />
              </TouchableOpacity>
            ) : moodScore === null ? (
              <>
                <Text style={styles.mainCardLabel}>как ты сейчас?</Text>
                <View style={styles.moodRow}>
                  {[1,2,3,4,5,6,7,8,9,10].map(n => (
                    <TouchableOpacity key={n} style={[styles.moodBtn, { borderColor: getMoodColor(n) }]} onPress={() => tapMood(n)} activeOpacity={0.7} hitSlop={{ top: 6, bottom: 6, left: 1, right: 1 }}>
                      <Text style={[styles.moodBtnText, { color: getMoodColor(n) }]}>{n}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.moodHints}>
                  <Text style={styles.moodHint}>совсем плохо</Text>
                  <Text style={styles.moodHint}>отлично</Text>
                </View>
              </>
            ) : moodNote === null ? (
              <>
                <Text style={[styles.moodDoneScore, { color: getMoodColor(moodScore), fontSize: 14, opacity: 0.7, marginBottom: 12 }]}>
                  ты на {moodScore} из 10
                </Text>
                <Text style={styles.moodFollowupLabel}>что сейчас тяжелее всего?</Text>
                <View style={styles.moodFollowupChips}>
                  {['работа', 'усталость', 'тревога', 'одиночество', 'тело', 'сон'].map(chip => (
                    <TouchableOpacity key={chip} style={styles.moodChip} onPress={() => submitMoodNote(chip)} activeOpacity={0.7}>
                      <Text style={styles.moodChipText}>{chip}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity onPress={() => submitMoodNote('')} activeOpacity={0.7}>
                  <Text style={styles.moodChipSkipText}>пропустить</Text>
                </TouchableOpacity>
              </>
            ) : dailyAnswered === false ? (
              <>
                <Text style={styles.mainCardLabel}>Вопрос дня</Text>
                <Text style={styles.dailyQuestion}>{dailyQuestion}</Text>
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
                <View style={styles.dailyGateHint}>
                  <Ionicons name="eye-outline" size={11} color={colors.muted} />
                  <Text style={styles.dailyGateText}>ответь — увидишь что написали другие</Text>
                </View>
              </>
            ) : (
              <>
                <View style={styles.mainCardAllDone}>
                  <Ionicons name="checkmark-circle-outline" size={20} color={colors.accent} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.allDoneTitle}>на сегодня всё</Text>
                    <Text style={styles.allDoneSub}>{buildDiaryLine()}</Text>
                  </View>
                </View>
                {moodCount > 1 && (
                  <Text style={[styles.moodDoneCount, { marginTop: 4 }]}>
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
                {wordTapped !== 'no' && (
                  <View style={styles.wordInCard}>
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
                {!!dailyAnswered && (
                  <View style={[styles.dailyOthersBlock, { marginTop: 16 }]}>
                    <Text style={styles.dailyOthersLabel}>
                      {otherAnswers.length > 0 ? 'Другие сегодня' : 'Ты пока единственный кто ответил'}
                    </Text>
                    {otherAnswers.map((a, i) => (
                      <Text key={i} style={styles.dailyOtherAnswer}>«{a}»</Text>
                    ))}
                  </View>
                )}
              </>
            )}
          </View>
        )}

        {/* ── Профиль обновился ── */}
        {!loading && profileUpdated && (
          <TouchableOpacity
            style={styles.profileUpdatedCard}
            onPress={async () => {
              await AsyncStorage.removeItem('profile_updated');
              setProfileUpdated(false);
              navigation.navigate('Analytics');
            }}
            activeOpacity={0.75}
          >
            <Text style={styles.profileUpdatedText}>твой профиль обновился</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.muted} />
          </TouchableOpacity>
        )}


        {/* ── Статус уровня — тихая справка ── */}
        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginVertical: 16 }} />
        ) : !level ? (
          <View style={[styles.statusCard, { borderLeftColor: '#A09080' }]}>
            <View style={[styles.statusIconWrap, { backgroundColor: 'rgba(160,144,128,0.12)' }]}>
              <Ionicons name="time-outline" size={16} color="#A09080" />
            </View>
            <View style={styles.statusInfo}>
              <Text style={[styles.statusLevel, { color: '#A09080' }]}>Уровень появится</Text>
              <Text style={styles.statusDesc}>Проходи тесты — через несколько измерений уровень определится точнее.</Text>
            </View>
          </View>
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
            </View>
          </View>
        )}

        {!loading && level && communityCount > 0 && (
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



        {!!navHint && (
          <TouchableOpacity
            style={hintStyles.card}
            onPress={() => { if (navHint.route) navigation.navigate(navHint.route); setNavHint(null); }}
            activeOpacity={navHint.route ? 0.75 : 1}
          >
            <View style={hintStyles.avatarWrap}>
              <Text style={hintStyles.avatarIcon}>✦</Text>
            </View>
            <Text style={[hintStyles.text, { flex: 1 }]}>{navHint.text}</Text>
            {navHint.route
              ? <Ionicons name="chevron-forward" size={14} color={colors.muted} />
              : <TouchableOpacity onPress={(e) => { e.stopPropagation?.(); setNavHint(null); }} activeOpacity={0.6} style={hintStyles.dismiss}>
                  <Ionicons name="close" size={14} color={colors.muted} />
                </TouchableOpacity>
            }
          </TouchableOpacity>
        )}



        {showFocusAsk && (
          <FocusAskCard
            onSelect={async (focus) => {
              setShowFocusAsk(false);
              const today = new Date().toISOString().split('T')[0];
              const { data: { user } } = await supabase.auth.getUser();
              if (user) {
                await supabase.from('users')
                  .update({ current_focus: focus, focus_updated_at: today })
                  .eq('user_id', user.id);
              }
            }}
            onDismiss={() => setShowFocusAsk(false)}
          />
        )}

        {weeklyInsight && (
          <View style={styles.weeklyInsightCard}>
            <Text style={styles.weeklyInsightText}>{weeklyInsight}</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('Resources')}
              style={styles.weeklyInsightBtn}
            >
              <Text style={styles.weeklyInsightBtnText}>Материалы для тебя</Text>
              <Ionicons name="arrow-forward" size={14} color={colors.accent} />
            </TouchableOpacity>
          </View>
        )}

        {nextTestId && PSYCH_TESTS[nextTestId] ? (
          <View style={styles.testPromptCard}>
            <TouchableOpacity
              style={styles.testPromptMain}
              onPress={() => navigation.navigate('PsychTest', {
                testId: nextTestId,
                onComplete: () => { testJustDoneRef.current = true; setLastDoneTestId(nextTestId); setNextTestId(null); },
              })}
              activeOpacity={0.8}
            >
              <Ionicons name="flask-outline" size={20} color={colors.accent} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.testPromptTitle}>{PSYCH_TESTS[nextTestId].title}</Text>
                <Text style={styles.testPromptSub}>{PSYCH_TESTS[nextTestId].subtitle} · займёт пару минут</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.muted} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.testPromptHelp}
              onPress={() => showAlert('зачем тесты?', 'короткие вопросы — честные ответы. для себя: чтобы замечать то, что обычно не замечаешь. для приложения: чтобы оно лучше понимало тебя и показывало то, что сейчас нужно')}
              hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
            >
              <Ionicons name="help-circle-outline" size={18} color={colors.muted} />
            </TouchableOpacity>
          </View>
        ) : lastDoneTestId && PSYCH_TESTS[lastDoneTestId] ? (
          <View style={[styles.testPromptCard, styles.testPromptCardDone]}>
            <View style={styles.testPromptMain}>
              <Ionicons name="checkmark-circle-outline" size={20} color="#5DAA72" />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.testPromptTitle}>{PSYCH_TESTS[lastDoneTestId].title}</Text>
                <Text style={[styles.testPromptSub, { color: '#5DAA72' }]}>Пройдено сегодня</Text>
                <Text style={styles.testPromptRefresh}>обновится завтра</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.testPromptHelp}
              onPress={() => showAlert('зачем тесты?', 'короткие вопросы — честные ответы. для себя: чтобы замечать то, что обычно не замечаешь. для приложения: чтобы оно лучше понимало тебя и показывало то, что сейчас нужно')}
              hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
            >
              <Ionicons name="help-circle-outline" size={18} color={colors.muted} />
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.toolsRow}>
          {[
            { icon: 'sync-outline',    label: 'Дыхание',   route: 'Breathing' },
            { icon: 'fish-outline',    label: 'Рыбалка',   route: 'Fishing' },
            { icon: 'pencil-outline',  label: 'Мысли',     route: 'Thoughts' },
            { icon: 'library-outline', label: 'Материалы', route: 'Resources' },
          ].map(t => (
            <TouchableOpacity key={t.route} style={styles.toolBtn} onPress={() => navigation.navigate(t.route)} activeOpacity={0.7}>
              <View style={styles.toolIconWrap}>
                <Ionicons name={t.icon} size={22} color={colors.accent} />
              </View>
              <Text style={styles.toolLabel}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>


      </ScrollView>

      {/* ── Стрик-попап ── */}
      <Modal visible={showStreakInfo} transparent animationType="fade" onRequestClose={() => setShowStreakInfo(false)}>
        <Pressable style={styles.streakOverlay} onPress={() => setShowStreakInfo(false)}>
          <Pressable style={styles.streakPopup} onPress={() => {}}>
            <Text style={styles.streakPopupFlame}>🔥</Text>
            <Text style={[styles.streakPopupCount, { color: colors.accent }]}>{streak}</Text>
            <Text style={styles.streakPopupLabel}>
              {streak === 1 ? 'день подряд' : streak < 5 ? 'дня подряд' : 'дней подряд'}
            </Text>
            <Text style={styles.streakPopupDesc}>
              Ты открываешь приложение каждый день. Это не мелочь — привычка заботиться о себе строится именно так.
            </Text>
            {streak >= 7 && (
              <View style={styles.streakMilestone}>
                <Text style={styles.streakMilestoneText}>
                  {streak >= 30 ? 'месяц без пропусков' : streak >= 14 ? 'две недели' : 'неделя'} — это уже характер
                </Text>
              </View>
            )}
            <TouchableOpacity style={styles.streakCloseBtn} onPress={() => setShowStreakInfo(false)} activeOpacity={0.7}>
              <Text style={styles.streakCloseBtnText}>Закрыть</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Модальное уведомление о модерации */}
      <Modal
        visible={!!modNotice}
        transparent
        animationType="fade"
        onRequestClose={dismissModNotice}
      >
        <View style={styles.modOverlay}>
          <View style={styles.modCard}>
            <View style={styles.modIconWrap}>
              <Ionicons name="shield-outline" size={28} color="#c0392b" />
            </View>
            <Text style={styles.modTitle}>
              {modNotice?.type === 'warning' ? 'Предупреждение от модератора' : 'Сообщение удалено'}
            </Text>
            <Text style={styles.modBody}>
              {modNotice?.type === 'warning'
                ? (modNotice?.message_preview || 'Пожалуйста, соблюдай правила сообщества.')
                : `Ваше сообщение было удалено за нарушение правил сообщества.${modNotice?.message_preview ? `\n\n«${modNotice.message_preview}»` : ''}`
              }
            </Text>
            <Text style={styles.modWarn}>
              Повторные нарушения могут привести к блокировке аккаунта.
            </Text>
            <TouchableOpacity style={styles.modBtn} onPress={dismissModNotice}>
              <Text style={styles.modBtnText}>Понятно</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    shadowColor: '#8B7B6B', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  proactiveCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
    borderLeftWidth: 3,
    borderLeftColor: '#8B7355',
  },
  proactiveIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#8B735515',
    alignItems: 'center',
    justifyContent: 'center',
  },
  proactiveLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8B7355',
    marginBottom: 2,
  },
  proactiveText: {
    fontSize: 14,
    color: colors.white,
    lineHeight: 19,
  },
  focusIconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  focusInfo: { flex: 1 },
  focusTitle: { fontSize: 16, fontWeight: '700', marginBottom: 3 },
  focusSub: { fontSize: 13, color: colors.muted, lineHeight: 18 },

  greetingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  greeting:  { fontSize: 22, fontWeight: '700', color: colors.white },
  greetingBadges: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  bellBtn: { position: 'relative', padding: 4 },
  bellBadge: {
    position: 'absolute', top: 0, right: 0,
    backgroundColor: '#E57373', borderRadius: 8,
    minWidth: 16, height: 16, paddingHorizontal: 3,
    alignItems: 'center', justifyContent: 'center',
  },
  bellBadgeText: { color: '#fff', fontSize: 9, fontWeight: 'bold' },
  streakBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: colors.accent + '15', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  streakText: { fontSize: 12, fontWeight: '700', color: colors.accent },

  // Streak popup
  streakOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  streakPopup: {
    backgroundColor: colors.card, borderRadius: 28,
    paddingVertical: 32, paddingHorizontal: 28,
    width: '80%', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18, shadowRadius: 24, elevation: 16,
  },
  streakPopupFlame: { fontSize: 56, marginBottom: 8 },
  streakPopupCount: { fontSize: 64, fontWeight: '900', lineHeight: 70 },
  streakPopupLabel: { fontSize: 18, fontWeight: '600', color: colors.white, marginBottom: 16 },
  streakPopupDesc: {
    fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 20, marginBottom: 20,
  },
  streakMilestone: {
    backgroundColor: colors.accent + '15', borderRadius: 12,
    paddingVertical: 8, paddingHorizontal: 16, marginBottom: 20,
  },
  streakMilestoneText: { fontSize: 13, color: colors.accent, fontWeight: '600' },
  streakCloseBtn: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    paddingVertical: 10, paddingHorizontal: 28,
  },
  streakCloseBtnText: { color: colors.muted, fontSize: 14, fontWeight: '500' },
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
    shadowColor: '#8B7B6B', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
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
    shadowColor: '#8B7B6B', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  moodLabel: {
    fontSize: 11, fontWeight: '700', color: colors.muted,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12,
  },
  moodRow: { flexDirection: 'row', justifyContent: 'space-between' },
  moodBtn: {
    width: 28, height: 36, borderRadius: 8, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  moodBtnText: { fontSize: 11, fontWeight: '700' },
  moodHints: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  moodHint: { fontSize: 11, color: colors.muted },
  moodDoneScore: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  moodDoneCount: { fontSize: 13, color: colors.muted, fontStyle: 'italic', marginBottom: 12 },
  moodSuggestion: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4,
    backgroundColor: colors.accent + '12', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 9,
    alignSelf: 'flex-start',
  },
  moodSuggestionText: { fontSize: 13, fontWeight: '600', color: colors.accent },

  moodFollowupLabel:  { fontSize: 13, color: colors.muted, marginBottom: 10 },
  moodFollowupChips:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  moodChip: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 9,
  },
  moodChipText:     { fontSize: 13, color: colors.white },
  moodChipSkipText: { fontSize: 12, color: colors.muted, paddingVertical: 4 },
  moodNoteTag:      { fontSize: 12, color: colors.muted, fontStyle: 'italic', marginBottom: 6 },

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
    shadowColor: '#8B7B6B', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
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
    shadowColor: '#8B7B6B', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
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

  dailyGateHint: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10 },
  dailyGateText: { fontSize: 12, color: colors.muted, fontStyle: 'italic' },

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

  // Modules grid
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 28 },
  moduleButton: {
    backgroundColor: colors.card, borderRadius: 14,
    paddingVertical: 16, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center',
    width: '30%', flexGrow: 1, gap: 8,
    shadowColor: '#8B7B6B', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07, shadowRadius: 4, elevation: 2,
  },
  moduleLabel: { color: colors.muted, fontSize: 12, fontWeight: '500', textAlign: 'center' },

  weeklyInsightCard: {
    backgroundColor: colors.card, borderRadius: 16,
    padding: 18, marginBottom: 16,
    borderLeftWidth: 3, borderLeftColor: colors.accent,
  },
  weeklyInsightText: { fontSize: 15, color: colors.white, lineHeight: 22, marginBottom: 12 },
  weeklyInsightBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  weeklyInsightBtnText: { fontSize: 13, color: colors.accent, fontWeight: '600' },

  testPromptCard: {
    backgroundColor: colors.card, borderRadius: 16, padding: 16,
    flexDirection: 'row', alignItems: 'center', marginBottom: 16,
    borderWidth: 1, borderColor: colors.border,
  },
  testPromptCardDone: {
    backgroundColor: 'rgba(93, 170, 114, 0.12)',
    borderColor: 'rgba(93, 170, 114, 0.35)',
  },
  testPromptMain: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  testPromptHelp: { paddingLeft: 10 },
  testPromptTitle: { fontSize: 15, fontWeight: '600', color: colors.white },
  testPromptSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  testPromptRefresh: { fontSize: 11, color: colors.muted, fontStyle: 'italic', marginTop: 4 },

  // Moderation notice modal
  modOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  modCard: {
    backgroundColor: '#FFF9F4',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    borderWidth: 1,
    borderColor: '#f5c6c6',
  },
  modIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fdecea',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  modTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#c0392b',
    marginBottom: 10,
    textAlign: 'center',
  },
  modBody: {
    fontSize: 14,
    color: '#2C2420',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 12,
  },
  modWarn: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
    lineHeight: 17,
    marginBottom: 20,
  },
  modBtn: {
    backgroundColor: '#c0392b',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  modBtnText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 15,
  },

  // MainCard
  mainCard: {
    backgroundColor: colors.card, borderRadius: 16,
    padding: 16, marginBottom: 16,
    shadowColor: '#8B7B6B', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
    borderLeftWidth: 3,
  },
  mainCardLabel: {
    fontSize: 11, fontWeight: '700', color: colors.muted,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12,
  },
  mainCardRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  mainCardIconWrap: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  mainCardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 3 },
  mainCardSub: { fontSize: 13, color: colors.muted, lineHeight: 18 },
  mainCardAllDone: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8,
  },
  wordInCard: {
    marginTop: 16, paddingTop: 16,
    borderTopWidth: 1, borderTopColor: colors.border,
  },

  // ToolsRow
  toolsRow: {
    flexDirection: 'row', justifyContent: 'space-between', marginBottom: 28,
  },
  toolBtn: { alignItems: 'center', flex: 1, gap: 6 },
  toolIconWrap: {
    width: 52, height: 52, borderRadius: 16,
    backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#8B7B6B', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07, shadowRadius: 4, elevation: 2,
  },
  toolLabel: { fontSize: 11, color: colors.muted, fontWeight: '500' },

  profileUpdatedCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.card, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 9,
    marginHorizontal: 16, marginBottom: 8,
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#E8DFD0',
  },
  profileUpdatedText: {
    fontSize: 12, color: colors.muted,
  },

});

const hintStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FDF6EE',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E8D4B0',
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 14,
    gap: 10,
  },
  avatarWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#c9a96e',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarIcon: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  text: { flex: 1, fontSize: 13, color: colors.white, lineHeight: 18 },
  dismiss: { padding: 4, flexShrink: 0 },
});
