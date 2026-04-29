import { StyleSheet, Text, View, TouchableOpacity, ScrollView, ActivityIndicator, Alert, TextInput } from 'react-native';
import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../supabase';
import { store } from '../store';
import { LEVEL_COLORS, DAILY_QUESTIONS, DAILY_WORDS } from '../constants';
import { colors } from '../theme';

const LEVEL_NAMES  = { green: 'Зелёный', yellow: 'Жёлтый', red: 'Красный' };
const LEVEL_ICONS  = { green: 'leaf-outline', yellow: 'partly-sunny-outline', red: 'thunderstorm-outline' };
const LEVEL_TEXTS  = {
  green:  'Ты держишься. Жизненный хаос тебя пока не накрыл.',
  yellow: 'Ты на грани. Бывают хорошие дни, бывают плохие.',
  red:    'Похоже, тебе действительно плохо. Но ты не один.',
};

const MODULE_ITEMS = [
  { icon: 'newspaper-outline',  label: 'Лента',   route: 'Feed'    },
  { icon: 'chatbubble-outline', label: 'Чат',     route: 'Chat'    },
  { icon: 'people-outline',     label: 'Комнаты', route: 'Rooms'   },
  { icon: 'sync-outline',        label: 'Дыхание', route: 'Breathing' },
  { icon: 'fish-outline',       label: 'Рыбалка', route: 'Fishing' },
  { icon: 'pencil-outline',     label: 'Мысли',   route: 'Thoughts' },
  { icon: 'library-outline',    label: 'Материалы', route: 'Resources' },
];

let testReminderShown = false;

function getDynamic(history) {
  if (history.length < 2) return null;
  const order = { green: 0, yellow: 1, red: 2 };
  const curr = order[history[0]?.level];
  const prev = order[history[1]?.level];
  if (curr < prev) return { label: 'Становится лучше',  color: '#4CAF50', icon: 'trending-up-outline'   };
  if (curr > prev) return { label: 'Становится хуже',   color: '#F44336', icon: 'trending-down-outline' };
  return               { label: 'Стабильно',            color: '#FFC107', icon: 'remove-outline'        };
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
  const dailyQuestion = getTodayQuestion();
  const todayWord = getTodayWord();

  useFocusEffect(useCallback(() => {
    const load = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: recent } = await supabase
          .from('test_results').select('level, created_at')
          .eq('user_id', user.id).order('created_at', { ascending: false }).limit(5);

        if (recent?.length) {
          const currentLevel = recent[0].level;
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
        const { data: ans } = await supabase
          .from('daily_answers').select('answer')
          .eq('user_id', user.id).eq('question_date', today).maybeSingle();
        setDailyAnswered(ans ? ans.answer : false);
        if (ans) fetchOtherAnswers(user.id);

        const word = getTodayWord();
        const { data: myTap } = await supabase
          .from('daily_word_taps').select('reaction')
          .eq('user_id', user.id).eq('word_date', today).maybeSingle();
        setWordTapped(myTap ? myTap.reaction : false);
        const { count } = await supabase
          .from('daily_word_taps').select('*', { count: 'exact', head: true })
          .eq('word_date', today).eq('word', word).eq('reaction', 'yes');
        setWordCount(count || 0);
      }
      setLoading(false);
    };
    load();
  }, []));

  const tapWord = async (reaction) => {
    if (wordTapped) return;
    setWordTapped(reaction);
    if (reaction === 'yes') setWordCount(c => c + 1);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('daily_word_taps').insert({
        user_id: user.id, word: todayWord, word_date: getTodayDate(), reaction,
      });
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

  const lvlColor   = LEVEL_COLORS[level];
  const dynamic    = getDynamic(history);
  const chartData  = showAllChart ? allHistory : history;

  return (
    <View style={styles.safeArea}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        contentInset={{ bottom: 80 }}
        scrollIndicatorInsets={{ bottom: 80 }}
      >

        <Text style={styles.greeting}>Привет, {store.username || 'друг'}</Text>

        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginVertical: 24 }} />
        ) : (
          <View style={[styles.statusCard, { borderLeftColor: lvlColor }]}>
            <View style={[styles.statusIconWrap, { backgroundColor: lvlColor + '22' }]}>
              <Ionicons name={LEVEL_ICONS[level]} size={22} color={lvlColor} />
            </View>
            <View style={styles.statusInfo}>
              <Text style={[styles.statusLevel, { color: lvlColor }]}>
                {LEVEL_NAMES[level]}
              </Text>
              <Text style={styles.statusDesc}>{LEVEL_TEXTS[level]}</Text>
              {dynamic && (
                <View style={styles.dynamicRow}>
                  <Ionicons name={dynamic.icon} size={13} color={dynamic.color} />
                  <Text style={[styles.dynamicLabel, { color: dynamic.color }]}>{dynamic.label}</Text>
                </View>
              )}
              {!history.length && (
                <Text style={styles.noTestHint}>Пройди тест чтобы узнать своё состояние</Text>
              )}
            </View>
          </View>
        )}

        {!loading && communityCount > 0 && (
          <View style={styles.communityStrip}>
            <Ionicons name="people-outline" size={14} color={colors.muted} />
            <Text style={styles.communityText}>
              сегодня {communityCount} {pluralPeople(communityCount)} с твоим уровнем заходили
            </Text>
          </View>
        )}

        <View style={styles.ctaRow}>
          <TouchableOpacity
            style={[styles.ctaPrimary, { backgroundColor: lvlColor }]}
            onPress={() => navigation.navigate('Test')}
            activeOpacity={0.8}
          >
            <Ionicons name="clipboard-outline" size={18} color="#fff" />
            <Text style={styles.ctaPrimaryText}>Пройти тест</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.ctaSecondary}
            onPress={() => navigation.navigate('Recommendations', { level })}
            activeOpacity={0.8}
          >
            <Ionicons name="bulb-outline" size={18} color={colors.white} />
            <Text style={styles.ctaSecondaryText}>Рекомендации</Text>
          </TouchableOpacity>
        </View>

        {!loading && wordTapped !== 'no' && (
          <View style={styles.wordCard}>
            <Text style={styles.wordLabel}>Слово дня</Text>
            <Text style={[styles.wordText, { color: lvlColor }]}>{todayWord}</Text>
            {wordTapped === 'yes' ? (
              <Text style={styles.wordCount}>
                ты и ещё {wordCount > 1 ? wordCount - 1 : 0} {pluralPeople(wordCount - 1)} чувствуют то же
              </Text>
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
          <View style={styles.dailyCard}>
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

        <Text style={styles.sectionTitle}>Модули</Text>
        <View style={styles.grid}>
          {MODULE_ITEMS.map(m => (
            <TouchableOpacity
              key={m.route}
              style={styles.moduleButton}
              onPress={() => navigation.navigate(m.route)}
              activeOpacity={0.7}
            >
              <Ionicons name={m.icon} size={26} color={colors.accent} />
              <Text style={styles.moduleLabel}>{m.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {chartData.length >= 1 && (
          <View style={styles.section}>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>Динамика</Text>
              {allHistory.length > 5 && (
                <TouchableOpacity onPress={() => setShowAllChart(v => !v)}>
                  <Text style={styles.chartToggle}>
                    {showAllChart ? 'Последние 5' : `Все (${allHistory.length})`}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            <TestChart history={chartData} />
          </View>
        )}

        {history.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>История тестов</Text>
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
            backgroundColor: val === 1 ? '#4CAF5033' : val === 0.5 ? '#FFC10733' : '#F4433633',
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
          { val: 0.5, color: '#FFC107' },
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

  greeting:  { fontSize: 22, fontWeight: '700', color: colors.white, marginBottom: 20 },

  // Status card
  statusCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 14,
    backgroundColor: colors.card, borderRadius: 16,
    padding: 16, borderLeftWidth: 3, marginBottom: 16,
  },
  statusIconWrap: {
    width: 42, height: 42, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  statusInfo:   { flex: 1 },
  statusLevel:  { fontSize: 17, fontWeight: '700', marginBottom: 4 },
  statusDesc:   { fontSize: 13, color: colors.muted, lineHeight: 18, marginBottom: 6 },
  dynamicRow:   { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dynamicLabel: { fontSize: 12, fontWeight: '600' },
  noTestHint:   { fontSize: 13, color: colors.muted, fontStyle: 'italic' },

  communityStrip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginBottom: 14, paddingHorizontal: 4,
  },
  communityText: { fontSize: 13, color: colors.muted },

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
    backgroundColor: colors.card,
  },
  ctaSecondaryText: { color: colors.white, fontWeight: '600', fontSize: 14 },

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
  wordCount: { fontSize: 13, color: colors.muted, fontStyle: 'italic' },

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
  sectionTitle: {
    fontSize: 12, fontWeight: '700', color: colors.muted,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 14,
  },
  section:    { marginBottom: 28 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  chartToggle:{ color: colors.accent, fontSize: 12, fontWeight: '600' },

  // Modules grid
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 28 },
  moduleButton: {
    backgroundColor: colors.card, borderRadius: 14,
    padding: 16, alignItems: 'center', justifyContent: 'center',
    width: '30%', flexGrow: 1, gap: 8,
  },
  moduleLabel: { color: colors.white, fontSize: 12, fontWeight: '500', textAlign: 'center' },

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
