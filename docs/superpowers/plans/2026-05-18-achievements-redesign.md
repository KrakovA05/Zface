# Achievements Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Переработать систему достижений — 27 достижений в 5 группах, блок «В процессе» с прогресс-барами, Ionicons вместо эмодзи; + улучшения карточки психотеста на HomeScreen.

**Architecture:** `ACHIEVEMENT_GROUPS` в `constants.js` — источник истины для UI и логики. `checkAndAwardAchievements` в ProfileScreen переписан с одним `Promise.all` на 14 параллельных запросов. Новая таблица `breathing_sessions` трекает сессии дыхания. ProfileScreen рендерит секцию через `ACHIEVEMENT_GROUPS.map` с прогресс-картами сверху.

**Tech Stack:** React Native, Supabase PostgreSQL + RLS, Ionicons, MCP supabase tools

---

## Файлы к изменению

| Файл | Что меняется |
|---|---|
| Supabase migration | Создать `breathing_sessions` с RLS |
| `ustal/constants.js` | Заменить `ACHIEVEMENTS` на `ACHIEVEMENT_GROUPS` + flat `ACHIEVEMENTS` |
| `ustal/screens/BreathingScreen.js` | Вставка в `breathing_sessions` при остановке |
| `ustal/screens/ProfileScreen.js` | `checkAndAwardAchievements` (параллельные запросы, 27 достижений), новый UI секции |
| `ustal/screens/HomeScreen.js` | ? кнопка + «обновится завтра» на карточке психотеста |

---

### Task 1: DB migration — таблица breathing_sessions

**Files:**
- Supabase migration via MCP `apply_migration`

- [ ] **Step 1: Применить миграцию через MCP**

```sql
create table if not exists breathing_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(user_id) on delete cascade not null,
  created_at timestamptz default now() not null
);

alter table breathing_sessions enable row level security;

create policy "users manage own breathing sessions"
  on breathing_sessions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

- [ ] **Step 2: Проверить создание таблицы**

```sql
select table_name from information_schema.tables
where table_schema = 'public' and table_name = 'breathing_sessions';
```

Ожидаемый результат: одна строка `breathing_sessions`.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(db): таблица breathing_sessions для трекинга дыхательных сессий"
```

---

### Task 2: Обновить ACHIEVEMENTS в constants.js

**Files:**
- Modify: `ustal/constants.js` (строки 308–321)

- [ ] **Step 1: Заменить ACHIEVEMENTS на ACHIEVEMENT_GROUPS + flat-экспорт**

Найти и полностью заменить блок начиная с `export const ACHIEVEMENTS = [` до закрывающей `];` (строки 308–321) на:

```js
export const ACHIEVEMENT_GROUPS = [
  {
    id: 'path',
    label: 'Путь',
    achievements: [
      { id: 'first_test',   icon: 'flask-outline',       label: 'Первый шаг',       desc: 'Ты решился посмотреть на себя честно',        hidden: false },
      { id: 'five_tests',   icon: 'repeat-outline',      label: 'Привычка',         desc: 'Пять тестов. Значит, ты возвращаешься',       hidden: false },
      { id: 'ten_tests',    icon: 'analytics-outline',   label: 'Самоанализ',       desc: 'Десять раз — это уже не случайность',         hidden: true  },
      { id: 'twenty_tests', icon: 'telescope-outline',   label: 'Глубже',           desc: 'Двадцать тестов. Ты смотришь честно',         hidden: true  },
      { id: 'comeback',     icon: 'trending-up-outline', label: 'Возвращение',      desc: 'Из красного вышел. Это непросто',             hidden: false },
      { id: 'stable',       icon: 'leaf-outline',        label: 'Стабильность',     desc: 'Три зелёных подряд. Держишься',               hidden: false },
    ],
  },
  {
    id: 'daily',
    label: 'Каждый день',
    achievements: [
      { id: 'checkin_first', icon: 'thermometer-outline', label: 'Честно',           desc: 'Первый чекин настроения. Хорошее начало',     hidden: false },
      { id: 'checkin_7',     icon: 'calendar-outline',    label: 'Неделя честности', desc: 'Семь чекинов подряд. Ты замечаешь себя',      hidden: true  },
      { id: 'daily_7',       icon: 'chatbox-outline',     label: 'Неделя',           desc: 'Семь дней подряд. Ты здесь — и это важно',    hidden: true  },
      { id: 'daily_30',      icon: 'ribbon-outline',      label: 'Месяц',            desc: 'Тридцать дней. Это уже часть тебя',           hidden: true  },
      { id: 'streak_14',     icon: 'flame-outline',       label: 'Две недели',       desc: 'Четырнадцать дней в приложении подряд',       hidden: true  },
    ],
  },
  {
    id: 'voice',
    label: 'Голос',
    achievements: [
      { id: 'profile_done',       icon: 'person-outline',              label: 'Личность',       desc: 'Ты заполнил статус. Тебя теперь видно',         hidden: false },
      { id: 'first_post',         icon: 'create-outline',              label: 'Голос',          desc: 'Написал пост. Кто-то прочитал и почувствовал',  hidden: true  },
      { id: 'first_thought',      icon: 'chatbubble-ellipses-outline', label: 'Мысль вслух',   desc: 'Первая анонимная мысль. Это смелость',          hidden: false },
      { id: 'thought_reactions_5',icon: 'heart-outline',               label: 'Тебя услышали', desc: 'Пять реакций на твою мысль',                    hidden: true  },
      { id: 'first_reaction',     icon: 'hand-left-outline',           label: 'Поддержал',     desc: 'Первая реакция на чужую мысль',                 hidden: false },
    ],
  },
  {
    id: 'connections',
    label: 'Связи',
    achievements: [
      { id: 'first_friend', icon: 'people-outline',      label: 'Не один',        desc: 'Кто-то нашёлся. Это что-то значит',            hidden: false },
      { id: 'first_dm',     icon: 'paper-plane-outline', label: 'Написал первым', desc: 'Написал первым. Это смелость',                  hidden: false },
      { id: 'helper_1',     icon: 'sparkles-outline',    label: 'Кто-то заметил', desc: 'Один человек сказал, что ты ему помог',         hidden: false },
      { id: 'helper_5',     icon: 'sunny-outline',       label: 'Рядом',          desc: 'Пять людей сказали что ты им помог',            hidden: true  },
      { id: 'helper_20',    icon: 'bonfire-outline',     label: 'Маяк',           desc: 'Двадцать. Ты стал чем-то важным для кого-то',   hidden: true  },
    ],
  },
  {
    id: 'depth',
    label: 'Глубина',
    achievements: [
      { id: 'psych_first',    icon: 'layers-outline',   label: 'Под поверхностью', desc: 'Первый психологический тест',                    hidden: false },
      { id: 'psych_all',      icon: 'prism-outline',    label: 'Полная картина',   desc: 'Все 8 психотестов пройдены хотя бы раз',        hidden: true  },
      { id: 'breathing_first',icon: 'sync-outline',     label: 'Выдох',            desc: 'Первая дыхательная сессия',                      hidden: false },
      { id: 'breathing_10',   icon: 'water-outline',    label: 'Дышу',             desc: 'Десять сессий дыхания',                          hidden: true  },
      { id: 'fish_first',     icon: 'fish-outline',     label: 'Рыбак',            desc: 'Первая пойманная рыба',                          hidden: false },
      { id: 'fish_rare',      icon: 'diamond-outline',  label: 'Редкость',         desc: 'Поймал редкую или легендарную рыбу',             hidden: true  },
    ],
  },
];

export const ACHIEVEMENTS = ACHIEVEMENT_GROUPS.flatMap(g => g.achievements);
```

- [ ] **Step 2: Проверить что файл сохранился без синтаксических ошибок**

```bash
cd /Users/user/Zface/ustal && node -e "const c = require('./constants.js'); console.log('groups:', c.ACHIEVEMENT_GROUPS.length, 'flat:', c.ACHIEVEMENTS.length);"
```

Ожидаемый результат: `groups: 5 flat: 27`

- [ ] **Step 3: Commit**

```bash
git add ustal/constants.js
git commit -m "feat(achievements): 27 достижений в 5 группах с Ionicons — заменяет старый список"
```

---

### Task 3: BreathingScreen — записывать сессию при остановке

**Files:**
- Modify: `ustal/screens/BreathingScreen.js`

- [ ] **Step 1: Добавить импорты supabase и store**

В начало файла после `import AsyncStorage from '@react-native-async-storage/async-storage';` добавить:

```js
import { supabase } from '../supabase';
import { store } from '../store';
```

- [ ] **Step 2: Изменить функцию stop — вставлять запись при остановке активной сессии**

Найти:
```js
  const stop  = () => {
    setRunning(false);
    setPhaseIdx(0);
    setSecs(PHASES[0].duration / 1000);
    Animated.timing(scale, { toValue: 1.0, duration: 400, useNativeDriver: true }).start();
  };
```

Заменить на:
```js
  const stop  = () => {
    if (running && store.userId) {
      supabase.from('breathing_sessions').insert({ user_id: store.userId }).then(() => {});
    }
    setRunning(false);
    setPhaseIdx(0);
    setSecs(PHASES[0].duration / 1000);
    Animated.timing(scale, { toValue: 1.0, duration: 400, useNativeDriver: true }).start();
  };
```

Запись делается только если `running === true` в момент нажатия, что гарантирует: пользователь действительно начал сессию перед тем как остановить. При нажатии «Назад» без запуска — `running === false`, вставки не будет.

- [ ] **Step 3: Commit**

```bash
git add ustal/screens/BreathingScreen.js
git commit -m "feat(breathing): записывать сессию в breathing_sessions при остановке"
```

---

### Task 4: ProfileScreen — новый checkAndAwardAchievements

**Files:**
- Modify: `ustal/screens/ProfileScreen.js`

- [ ] **Step 1: Обновить импорт из constants.js**

Найти строку:
```js
import { LEVEL_DATA, MOTIVATORS, ACHIEVEMENTS } from '../constants';
```

Заменить на:
```js
import { LEVEL_DATA, MOTIVATORS, ACHIEVEMENTS, ACHIEVEMENT_GROUPS } from '../constants';
```

- [ ] **Step 2: Удалить HIDDEN_ACHIEVEMENTS константу**

Найти и удалить строку:
```js
const HIDDEN_ACHIEVEMENTS = new Set(['ten_tests', 'daily_7', 'first_post', 'helper_5', 'helper_20']);
```

- [ ] **Step 3: Заменить state earnedAchievements на earnedAchievementIds + добавить progressData**

Найти:
```js
  const [earnedAchievements, setEarnedAchievements] = useState([]);
```

Заменить на:
```js
  const [earnedAchievementIds, setEarnedAchievementIds] = useState(new Set());
  const [progressData, setProgressData] = useState({ dailyStreak: 0, dailyStreakTarget: 7, checkinStreak: 0, psychCount: 0 });
```

- [ ] **Step 4: Добавить helper-функцию calcDateStreak перед компонентом**

Добавить после `function Section(...)` (примерно строка 52) и перед `function Row(...)`:

```js
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
```

- [ ] **Step 5: Заменить всю функцию checkAndAwardAchievements**

Найти блок `const checkAndAwardAchievements = async () => {` ... до закрывающей `};` (примерно строки 163–256 после предыдущих правок) и заменить полностью на:

```js
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
      setProgressData({
        dailyStreak,
        dailyStreakTarget: earned.has('daily_7') ? 30 : 7,
        checkinStreak,
        psychCount: uniquePsychTests,
      });
    } catch {
      // тихий fallback
    }
  };
```

- [ ] **Step 6: Commit**

```bash
git add ustal/screens/ProfileScreen.js
git commit -m "feat(achievements): параллельный checkAndAwardAchievements — 27 достижений, 1 Promise.all"
```

---

### Task 5: ProfileScreen — новый UI секции достижений

**Files:**
- Modify: `ustal/screens/ProfileScreen.js`

- [ ] **Step 1: Добавить компонент ProgressCard перед основным компонентом ProfileScreen**

Добавить после функции `calcDateStreak` (перед `export default function ProfileScreen`):

```js
function ProgressCard({ label, current, target, icon }) {
  const pct = Math.min(current / Math.max(target, 1), 1);
  return (
    <View style={pStyles.card}>
      <Ionicons name={icon} size={15} color={colors.accent} />
      <View style={{ flex: 1 }}>
        <View style={pStyles.header}>
          <Text style={pStyles.label}>{label}</Text>
          <Text style={pStyles.count}>{Math.min(current, target)}/{target}</Text>
        </View>
        <View style={pStyles.bar}>
          <View style={[pStyles.fill, { width: `${pct * 100}%` }]} />
        </View>
      </View>
    </View>
  );
}

const pStyles = StyleSheet.create({
  card:   { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  label:  { fontSize: 13, color: colors.white, fontWeight: '500' },
  count:  { fontSize: 12, color: colors.muted },
  bar:    { height: 3, backgroundColor: colors.border, borderRadius: 2 },
  fill:   { height: 3, backgroundColor: colors.accent, borderRadius: 2 },
});
```

- [ ] **Step 2: Заменить секцию достижений в JSX**

Найти блок (примерно строки 572–602 после предыдущих изменений):
```jsx
        {/* Достижения */}
        {earnedAchievements.length > 0 && (
          <Section title={`Достижения ${earnedAchievements.length}/${ACHIEVEMENTS.length}`}>
            <View style={styles.achievementsGrid}>
              {ACHIEVEMENTS.map(a => {
                const earned = earnedAchievements.some(e => e.id === a.id);
                const hidden = !earned && HIDDEN_ACHIEVEMENTS.has(a.id);
                if (hidden) {
                  return (
                    <View key={a.id} style={[styles.achievementItem, styles.achievementLocked]}>
                      <Text style={styles.achievementEmoji}>🔮</Text>
                      <Text style={[styles.achievementLabel, { color: colors.muted }]}>???</Text>
                      <Text style={styles.achievementDesc}>эту получают единицы</Text>
                    </View>
                  );
                }
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
```

Заменить на:
```jsx
        {/* Достижения */}
        <Section title="Достижения">
          {/* Шапка с общим прогрессом */}
          <View style={styles.achHeader}>
            <Text style={styles.achHeaderCount}>{earnedAchievementIds.size} из {ACHIEVEMENTS.length}</Text>
          </View>
          <View style={styles.achProgressBar}>
            <View style={[styles.achProgressFill, { width: `${(earnedAchievementIds.size / ACHIEVEMENTS.length) * 100}%` }]} />
          </View>

          {/* В процессе */}
          <Text style={styles.achGroupLabel}>В процессе</Text>
          <View style={styles.inProgressBlock}>
            <ProgressCard label="Вопрос дня" current={progressData.dailyStreak} target={progressData.dailyStreakTarget} icon="chatbox-outline" />
            <ProgressCard label="Чекин настроения" current={progressData.checkinStreak} target={7} icon="thermometer-outline" />
            <ProgressCard label="Психотесты" current={progressData.psychCount} target={8} icon="flask-outline" />
          </View>

          {/* Группы */}
          {ACHIEVEMENT_GROUPS.map(group => (
            <View key={group.id}>
              <Text style={styles.achGroupLabel}>{group.label}</Text>
              <View style={styles.achievementsGrid}>
                {group.achievements.map(a => {
                  const isEarned = earnedAchievementIds.has(a.id);
                  if (!isEarned && a.hidden) {
                    return (
                      <View key={a.id} style={[styles.achievementItem, styles.achievementLocked]}>
                        <Ionicons name="help-outline" size={22} color={colors.muted} />
                        <Text style={[styles.achievementLabel, { color: colors.muted }]}>???</Text>
                        <Text style={styles.achievementDesc}>эту получают единицы</Text>
                      </View>
                    );
                  }
                  return (
                    <TouchableOpacity
                      key={a.id}
                      style={[styles.achievementItem, !isEarned && styles.achievementLocked]}
                      onPress={() => !isEarned && Alert.alert(a.label, `Как получить:\n${a.desc}`)}
                      activeOpacity={isEarned ? 1 : 0.7}
                    >
                      <Ionicons name={a.icon} size={22} color={isEarned ? colors.accent : colors.muted} />
                      <Text style={[styles.achievementLabel, !isEarned && { color: colors.muted }]}>{a.label}</Text>
                      <Text style={styles.achievementDesc}>{isEarned ? a.desc : '?'}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}
        </Section>
```

- [ ] **Step 3: Обновить стили — удалить achievementEmoji, добавить новые**

Найти блок `// Achievements` в `StyleSheet.create(...)`:
```js
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
```

Заменить на:
```js
  // Achievements
  achHeader: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 14, paddingBottom: 6 },
  achHeaderCount: { fontSize: 12, color: colors.muted },
  achProgressBar: { height: 3, backgroundColor: colors.border, borderRadius: 2, marginHorizontal: 14, marginBottom: 16 },
  achProgressFill: { height: 3, backgroundColor: colors.accent, borderRadius: 2 },
  achGroupLabel: {
    fontSize: 11, fontWeight: '700', color: colors.muted,
    textTransform: 'uppercase', letterSpacing: 0.7,
    paddingHorizontal: 14, paddingTop: 14, paddingBottom: 6,
  },
  inProgressBlock: { paddingHorizontal: 14, paddingBottom: 4 },
  achievementsGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 10, paddingBottom: 8, gap: 8,
  },
  achievementItem: {
    width: '30%', flexGrow: 1,
    backgroundColor: colors.background,
    borderRadius: 12, padding: 10, alignItems: 'center', gap: 4,
  },
  achievementLocked: { opacity: 0.35 },
  achievementLabel: { color: colors.white, fontSize: 11, fontWeight: '600', textAlign: 'center' },
  achievementDesc: { color: colors.muted, fontSize: 9, textAlign: 'center', lineHeight: 13 },
```

- [ ] **Step 4: Commit**

```bash
git add ustal/screens/ProfileScreen.js
git commit -m "feat(achievements): новый UI — прогресс-бары, 5 групп, Ionicons вместо эмодзи"
```

---

### Task 6: HomeScreen — улучшения карточки психотеста

**Files:**
- Modify: `ustal/screens/HomeScreen.js`

- [ ] **Step 1: Заменить блок карточки психотеста**

Найти блок (строки 1058–1082):
```jsx
        {nextTestId && PSYCH_TESTS[nextTestId] ? (
          <TouchableOpacity
            style={styles.testPromptCard}
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
        ) : lastDoneTestId && PSYCH_TESTS[lastDoneTestId] ? (
          <View style={[styles.testPromptCard, styles.testPromptCardDone]}>
            <Ionicons name="checkmark-circle-outline" size={20} color="#5DAA72" />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.testPromptTitle}>{PSYCH_TESTS[lastDoneTestId].title}</Text>
              <Text style={[styles.testPromptSub, { color: '#5DAA72' }]}>Пройдено сегодня</Text>
            </View>
          </View>
        ) : null}
```

Заменить на:
```jsx
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
              onPress={() => Alert.alert('зачем тесты?', 'короткие вопросы — честные ответы. для себя: чтобы замечать то, что обычно не замечаешь. для приложения: чтобы оно лучше понимало тебя и показывало то, что сейчас нужно')}
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
              onPress={() => Alert.alert('зачем тесты?', 'короткие вопросы — честные ответы. для себя: чтобы замечать то, что обычно не замечаешь. для приложения: чтобы оно лучше понимало тебя и показывало то, что сейчас нужно')}
              hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
            >
              <Ionicons name="help-circle-outline" size={18} color={colors.muted} />
            </TouchableOpacity>
          </View>
        ) : null}
```

- [ ] **Step 2: Обновить стили testPromptCard**

Найти:
```js
  testPromptCard: {
    backgroundColor: colors.card, borderRadius: 16, padding: 16,
    flexDirection: 'row', alignItems: 'center', marginBottom: 16,
    borderWidth: 1, borderColor: colors.border,
  },
  testPromptCardDone: {
    backgroundColor: 'rgba(93, 170, 114, 0.12)',
    borderColor: 'rgba(93, 170, 114, 0.35)',
  },
  testPromptTitle: { fontSize: 15, fontWeight: '600', color: colors.white },
  testPromptSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
```

Заменить на:
```js
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
```

- [ ] **Step 3: Commit**

```bash
git add ustal/screens/HomeScreen.js
git commit -m "feat(home): ? кнопка и 'обновится завтра' на карточке психотеста"
```
