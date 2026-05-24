# Analytics Insights Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить раздел «Паттерны» в AnalyticsScreen — до 3 автоматически вычисленных инсайтов на основе математических корреляций пользовательских данных, Premium-гейтированных.

**Architecture:** Новый pure-утилит `computeInsights.js` принимает данные и возвращает массив строк. AnalyticsScreen расширяет запросы (mood 28 дней, счётчик сообщений по неделям) и рендерит `InsightsSection` с Premium-gate через `store.isPremium`.

**Tech Stack:** React Native, Supabase JS client, нет новых пакетов.

---

## Структура файлов

| Файл | Действие |
|------|----------|
| `ustal/store.js` | Добавить поле `isPremium: false` + обновить `clearStore` |
| `ustal/utils/computeInsights.js` | Создать — вся математика, pure function |
| `ustal/screens/AnalyticsScreen.js` | Расширить mood-запрос до 28 дней, добавить запрос messages, добавить InsightsSection |

---

## Task 1: Добавить isPremium в store

**Files:**
- Modify: `ustal/store.js`

- [ ] **Шаг 1: Обновить store.js**

Открыть `ustal/store.js`. Текущее содержимое:
```js
export const store = {
  username: '',
  email: '',
  level: 'green',
  userId: '',
  avatarUrl: '',
  status: '',
  goal: '',
  isAdmin: false,
  referralDiscountPct: 0,
};

export function clearStore() {
  store.username = '';
  store.email = '';
  store.level = 'green';
  store.userId = '';
  store.avatarUrl = '';
  store.status = '';
  store.goal = '';
  store.isAdmin = false;
  store.referralDiscountPct = 0;
  store.refreshBadges = undefined;
}
```

Заменить на:
```js
export const store = {
  username: '',
  email: '',
  level: 'green',
  userId: '',
  avatarUrl: '',
  status: '',
  goal: '',
  isAdmin: false,
  referralDiscountPct: 0,
  isPremium: false,
};

export function clearStore() {
  store.username = '';
  store.email = '';
  store.level = 'green';
  store.userId = '';
  store.avatarUrl = '';
  store.status = '';
  store.goal = '';
  store.isAdmin = false;
  store.referralDiscountPct = 0;
  store.refreshBadges = undefined;
  store.isPremium = false;
}
```

- [ ] **Шаг 2: Проверить**

Запустить `npm start` из `ustal/`, убедиться что приложение стартует без ошибок.

- [ ] **Шаг 3: Коммит**

```bash
git add ustal/store.js
git commit -m "feat(store): добавлено поле isPremium"
```

---

## Task 2: Создать computeInsights.js

**Files:**
- Create: `ustal/utils/computeInsights.js`

- [ ] **Шаг 1: Создать файл**

Создать `ustal/utils/computeInsights.js` со следующим содержимым:

```js
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

const DIMENSIONS = [
  'anxiety', 'stress', 'apathy', 'loneliness',
  'burnout', 'self_esteem', 'social_anxiety', 'attachment',
];

function avg(arr) {
  const valid = arr.filter(v => v !== null && v !== undefined);
  if (!valid.length) return null;
  return valid.reduce((s, v) => s + v, 0) / valid.length;
}

function median(arr) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Возвращает дату понедельника недели для строки вида '2026-05-24' или ISO timestamp
function weekKey(dateStr) {
  const d = new Date(dateStr);
  const day = d.getDay(); // 0=вс, 1=пн...
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

/**
 * Вычисляет до 3 инсайтов на основе данных пользователя.
 *
 * @param {Object} params
 * @param {Array}  params.metricsHistory  — [{week_start, composite_score, anxiety_score, ...}] ASC
 * @param {Array}  params.moodHistory28   — [{checkin_date, score}] за последние 28 дней
 * @param {Array}  params.messageCounts   — [{week, cnt}] за последние 8 недель
 * @returns {string[]} — 0–3 готовых строки инсайтов
 */
export function computeInsights({ metricsHistory, moodHistory28, messageCounts }) {
  const candidates = []; // { text: string, delta: number }

  // ── Паттерн 1: тренд измерения за последний месяц ──────────────────────────
  // Сравниваем последние 4 недели с предыдущими 4 (нужно ≥ 8 снапшотов).
  // Берём только то измерение, у которого abs(delta) максимален.
  if (metricsHistory.length >= 8) {
    const last4 = metricsHistory.slice(-4);
    const prev4 = metricsHistory.slice(-8, -4);
    let maxAbsDelta = 0;
    let bestInsight = null;

    for (const dim of DIMENSIONS) {
      const key = `${dim}_score`;
      const recentAvg = avg(last4.map(m => m[key]));
      const prevAvg   = avg(prev4.map(m => m[key]));
      if (recentAvg === null || prevAvg === null) continue;
      const delta    = Math.round(recentAvg - prevAvg);
      const absDelta = Math.abs(delta);
      if (absDelta < 8) continue;
      if (absDelta > maxAbsDelta) {
        maxAbsDelta = absDelta;
        const label = DIMENSION_LABELS[dim];
        bestInsight = delta < 0
          ? { text: `${label} снизилась на ${absDelta} пунктов за последний месяц — динамика положительная.`, delta: absDelta }
          : { text: `${label} выросла на ${absDelta} пунктов за последний месяц — стоит обратить внимание.`, delta: absDelta };
      }
    }
    if (bestInsight) candidates.push(bestInsight);
  }

  // ── Паттерн 2: активность в чатах и одиночество ────────────────────────────
  // Сопоставляем недели по счётчику сообщений с loneliness_score той же недели.
  // Нужно ≥ 4 пары. Делим на «выше медианы» и «ниже», сравниваем средние.
  if (messageCounts.length >= 4 && metricsHistory.length >= 4) {
    const pairs = [];
    for (const mc of messageCounts) {
      const match = metricsHistory.find(m => weekKey(m.week_start) === mc.week);
      if (
        match &&
        match.loneliness_score !== null &&
        match.loneliness_score !== undefined
      ) {
        pairs.push({ count: mc.cnt, score: match.loneliness_score });
      }
    }
    if (pairs.length >= 4) {
      const med         = median(pairs.map(p => p.count));
      const highAct     = pairs.filter(p => p.count > med);
      const lowAct      = pairs.filter(p => p.count <= med);
      const highLone    = avg(highAct.map(p => p.score));
      const lowLone     = avg(lowAct.map(p => p.score));
      if (highLone !== null && lowLone !== null) {
        const diff = Math.round(lowLone - highLone);
        if (diff >= 8) {
          candidates.push({
            text: `В недели когда ты больше общаешься, одиночество ниже — разница ${diff} пунктов.`,
            delta: diff,
          });
        }
      }
    }
  }

  // ── Паттерн 3: настроение в выходные vs будни ───────────────────────────────
  // Нужно ≥ 5 будних и ≥ 2 выходных чекина за 28 дней.
  if (moodHistory28.length >= 7) {
    const weekdayScores = moodHistory28
      .filter(m => { const d = new Date(m.checkin_date).getDay(); return d >= 1 && d <= 5; })
      .map(m => m.score);
    const weekendScores = moodHistory28
      .filter(m => { const d = new Date(m.checkin_date).getDay(); return d === 0 || d === 6; })
      .map(m => m.score);

    if (weekdayScores.length >= 5 && weekendScores.length >= 2) {
      const wdAvg = avg(weekdayScores);
      const weAvg = avg(weekendScores);
      const diff  = weAvg - wdAvg;
      if (diff >= 1.5) {
        candidates.push({
          text:  `В выходные настроение обычно выше — в среднем на ${diff.toFixed(1)} балла.`,
          delta: diff,
        });
      } else if (diff <= -1.5) {
        candidates.push({
          text:  `В выходные настроение ниже, чем в будни — в среднем на ${Math.abs(diff).toFixed(1)} балла.`,
          delta: Math.abs(diff),
        });
      }
    }
  }

  // ── Паттерн 4: общий прогресс с начала использования ───────────────────────
  // Сравниваем composite_score первой и последней записи (нужно ≥ 4 снапшота).
  if (metricsHistory.length >= 4) {
    const first = metricsHistory[0].composite_score;
    const last  = metricsHistory[metricsHistory.length - 1].composite_score;
    if (first !== null && first !== undefined && last !== null && last !== undefined) {
      const delta = Math.round(last - first);
      if (delta <= -10) {
        candidates.push({
          text:  `С начала использования общий индекс снизился на ${Math.abs(delta)} — это положительная динамика.`,
          delta: Math.abs(delta),
        });
      } else if (delta >= 10) {
        candidates.push({
          text:  `Общий индекс вырос на ${delta} с начала использования.`,
          delta,
        });
      }
    }
  }

  // Сортируем по убыванию delta, возвращаем не более 3
  return candidates
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 3)
    .map(c => c.text);
}
```

- [ ] **Шаг 2: Проверить что модуль импортируется**

В `ustal/` запустить `npm start`, открыть любой экран в Expo Go — если нет ошибки импорта, всё хорошо. Ошибки будут только в консоли Metro.

- [ ] **Шаг 3: Коммит**

```bash
git add ustal/utils/computeInsights.js
git commit -m "feat(аналитика): утилит computeInsights — 4 математических паттерна"
```

---

## Task 3: Расширить загрузку данных в AnalyticsScreen

**Files:**
- Modify: `ustal/screens/AnalyticsScreen.js`

Нужно:
1. Добавить импорт `computeInsights`
2. Добавить state `messageCounts`
3. Расширить mood-запрос с 7 до 28 дней (та же переменная `moodRows`)
4. Добавить запрос сообщений за 8 недель
5. Сгруппировать сообщения по неделям в JS
6. Сохранить `messageCounts` в state

- [ ] **Шаг 1: Добавить импорт computeInsights**

В начало файла `ustal/screens/AnalyticsScreen.js` после строки:
```js
import { computeLiveProfile } from '../utils/computeLiveProfile';
```
добавить:
```js
import { computeInsights } from '../utils/computeInsights';
```

- [ ] **Шаг 2: Добавить хелпер weekKey и state messageCounts**

Сразу после строки `const LEVEL_COLORS = ...` (около строки 41) добавить:
```js
function weekKey(dateStr) {
  const d = new Date(dateStr);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}
```

В теле компонента `AnalyticsScreen` после строки:
```js
const [exporting, setExporting] = useState(false);
```
добавить:
```js
const [messageCounts, setMessageCounts] = useState([]);
```

- [ ] **Шаг 3: Расширить mood-запрос до 28 дней**

В `Promise.all` найти блок mood-запроса (строки ~680–686):
```js
supabase
  .from('mood_checkins')
  .select('score, checkin_date')
  .eq('user_id', uid)
  .gte('checkin_date', (() => {
    const d = new Date(); d.setDate(d.getDate() - 6);
    return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-');
  })())
  .order('checkin_date', { ascending: true }),
```

Заменить на (изменяем только `-6` на `-27`):
```js
supabase
  .from('mood_checkins')
  .select('score, checkin_date')
  .eq('user_id', uid)
  .gte('checkin_date', (() => {
    const d = new Date(); d.setDate(d.getDate() - 27);
    return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-');
  })())
  .order('checkin_date', { ascending: true }),
```

- [ ] **Шаг 4: Добавить запрос сообщений в Promise.all**

В `Promise.all` после строки:
```js
supabase.from('users').select('user_id', { count: 'exact', head: true }).eq('referred_by', uid),
```
добавить (запятая уже есть в конце предыдущей строки):
```js
supabase
  .from('messages')
  .select('created_at')
  .eq('sender_id', uid)
  .gte('created_at', (() => {
    const d = new Date(); d.setDate(d.getDate() - 56);
    return d.toISOString();
  })()),
```

- [ ] **Шаг 5: Добавить деструктуризацию msgRows**

Обновить деструктуризацию `Promise.all`. Найти:
```js
      { count: invitedCount },
      ] = await Promise.all([
```
Заменить на:
```js
      { count: invitedCount },
      { data: msgRows },
      ] = await Promise.all([
```

- [ ] **Шаг 6: Группировать сообщения по неделям и сохранить в state**

После строки `setAllPsychRows(psychRows || []);` добавить:
```js
      const msgCountMap = {};
      for (const msg of msgRows || []) {
        const wk = weekKey(msg.created_at);
        msgCountMap[wk] = (msgCountMap[wk] || 0) + 1;
      }
      const msgCounts = Object.entries(msgCountMap)
        .map(([week, cnt]) => ({ week, cnt }))
        .sort((a, b) => b.week.localeCompare(a.week))
        .slice(0, 8);
      setMessageCounts(msgCounts);
```

- [ ] **Шаг 7: Проверить**

Запустить `npm start`, открыть AnalyticsScreen — экран должен грузиться без ошибок.

- [ ] **Шаг 8: Коммит**

```bash
git add ustal/screens/AnalyticsScreen.js
git commit -m "feat(аналитика): расширен запрос mood до 28 дней, добавлен счётчик сообщений по неделям"
```

---

## Task 4: Добавить InsightsSection в AnalyticsScreen

**Files:**
- Modify: `ustal/screens/AnalyticsScreen.js`

- [ ] **Шаг 1: Добавить компонент InsightsSection**

В `ustal/screens/AnalyticsScreen.js` после функции `ActivitySection` (около строки 419), перед строкой `// ─── PDF-генерация`, добавить:

```js
// Секция 6: Паттерны (Premium)
function InsightsSection({ metricsHistory, moodHistory28, messageCounts }) {
  if (!store.isPremium) {
    return (
      <SectionCard title="Паттерны">
        <View style={styles.insightsLocked}>
          <Ionicons name="lock-closed-outline" size={20} color="#A09080" />
          <Text style={styles.insightsLockedTitle}>Доступно в Premium</Text>
          <Text style={styles.insightsLockedExample}>
            Например: «В недели когда ты больше общаешься, одиночество ниже на 14 пунктов»
          </Text>
        </View>
      </SectionCard>
    );
  }

  const insights = computeInsights({ metricsHistory, moodHistory28, messageCounts });

  return (
    <SectionCard title="Паттерны">
      {insights.length === 0 ? (
        <Text style={styles.emptyText}>
          {metricsHistory.length >= 4
            ? 'Паттернов пока не обнаружено — продолжай пользоваться'
            : 'Появятся через несколько недель использования'}
        </Text>
      ) : (
        insights.map((text, i) => (
          <View key={i} style={[styles.insightRow, i > 0 && styles.insightRowBorder]}>
            <View style={styles.insightDot} />
            <Text style={styles.insightText}>{text}</Text>
          </View>
        ))
      )}
    </SectionCard>
  );
}
```

- [ ] **Шаг 2: Добавить стили InsightsSection**

В объект `StyleSheet.create(...)` добавить после последнего стиля (перед закрывающей `}`):

```js
  insightsLocked: {
    alignItems: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  insightsLockedTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#A09080',
  },
  insightsLockedExample: {
    fontSize: 12,
    color: '#A09080',
    textAlign: 'center',
    lineHeight: 18,
    opacity: 0.8,
    paddingHorizontal: 8,
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    gap: 10,
  },
  insightRowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E8DFD0',
  },
  insightDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#BC8A72',
    marginTop: 7,
    flexShrink: 0,
  },
  insightText: {
    flex: 1,
    fontSize: 14,
    color: '#2C2420',
    lineHeight: 20,
  },
```

- [ ] **Шаг 3: Вставить InsightsSection в JSX**

В `return` компонента `AnalyticsScreen` найти:
```jsx
          <TrendSection metricsHistory={metricsHistory} />
          <ActivitySection userActivity={userActivity} />
```

Заменить на:
```jsx
          <TrendSection metricsHistory={metricsHistory} />
          <InsightsSection
            metricsHistory={metricsHistory}
            moodHistory28={moodHistory}
            messageCounts={messageCounts}
          />
          <ActivitySection userActivity={userActivity} />
```

- [ ] **Шаг 4: Проверить бесплатный режим**

`store.isPremium` сейчас `false` (дефолт). Открыть AnalyticsScreen — должна появиться карточка «Паттерны» с замком и текстом «Доступно в Premium».

- [ ] **Шаг 5: Проверить Premium-режим**

Временно в консоли Expo или через отладчик выставить `store.isPremium = true`, перейти в AnalyticsScreen. Если данных < 4 недель — «Появятся через несколько недель использования». Если есть данные — инсайты.

- [ ] **Шаг 6: Коммит**

```bash
git add ustal/screens/AnalyticsScreen.js
git commit -m "feat(аналитика): раздел Паттерны — математические инсайты, Premium-гейт"
```

---

## Self-Review

**Spec coverage:**
- ✅ Паттерн 1 (тренд измерения) — Task 2
- ✅ Паттерн 2 (чат → одиночество) — Task 2 + Task 3
- ✅ Паттерн 3 (выходные vs будни) — Task 2 + Task 3
- ✅ Паттерн 4 (общий прогресс) — Task 2
- ✅ Минимум 4 недели данных — проверка в `computeInsights` + в `InsightsSection`
- ✅ Максимум 3 инсайта — `.slice(0, 3)` в `computeInsights`
- ✅ Конкретные числа в тексте — все строки содержат interpolated delta
- ✅ Premium-gate с замком — Task 4 шаг 1
- ✅ Заглушки (нет данных / нет паттернов) — Task 4 шаг 1
- ✅ `store.isPremium` — Task 1
- ✅ Mood 28 дней — Task 3 шаг 3
- ✅ Счётчик сообщений по неделям — Task 3 шаги 4–6

**Placeholder scan:** нет TBD, все шаги содержат код.

**Type consistency:** `computeInsights` принимает `{ metricsHistory, moodHistory28, messageCounts }` — передаётся как `moodHistory28={moodHistory}` из screen (state называется `moodHistory`, это нормально). `messageCounts` — `[{week, cnt}]` — совпадает везде.
