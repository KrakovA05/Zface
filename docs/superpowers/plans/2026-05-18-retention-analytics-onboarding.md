# Retention: Онбординг + Живая Аналитика — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Замкнуть петлю «действие → фидбек» в аналитике и провести нового пользователя через полный «aha» за первую сессию.

**Architecture:** Новая утилита `computeLiveProfile` вычисляет метрики из сырых данных на клиенте; `AnalyticsScreen` использует её вместо еженедельного снапшота; новый `AnalyticsPreviewScreen` встраивается в первый флоу после теста уровня; HomeScreen показывает тихую карточку «твой профиль обновился» после каждого значимого действия.

**Tech Stack:** React Native, Supabase JS, AsyncStorage, Ionicons, React Navigation v7

**Project root:** `/Users/user/Zface/ustal/`

---

## Файлы

| Файл | Действие |
|------|---------|
| `ustal/utils/computeLiveProfile.js` | Создать — клиентская формула расчёта метрик |
| `ustal/screens/AnalyticsScreen.js` | Изменить — живые данные, дельта на барах, переименовать метки |
| `ustal/screens/AnalyticsPreviewScreen.js` | Создать — экран частичного профиля после первого теста |
| `ustal/screens/RecommendationsScreen.js` | Изменить — при `isFirstTest` идти на `AnalyticsPreview` |
| `ustal/App.js` | Изменить — зарегистрировать `AnalyticsPreviewScreen` |
| `ustal/screens/PsychTestScreen.js` | Изменить — после сохранения выставить AsyncStorage-флаг |
| `ustal/screens/HomeScreen.js` | Изменить — показывать карточку «твой профиль обновился» |

---

## Task 1: computeLiveProfile — утилита клиентского расчёта метрик

**Files:**
- Create: `ustal/utils/computeLiveProfile.js`

Та же формула что в `supabase/functions/compute-weekly-profile/index.ts`, но на JS-клиенте. Запрашивает сырые данные одним `Promise.all` и возвращает объект той же структуры что `user_metrics`.

- [ ] **Step 1: Создать файл**

```js
// ustal/utils/computeLiveProfile.js
import { supabase } from '../supabase';

const DIMENSION_WEIGHTS = {
  anxiety: 0.20, stress: 0.20, apathy: 0.15, loneliness: 0.15,
  burnout: 0.10, self_esteem: 0.10, social_anxiety: 0.05, attachment: 0.05,
};

function norm(value, min, max) {
  if (max === min) return 0;
  return Math.round(Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100)));
}

export async function computeLiveProfile(uid) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const weekStartIso = weekStart.toISOString();
  const weekStartStr = weekStart.toISOString().split('T')[0];

  const [
    { data: psychResults },
    { count: msgCount },
    { data: dmData },
    { data: nightMsgData },
    { count: checkinCount },
    { data: checkinScoreData },
    { count: helpsCount },
  ] = await Promise.all([
    supabase.from('psych_test_results')
      .select('dimension, normalized_score, created_at')
      .eq('user_id', uid).gte('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: false }),
    supabase.from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('sender_id', uid).gte('created_at', weekStartIso),
    supabase.from('direct_messages')
      .select('conversation_id')
      .eq('sender_id', uid).gte('created_at', weekStartIso),
    supabase.from('messages')
      .select('created_at')
      .eq('sender_id', uid).gte('created_at', weekStartIso),
    supabase.from('mood_checkins')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', uid).gte('checkin_date', weekStartStr),
    supabase.from('mood_checkins')
      .select('score')
      .eq('user_id', uid).gte('checkin_date', weekStartStr)
      .order('checkin_date', { ascending: true }),
    supabase.from('user_helps')
      .select('*', { count: 'exact', head: true })
      .eq('helped_id', uid).gte('created_at', weekStartIso),
  ]);

  const testScores = {};
  for (const r of psychResults ?? []) {
    if (!testScores[r.dimension]) testScores[r.dimension] = r.normalized_score;
  }

  const uniqueConvs = new Set((dmData ?? []).map(d => d.conversation_id)).size;
  const nightCount = (nightMsgData ?? []).filter(m => {
    const h = new Date(m.created_at).getHours();
    return h >= 0 && h < 5;
  }).length;
  const checkinScores = (checkinScoreData ?? []).map(c => c.score);
  const checkinTrend = checkinScores.length >= 2
    ? checkinScores[checkinScores.length - 1] - checkinScores[0]
    : 0;

  const behavioralScores = {
    anxiety:        norm(nightCount, 0, 10),
    stress:         norm(Math.max(0, 7 - (checkinCount ?? 0)), 0, 7),
    loneliness:     norm(Math.max(0, 5 - uniqueConvs), 0, 5),
    apathy:         norm(Math.max(0, 7 - Math.min(7, msgCount ?? 0)), 0, 7),
    self_esteem:    Math.max(0, 100 - norm(helpsCount ?? 0, 0, 5)),
    burnout:        checkinTrend < -2 ? 70 : checkinTrend < 0 ? 40 : 20,
    social_anxiety: norm(Math.max(0, 10 - (msgCount ?? 0)), 0, 10),
    attachment:     testScores['attachment'] ?? 50,
  };

  const dimensionScores = {};
  for (const dim of Object.keys(DIMENSION_WEIGHTS)) {
    const hasTest = testScores[dim] !== undefined;
    const testScore = testScores[dim] ?? behavioralScores[dim] ?? 50;
    const behavScore = behavioralScores[dim] ?? testScore;
    dimensionScores[dim] = Math.round(
      hasTest ? testScore * 0.6 + behavScore * 0.4 : behavScore
    );
  }

  let composite = 0;
  for (const [dim, weight] of Object.entries(DIMENSION_WEIGHTS)) {
    composite += (dimensionScores[dim] ?? 50) * weight;
  }
  composite = Math.round(composite);

  const dominant = Object.entries(dimensionScores)
    .sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'stress';

  return {
    anxiety_score:        dimensionScores.anxiety,
    stress_score:         dimensionScores.stress,
    apathy_score:         dimensionScores.apathy,
    loneliness_score:     dimensionScores.loneliness,
    burnout_score:        dimensionScores.burnout,
    self_esteem_score:    dimensionScores.self_esteem,
    social_anxiety_score: dimensionScores.social_anxiety,
    attachment_score:     dimensionScores.attachment,
    composite_score:      composite,
    dominant_dimension:   dominant,
    week_start:           weekStartStr,
  };
}
```

- [ ] **Step 2: Коммит**

```bash
git add ustal/utils/computeLiveProfile.js
git commit -m "feat(analytics): утилита computeLiveProfile — клиентский расчёт метрик"
```

---

## Task 2: AnalyticsScreen — живые данные, дельта, переименование меток

**Files:**
- Modify: `ustal/screens/AnalyticsScreen.js`

Три изменения в одном файле:
1. Заменить `latestMetrics` из `user_metrics` на вызов `computeLiveProfile`
2. Переименовать `self_esteem` → «Нехватка уверенности», `attachment` → «Тревога привязанности»; убрать инверсию цвета для них (все 8 теперь «выше = хуже»)
3. Добавить дельта-сегмент на бары `ProfileSection` + числовой `▲X`/`▼X`

- [ ] **Step 1: Обновить импорты и константы (строки 1–55)**

Заменить начало файла:

```js
import {
  StyleSheet, Text, View, TouchableOpacity,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';
import { store } from '../store';
import { colors } from '../theme';
import { computeLiveProfile } from '../utils/computeLiveProfile';

// ─── Константы ───────────────────────────────────────────────────────────────

const DIMENSION_LABELS = {
  anxiety:        'Тревога',
  stress:         'Стресс',
  apathy:         'Апатия',
  loneliness:     'Одиночество',
  burnout:        'Выгорание',
  self_esteem:    'Нехватка уверенности',
  social_anxiety: 'Соц. тревога',
  attachment:     'Тревога привязанности',
};

// Все измерения: выше = хуже → scoreColor применяется напрямую
function dimBarColor(score) {
  if (score <= 33) return '#5DAA72';
  if (score <= 66) return '#AA7C00';
  return '#c0392b';
}
```

- [ ] **Step 2: Обновить ProfileSection — добавить дельта-сегмент**

Найти функцию `ProfileSection` (строки 183–213) и заменить целиком:

```js
const DIMENSION_ORDER = ['anxiety', 'stress', 'apathy', 'loneliness', 'burnout', 'self_esteem', 'social_anxiety', 'attachment'];

function ProfileSection({ metrics, prevMetrics }) {
  if (!metrics) {
    return (
      <SectionCard title="Психометрический профиль">
        <Text style={styles.emptyText}>
          Данные появятся после прохождения психологических тестов
        </Text>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Психометрический профиль">
      {DIMENSION_ORDER.map(dim => {
        const key = `${dim}_score`;
        const score = metrics[key];
        if (score === undefined || score === null) return null;
        const prevScore = prevMetrics?.[key];
        const delta = prevScore !== undefined ? score - prevScore : 0;
        const barColor = dimBarColor(score);

        return (
          <View key={dim} style={styles.dimRow}>
            <Text style={styles.dimLabel}>{DIMENSION_LABELS[dim]}</Text>
            <View style={styles.dimBarWrap}>
              <View style={[styles.dimBarFill, { width: `${score}%`, backgroundColor: barColor }]} />
              {delta !== 0 && (
                <View style={[
                  styles.dimDeltaSegment,
                  {
                    left: `${Math.min(score, prevScore)}%`,
                    width: `${Math.abs(delta)}%`,
                    backgroundColor: delta > 0 ? '#c0392b' : '#5DAA72',
                  }
                ]} />
              )}
            </View>
            <View style={styles.dimScoreWrap}>
              <Text style={[styles.dimScore, { color: barColor }]}>{score}</Text>
              {delta !== 0 && (
                <Text style={[styles.dimDelta, { color: delta > 0 ? '#c0392b' : '#5DAA72' }]}>
                  {delta > 0 ? `▲${delta}` : `▼${Math.abs(delta)}`}
                </Text>
              )}
            </View>
          </View>
        );
      })}
    </SectionCard>
  );
}
```

- [ ] **Step 3: Обновить `load` в главном компоненте**

Найти `async function load()` (строки 291–337) и заменить целиком:

```js
async function load() {
  setLoading(true);
  const uid = store.userId;
  if (!uid) { setLoading(false); return; }

  const [
    liveMetrics,
    { data: mHistory },
    { data: tests },
    { data: userRow },
    { data: prevMetricsRow },
  ] = await Promise.all([
    computeLiveProfile(uid),
    supabase.from('user_metrics')
      .select('composite_score, week_start')
      .eq('user_id', uid)
      .order('week_start', { ascending: false })
      .limit(4),
    supabase.from('test_results')
      .select('level, score, created_at')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(14),
    supabase.from('users')
      .select('login_streak')
      .eq('user_id', uid)
      .maybeSingle(),
    supabase.from('user_metrics')
      .select('*')
      .eq('user_id', uid)
      .order('week_start', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (!active) return;
  setMetrics(liveMetrics);
  setPrevMetrics(prevMetricsRow);
  setMetricsHistory(mHistory || []);
  setTestHistory(tests || []);
  setUserActivity({
    streak: userRow?.login_streak || 0,
    testCount: tests?.length || 0,
    lastTest: tests?.[0]?.created_at || null,
  });
  setLoading(false);
}
```

- [ ] **Step 4: Добавить `prevMetrics` state и передать в ProfileSection**

В `export default function AnalyticsScreen` добавить `const [prevMetrics, setPrevMetrics] = useState(null);` рядом с `const [metrics, setMetrics] = useState(null);`.

Найти `<ProfileSection metrics={metrics} />` и заменить на `<ProfileSection metrics={metrics} prevMetrics={prevMetrics} />`.

- [ ] **Step 5: Обновить стили — убрать overflow:hidden, добавить delta-стили**

Найти в `StyleSheet.create`:

```js
dimBarWrap: {
  flex: 1,
  height: 6,
  backgroundColor: '#E8DFD0',
  borderRadius: 3,
  overflow: 'hidden',
},
dimBarFill: {
  height: 6,
  borderRadius: 3,
},
dimScore: {
  width: 28,
  fontSize: 12,
  fontWeight: '700',
  textAlign: 'right',
},
```

Заменить на:

```js
dimBarWrap: {
  flex: 1,
  height: 6,
  backgroundColor: '#E8DFD0',
  borderRadius: 3,
  position: 'relative',
},
dimBarFill: {
  height: 6,
  borderRadius: 3,
},
dimDeltaSegment: {
  position: 'absolute',
  height: 6,
  borderRadius: 2,
  opacity: 0.6,
},
dimScoreWrap: {
  width: 44,
  alignItems: 'flex-end',
},
dimScore: {
  fontSize: 12,
  fontWeight: '700',
},
dimDelta: {
  fontSize: 9,
  fontWeight: '600',
},
```

- [ ] **Step 6: Удалить устаревшие константы**

Удалить строки с `const NEGATIVE_DIMS = [...]` и старой функцией `function dimBarColor(dim, score)` — заменены в Step 1.

- [ ] **Step 7: Коммит**

```bash
git add ustal/screens/AnalyticsScreen.js
git commit -m "feat(analytics): живые данные + дельта на барах + переименование измерений"
```

---

## Task 3: AnalyticsPreviewScreen — экран частичного профиля

**Files:**
- Create: `ustal/screens/AnalyticsPreviewScreen.js`

Показывается только при первом тесте — между Recommendations и OnboardingMoment.

- [ ] **Step 1: Создать файл**

```js
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';
import { store } from '../store';

const LEVEL_COLORS = { green: '#5DAA72', yellow: '#AA7C00', red: '#c0392b' };
const LEVEL_NAMES  = { green: 'Зелёный', yellow: 'Жёлтый', red: 'Красный' };
const LEVEL_PCT    = { green: '22%', yellow: '55%', red: '82%' };

const LOCKED_DIMS = [
  'Тревога', 'Стресс', 'Апатия', 'Одиночество',
  'Выгорание', 'Нехватка уверенности', 'Соц. тревога', 'Тревога привязанности',
];

export default function AnalyticsPreviewScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const level  = route.params?.level || store.level || 'green';
  const lColor = LEVEL_COLORS[level];

  const goToTest = () => {
    navigation.navigate('PsychTest', {
      testId: 'pss4',
      onComplete: () => navigation.replace('OnboardingMoment', { level }),
    });
  };

  const skip = () => navigation.replace('OnboardingMoment', { level });

  return (
    <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
      <Text style={styles.heading}>Твой профиль</Text>

      {/* Уровень — заполнен */}
      <View style={styles.card}>
        <View style={styles.levelRow}>
          <Text style={styles.dimLabel}>Уровень</Text>
          <Text style={[styles.levelValue, { color: lColor }]}>{LEVEL_NAMES[level]}</Text>
        </View>
        <View style={styles.barWrap}>
          <View style={[styles.barFill, { width: LEVEL_PCT[level], backgroundColor: lColor }]} />
        </View>
      </View>

      {/* Заблокированные измерения */}
      <View style={styles.card}>
        {LOCKED_DIMS.map((label, i) => (
          <View key={i} style={[styles.lockedRow, i > 0 && styles.lockedRowBorder]}>
            <Text style={styles.lockedLabel}>{label}</Text>
            <View style={styles.lockedBarWrap}>
              <View style={styles.lockedBarFill} />
            </View>
            <Ionicons name="lock-closed-outline" size={13} color={colors.muted} />
          </View>
        ))}
      </View>

      <Text style={styles.hint}>узнай подробнее — 4 вопроса</Text>

      <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: lColor }]} onPress={goToTest} activeOpacity={0.85}>
        <Text style={styles.primaryBtnText}>Узнать</Text>
        <Ionicons name="arrow-forward" size={18} color="#fff" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.skipBtn} onPress={skip} activeOpacity={0.7}>
        <Text style={styles.skipText}>Пропустить</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF7F2', paddingHorizontal: 20 },
  heading:   { fontSize: 22, fontWeight: '800', color: '#2C2420', marginBottom: 16 },

  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: '#E8DFD0', marginBottom: 10,
  },

  levelRow:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  dimLabel:   { fontSize: 13, color: '#2C2420' },
  levelValue: { fontSize: 13, fontWeight: '700' },
  barWrap:    { height: 5, backgroundColor: '#E8DFD0', borderRadius: 3 },
  barFill:    { height: 5, borderRadius: 3 },

  lockedRow:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10 },
  lockedRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E8DFD0' },
  lockedLabel:     { fontSize: 13, color: '#A09080', width: 130 },
  lockedBarWrap:   { flex: 1, height: 4, backgroundColor: '#E8DFD0', borderRadius: 2 },
  lockedBarFill:   { width: '40%', height: 4, backgroundColor: '#E8DFD0', borderRadius: 2 },

  hint: { fontSize: 12, color: '#A09080', textAlign: 'center', marginVertical: 16 },

  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: 14,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  skipBtn: { marginTop: 12, alignItems: 'center', paddingVertical: 10 },
  skipText: { fontSize: 14, color: '#A09080' },
});
```

- [ ] **Step 2: Коммит**

```bash
git add ustal/screens/AnalyticsPreviewScreen.js
git commit -m "feat(onboarding): AnalyticsPreviewScreen — частичный профиль после первого теста"
```

---

## Task 4: Навигация — вставить AnalyticsPreview в первый флоу

**Files:**
- Modify: `ustal/App.js` (строки ~53–54 импорты, ~506 регистрация)
- Modify: `ustal/screens/RecommendationsScreen.js` (строка 208)

- [ ] **Step 1: Добавить импорт в App.js**

После строки `import AchievementsScreen from './screens/AchievementsScreen';` добавить:

```js
import AnalyticsPreviewScreen from './screens/AnalyticsPreviewScreen';
```

- [ ] **Step 2: Зарегистрировать экран в App.js**

После строки `<Stack.Screen name="Achievements" component={AchievementsScreen} options={{ headerShown: false }} />` добавить:

```jsx
<Stack.Screen name="AnalyticsPreview" component={AnalyticsPreviewScreen} options={{ headerShown: false }} />
```

- [ ] **Step 3: Изменить навигацию в RecommendationsScreen.js**

Найти строку 208:
```js
onPress={() => isFirstTest ? navigation.replace('OnboardingMoment', { level }) : navigation.navigate('Main')}
```

Заменить на:
```js
onPress={() => isFirstTest ? navigation.replace('AnalyticsPreview', { level }) : navigation.navigate('Main')}
```

- [ ] **Step 4: Коммит**

```bash
git add ustal/App.js ustal/screens/RecommendationsScreen.js
git commit -m "feat(onboarding): вставить AnalyticsPreview в флоу первого теста"
```

---

## Task 5: «Твой профиль обновился» — карточка на HomeScreen

**Files:**
- Modify: `ustal/screens/PsychTestScreen.js` (строки ~50–64)
- Modify: `ustal/screens/HomeScreen.js`

- [ ] **Step 1: Добавить AsyncStorage флаг в PsychTestScreen**

В начале файла добавить импорт:
```js
import AsyncStorage from '@react-native-async-storage/async-storage';
```

Найти блок после успешного `supabase.from('psych_test_results').insert(...)` (строки ~50–64):
```js
const { error } = await supabase.from('psych_test_results').insert({
  ...
});
if (error) {
  setSaving(false);
  Alert.alert('Ошибка', 'Не удалось сохранить результат. Попробуй ещё раз.');
  return;
}
setSaving(false);
setDone(true);
```

Заменить последние две строки:
```js
setSaving(false);
await AsyncStorage.setItem('profile_updated', 'true');
setDone(true);
```

- [ ] **Step 2: Добавить state и useFocusEffect чтение флага в HomeScreen**

HomeScreen уже использует `AsyncStorage` — добавить в список импортируемых RN-компонентов ничего не нужно (AsyncStorage уже импортирован).

Добавить state рядом с другими useState (найти блок объявлений state, примерно строки 195–220):
```js
const [profileUpdated, setProfileUpdated] = useState(false);
```

Внутри `useFocusEffect` (в начале коллбека перед основными запросами) добавить:
```js
AsyncStorage.getItem('profile_updated').then(v => {
  if (v === 'true') setProfileUpdated(true);
});
```

- [ ] **Step 3: Добавить карточку в JSX HomeScreen**

Найти блок (строки ~787–789):
```jsx
        )}

        {/* ── Чекин настроения — сразу под фокусом ── */}
```

Вставить карточку между ними:
```jsx
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

        {/* ── Чекин настроения — сразу под фокусом ── */}
```

- [ ] **Step 4: Добавить стили в HomeScreen StyleSheet**

В `StyleSheet.create` добавить:
```js
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
```

- [ ] **Step 5: Коммит**

```bash
git add ustal/screens/PsychTestScreen.js ustal/screens/HomeScreen.js
git commit -m "feat(home): карточка «твой профиль обновился» после психотеста"
```

---

## Финальная проверка

После всех задач запустить приложение и проверить:

- [ ] Первый тест → Рекомендации → `AnalyticsPreviewScreen` с частичным профилем → «Узнать» открывает PSS-4 → после завершения PSS-4 → `OnboardingMoment`
- [ ] «Пропустить» на `AnalyticsPreviewScreen` → `OnboardingMoment`
- [ ] `AnalyticsScreen` показывает живые данные (не пустой экран «данные после первого теста»)
- [ ] На барах `ProfileSection` после второй недели использования появляется дельта
- [ ] Метки: «Нехватка уверенности» и «Тревога привязанности» вместо старых
- [ ] После прохождения любого психотеста на HomeScreen появляется карточка «твой профиль обновился»
- [ ] Тап по карточке → `AnalyticsScreen`, карточка исчезает
