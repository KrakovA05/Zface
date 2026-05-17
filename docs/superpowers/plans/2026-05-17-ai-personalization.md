# AI Personalization & Proactivity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** @один знает состояние пользователя и пишет первым — по расписанию и при важных событиях.

**Architecture:** Два изменения: (1) `ai-chat` получает снапшот юзера из БД и вставляет в system prompt; (2) новая Edge Function `ai-proactive` + таблица `ai_proactive_messages` + карточка на HomeScreen + `initialMessage` param в AiChatScreen.

**Tech Stack:** Supabase Edge Functions (Deno), Groq (ai-chat), Gemini 2.5 Flash (ai-proactive), React Native, Expo Push API.

---

## Файлы

| Файл | Изменение |
|------|-----------|
| `supabase/functions/ai-chat/index.ts` | Расширить fetchUserContext + заменить system message |
| `supabase/functions/ai-proactive/index.ts` | Создать новый |
| `ustal/screens/HomeScreen.js` | Добавить state + query + карточку |
| `ustal/screens/AiChatScreen.js` | Принять `route` props + `initialMessage` |

---

## Task 1: Миграция БД — таблица ai_proactive_messages

**Files:**
- Supabase SQL migration (через Management API или Dashboard)

- [ ] **Step 1: Выполнить SQL-миграцию**

Запусти в Supabase Dashboard → SQL Editor или через MCP `execute_sql`:

```sql
CREATE TABLE IF NOT EXISTS ai_proactive_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('scheduled', 'triggered')),
  trigger_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ,
  push_sent BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_ai_proactive_user_unread
  ON ai_proactive_messages (user_id, read_at)
  WHERE read_at IS NULL;

ALTER TABLE ai_proactive_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own_proactive"
  ON ai_proactive_messages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users_update_own_proactive"
  ON ai_proactive_messages FOR UPDATE
  USING (auth.uid() = user_id);
```

- [ ] **Step 2: Проверить таблицу**

В SQL Editor:
```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'ai_proactive_messages'
ORDER BY ordinal_position;
```

Ожидаемый результат: 8 колонок — id, user_id, text, type, trigger_reason, created_at, read_at, push_sent.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(db): таблица ai_proactive_messages для проактивных сообщений ИИ"
```

---

## Task 2: Персонализация @одного — расширенный контекст в ai-chat

**Files:**
- Modify: `supabase/functions/ai-chat/index.ts`

### Контекст

В текущем файле строки 107–113 грузят только `users.level`. Строка 162 добавляет скудный system message: `Состояние пользователя: уровень ${userLevel}`.

Нужно:
1. Заменить запрос на расширенный (level + user_metrics + mood)
2. Заменить строку 162 на богатый контекстный блок

- [ ] **Step 1: Заменить блок загрузки профиля (строки 107–113)**

Найди и замени:
```typescript
// Загружаем профиль пользователя
const { data: profile } = await supabase
  .from('users')
  .select('level')
  .eq('user_id', userId)
  .single();

const userLevel = profile?.level || 'yellow';
```

На:
```typescript
// Загружаем расширенный профиль пользователя
const [{ data: profile }, { data: metrics }, { data: moods }] = await Promise.all([
  supabase.from('users').select('level').eq('user_id', userId).single(),
  supabase.from('user_metrics')
    .select('dominant_dimension, anxiety_score, burnout_score, stress_score, loneliness_score, composite_score')
    .eq('user_id', userId)
    .order('week_start', { ascending: false })
    .limit(1)
    .maybeSingle(),
  supabase.from('mood_checkins')
    .select('score, checkin_date')
    .eq('user_id', userId)
    .order('checkin_date', { ascending: false })
    .limit(7),
]);

const userLevel = profile?.level || 'yellow';

function buildUserContext(): string {
  const lines: string[] = [];
  lines.push(`Уровень: ${userLevel}`);

  if (metrics) {
    if (metrics.dominant_dimension) {
      const score = metrics[`${metrics.dominant_dimension}_score`] ?? metrics.composite_score;
      const dimLabel: Record<string, string> = {
        anxiety: 'тревога', stress: 'стресс', apathy: 'апатия',
        loneliness: 'одиночество', burnout: 'выгорание',
        self_esteem: 'самооценка', social_anxiety: 'соц. тревога', attachment: 'привязанность',
      };
      lines.push(`Доминирующее: ${dimLabel[metrics.dominant_dimension] ?? metrics.dominant_dimension} (${score ?? '?'}/100)`);
    }
    if (metrics.burnout_score != null && metrics.burnout_score > 65) {
      lines.push(`Выгорание: ${metrics.burnout_score}/100 (повышено)`);
    }
    if (metrics.anxiety_score != null && metrics.anxiety_score > 65) {
      lines.push(`Тревога: ${metrics.anxiety_score}/100 (повышена)`);
    }
  }

  if (moods && moods.length > 0) {
    const scores = moods.map((m: { score: number }) => m.score);
    const avg = (scores.reduce((a: number, b: number) => a + b, 0) / scores.length).toFixed(1);
    const oldest = scores[scores.length - 1];
    const newest = scores[0];
    const trend = newest > oldest + 1 ? '↑ улучшается' : newest < oldest - 1 ? '↓ ухудшается' : '→ стабильно';
    lines.push(`Настроение (7 дн): среднее ${avg}/10, ${trend}`);
  }

  return lines.join('\n');
}

const userContext = buildUserContext();
```

- [ ] **Step 2: Заменить скудный system message (строка 162)**

Найди:
```typescript
messages.push({ role: 'system', content: `Состояние пользователя: уровень ${userLevel}` });
```

Замени на:
```typescript
messages.push({
  role: 'system',
  content: `Контекст пользователя (используй для тона, не цитируй цифры вслух):
${userContext}

Правила тона:
- Если уровень red или burnout/тревога > 65 — не давай советов пока не попросят, просто будь рядом
- Если настроение падает — не торопи с решениями
- Никогда не говори "я вижу что у тебя тревога" или "по твоим данным"`
});
```

- [ ] **Step 3: Задеплоить и проверить**

```bash
SUPABASE_ACCESS_TOKEN=<SUPABASE_ACCESS_TOKEN> \
  npx supabase functions deploy ai-chat --project-ref yincycmdsdluueqsxtwn --no-verify-jwt
```

Ожидаемый вывод: `Deployed Functions on project yincycmdsdluueqsxtwn: ai-chat`

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/ai-chat/index.ts
git commit -m "feat(ai-chat): персонализированный контекст — уровень, метрики, настроение"
```

---

## Task 3: Edge Function ai-proactive

**Files:**
- Create: `supabase/functions/ai-proactive/index.ts`

- [ ] **Step 1: Создать файл**

Создай `supabase/functions/ai-proactive/index.ts` с содержимым:

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

async function callGemini(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 120, temperature: 0.9 },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text().then(t => t.slice(0, 200))}`);
  const data = await res.json();
  return data.candidates[0].content.parts[0].text.trim();
}

async function sendPush(token: string, text: string, messageId: string) {
  if (!token) return;
  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: token,
      title: '@один',
      body: text,
      sound: 'default',
      data: { screen: 'AiChat', proactiveMessageId: messageId },
    }),
  }).catch(() => {});
}

interface UserRow {
  user_id: string;
  level: string;
  push_token: string | null;
  current_focus: string | null;
}

interface MetricsRow {
  dominant_dimension: string | null;
  anxiety_score: number | null;
  burnout_score: number | null;
}

async function buildContext(userId: string, level: string): Promise<string> {
  const [{ data: metrics }, { data: moods }] = await Promise.all([
    supabase.from('user_metrics')
      .select('dominant_dimension, anxiety_score, burnout_score')
      .eq('user_id', userId)
      .order('week_start', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from('mood_checkins')
      .select('score')
      .eq('user_id', userId)
      .order('checkin_date', { ascending: false })
      .limit(7),
  ]);

  const m = metrics as MetricsRow | null;
  const parts: string[] = [`уровень ${level}`];

  if (m?.dominant_dimension) parts.push(`доминирует ${m.dominant_dimension}`);
  if (m?.burnout_score != null && m.burnout_score > 65) parts.push(`выгорание ${m.burnout_score}/100`);
  if (m?.anxiety_score != null && m.anxiety_score > 65) parts.push(`тревога ${m.anxiety_score}/100`);

  if (moods && moods.length >= 3) {
    const scores = (moods as { score: number }[]).map(x => x.score);
    const trend = scores[0] < scores[scores.length - 1] - 1 ? 'настроение падает' : 'настроение стабильно';
    parts.push(trend);
  }

  return parts.join(', ');
}

async function generateMessage(context: string, triggerReason: string): Promise<string> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const triggerHints: Record<string, string> = {
    level_red: 'Пользователь только что получил уровень red — ему сейчас очень плохо.',
    high_anxiety: 'Тест показал высокую тревогу.',
    high_burnout: 'Тест показал сильное выгорание.',
    scheduled: '',
  };

  const prompt = `Ты — @один, голос приложения !один для людей которым бывает плохо.
Напиши ОДНО короткое сообщение (1-2 предложения) пользователю. Это сообщение придёт ему как уведомление.
Правила: без советов, без "всё будет хорошо", без "ты не один", без эмодзи, без восклицательных знаков.
Говори как живой человек который просто решил написать — не как психолог и не как бот.
${triggerHints[triggerReason] || ''}
Контекст пользователя: ${context}
Ответь ТОЛЬКО текстом сообщения, без кавычек и пояснений.`;

  return callGemini(prompt, apiKey);
}

async function hasSentRecently(userId: string, type: 'scheduled' | 'triggered'): Promise<boolean> {
  const hours = type === 'scheduled' ? 48 : 24;
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from('ai_proactive_messages')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('type', type)
    .gte('created_at', since);
  return (count ?? 0) > 0;
}

async function sendProactiveMessage(
  user: UserRow,
  type: 'scheduled' | 'triggered',
  triggerReason: string,
) {
  if (await hasSentRecently(user.user_id, type)) return;

  const context = await buildContext(user.user_id, user.level);
  const text = await generateMessage(context, triggerReason);

  const { data: inserted } = await supabase
    .from('ai_proactive_messages')
    .insert({
      user_id: user.user_id,
      text,
      type,
      trigger_reason: triggerReason,
      push_sent: !!user.push_token,
    })
    .select('id')
    .single();

  if (user.push_token && inserted?.id) {
    await sendPush(user.push_token, text, inserted.id);
    await supabase.from('ai_proactive_messages')
      .update({ push_sent: true })
      .eq('id', inserted.id);
  }
}

Deno.serve(async (req: Request) => {
  const corsHeaders = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type, x-trigger-type, x-webhook-secret' } });
  }

  // Проверка авторизации
  const cronSecret = Deno.env.get('CRON_SECRET');
  const webhookSecret = Deno.env.get('WEBHOOK_SECRET');
  const triggerType = req.headers.get('x-trigger-type');
  const authHeader = req.headers.get('Authorization') || req.headers.get('x-webhook-secret') || '';

  if (triggerType === 'cron') {
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }
  } else if (triggerType === 'webhook') {
    if (!webhookSecret || authHeader !== webhookSecret) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }
  } else {
    return new Response(JSON.stringify({ error: 'Missing x-trigger-type header' }), { status: 400, headers: corsHeaders });
  }

  try {
    if (triggerType === 'cron') {
      // Плановый режим: берём активных пользователей без недавних сообщений
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: users } = await supabase
        .from('users')
        .select('user_id, level, push_token, current_focus')
        .gte('last_seen', sevenDaysAgo)
        .not('push_token', 'is', null)
        .limit(50);

      let sent = 0;
      for (const user of (users as UserRow[]) || []) {
        try {
          await sendProactiveMessage(user, 'scheduled', 'scheduled');
          sent++;
        } catch (e) {
          console.error(`Error for user ${user.user_id}:`, e);
        }
      }

      return new Response(JSON.stringify({ ok: true, sent }), { headers: corsHeaders });

    } else {
      // Webhook режим: реагируем на конкретное событие
      const payload = await req.json();
      const record = payload?.record;
      const oldRecord = payload?.old_record;

      if (!record?.user_id) {
        return new Response(JSON.stringify({ ok: true, skip: 'no user_id' }), { headers: corsHeaders });
      }

      const userId = record.user_id;

      // Определяем триггер
      let triggerReason: string | null = null;

      if (record.level === 'red' && oldRecord?.level && oldRecord.level !== 'red') {
        // test_results: уровень сменился на red
        triggerReason = 'level_red';
      } else if (record.normalized_score != null && record.test_id != null) {
        // psych_test_results: высокий балл
        if (record.normalized_score > 70 && record.test_id === 'gad7') {
          triggerReason = 'high_anxiety';
        } else if (record.normalized_score > 70 && record.test_id === 'olbi_short') {
          triggerReason = 'high_burnout';
        }
      }

      if (!triggerReason) {
        return new Response(JSON.stringify({ ok: true, skip: 'no trigger condition met' }), { headers: corsHeaders });
      }

      const { data: user } = await supabase
        .from('users')
        .select('user_id, level, push_token, current_focus')
        .eq('user_id', userId)
        .maybeSingle();

      if (!user || !user.push_token) {
        return new Response(JSON.stringify({ ok: true, skip: 'no push token' }), { headers: corsHeaders });
      }

      await sendProactiveMessage(user as UserRow, 'triggered', triggerReason);
      return new Response(JSON.stringify({ ok: true, triggered: triggerReason }), { headers: corsHeaders });
    }
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 500, headers: corsHeaders });
  }
});
```

- [ ] **Step 2: Задеплоить**

```bash
SUPABASE_ACCESS_TOKEN=<SUPABASE_ACCESS_TOKEN> \
  npx supabase functions deploy ai-proactive --project-ref yincycmdsdluueqsxtwn --no-verify-jwt
```

Ожидаемый вывод: `Deployed Functions on project yincycmdsdluueqsxtwn: ai-proactive`

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/ai-proactive/index.ts
git commit -m "feat(ai-proactive): Edge Function — плановые и триггерные сообщения от @одного"
```

---

## Task 4: HomeScreen — карточка проактивного сообщения

**Files:**
- Modify: `ustal/screens/HomeScreen.js`

### Контекст

`HomeScreen` использует `useFocusEffect` для загрузки данных (строки 227–397). Рендер карточки «фокуса дня» начинается на строке 669. Нужно добавить: state, запрос, карточку над фокусом, функцию пометки прочитанным.

- [ ] **Step 1: Добавить state переменную**

В блок state переменных (после строки 191, рядом с `nextTestId`):
```javascript
const [proactiveMsg, setProactiveMsg] = useState(null);
```

- [ ] **Step 2: Добавить запрос в loadData()**

В конец блока `if (user) { ... }` (перед строкой 390 `} catch (e)`), добавить:
```javascript
        // Проактивное сообщение от @одного
        const { data: proactive } = await supabase
          .from('ai_proactive_messages')
          .select('id, text, created_at')
          .eq('user_id', user.id)
          .is('read_at', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        setProactiveMsg(proactive || null);
```

- [ ] **Step 3: Добавить функцию markProactiveRead**

После функции `checkNavHint` (после строки 225), добавить:
```javascript
  const markProactiveRead = async (id) => {
    setProactiveMsg(null);
    await supabase
      .from('ai_proactive_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id);
  };
```

- [ ] **Step 4: Добавить карточку в JSX**

Перед блоком focusCard (строка 669, перед `{!loading && (hasUnreadLetter || ...`), вставить:
```jsx
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
```

- [ ] **Step 5: Добавить стили**

В StyleSheet (в конце, перед последней `}`):
```javascript
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
    borderLeftColor: colors.accent,
  },
  proactiveIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accent + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  proactiveLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.accent,
    marginBottom: 2,
  },
  proactiveText: {
    fontSize: 14,
    color: colors.white,
    lineHeight: 19,
  },
```

- [ ] **Step 6: Commit**

```bash
git add ustal/screens/HomeScreen.js
git commit -m "feat(home): карточка проактивного сообщения от @одного"
```

---

## Task 5: AiChatScreen — принимать initialMessage из params

**Files:**
- Modify: `ustal/screens/AiChatScreen.js`

### Контекст

AiChatScreen сейчас: `export default function AiChatScreen()` — без props. Он зарегистрирован как Tab.Screen в App.js, поэтому автоматически получает `{ route, navigation }` props. Нужно: принять `route`, прочитать `route.params?.initialMessage`, показать его как первое сообщение от @одного (без API-вызова).

- [ ] **Step 1: Добавить route в аргументы функции**

Найди:
```javascript
export default function AiChatScreen() {
```

Замени на:
```javascript
export default function AiChatScreen({ route }) {
```

- [ ] **Step 2: Считать initialMessage из params**

После строки `const messagesRef = useRef([]);` (строка ~80) добавить:
```javascript
  const initialMessage = route?.params?.initialMessage || null;
```

- [ ] **Step 3: Показать initialMessage после initSession**

В `initSession()`, после строки `setMessages(msgs || []);` (строка ~140) добавить:
```javascript
    // Если пришли с проактивным сообщением — показать его как первое
    if (initialMessage && (!msgs || msgs.length === 0)) {
      setMessages([{
        id: `proactive_${Date.now()}`,
        role: 'assistant',
        text: initialMessage,
        created_at: new Date().toISOString(),
      }]);
    }
```

- [ ] **Step 4: Commit**

```bash
git add ustal/screens/AiChatScreen.js
git commit -m "feat(ai-chat): принимать initialMessage из params для проактивных сообщений"
```

---

## Task 6: Настройка cron и webhooks в Supabase Dashboard

> Это ручные шаги в Supabase Dashboard — не код.

- [ ] **Step 1: Создать cron job**

Supabase Dashboard → Database → Cron Jobs → Create new job:

- Name: `ai-proactive-scheduled`
- Schedule: `0 10 */2 * *` (каждые 2 дня в 10:00 UTC)
- Command:
```sql
SELECT net.http_post(
  url := 'https://yincycmdsdluueqsxtwn.supabase.co/functions/v1/ai-proactive',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'x-trigger-type', 'cron',
    'Authorization', 'Bearer ' || current_setting('app.cron_secret', true)
  ),
  body := '{}'::jsonb
) AS request_id;
```

Если `app.cron_secret` не настроен — использовать значение `CRON_SECRET` из Supabase Secrets напрямую в строке.

- [ ] **Step 2: Создать webhook для test_results**

Dashboard → Database → Webhooks → Create new webhook:

- Name: `ai-proactive-level-change`
- Table: `test_results`
- Events: INSERT
- Type: HTTP Request
- URL: `https://yincycmdsdluueqsxtwn.supabase.co/functions/v1/ai-proactive`
- Headers:
  - `Content-Type: application/json`
  - `x-trigger-type: webhook`
  - `x-webhook-secret: <значение WEBHOOK_SECRET из Supabase Secrets>`

- [ ] **Step 3: Создать webhook для psych_test_results**

Тот же процесс:

- Name: `ai-proactive-psych-result`
- Table: `psych_test_results`
- Events: INSERT
- URL: `https://yincycmdsdluueqsxtwn.supabase.co/functions/v1/ai-proactive`
- Headers: те же что в Step 2

- [ ] **Step 4: Финальный commit**

```bash
git add -A
git commit -m "feat(ai): персонализация @одного + проактивные сообщения — реализация завершена"
```

---

## Проверка конца-в-конец

1. Вызвать `ai-proactive` вручную для тестового пользователя:
```bash
curl -X POST https://yincycmdsdluueqsxtwn.supabase.co/functions/v1/ai-proactive \
  -H "x-trigger-type: cron" \
  -H "Authorization: Bearer <CRON_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{}'
```
Ожидаемый ответ: `{"ok":true,"sent":N}`

2. В приложении: открыть HomeScreen → карточка должна появиться если есть непрочитанное сообщение
3. Тапнуть по карточке → AiChatScreen открывается с текстом сообщения как первым ответом от @одного
4. Написать что-нибудь @одному → проверить что ответы изменились (более контекстные) через Supabase logs

---

## Порядок зависимостей

```
Task 1 (DB) → Task 3 (ai-proactive) → Task 4 (HomeScreen)
Task 2 (ai-chat) — независимый
Task 5 (AiChatScreen) — независимый
Task 6 (cron/webhooks) — после Task 3
```

Tasks 2, 4, 5 можно делать параллельно после Task 1.
