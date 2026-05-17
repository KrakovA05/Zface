# AI Personalization & Proactivity Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Сделать @одного персонализированным (знает твоё состояние) и проактивным (пишет первым по расписанию и при важных событиях).

**Architecture:** Два независимых улучшения: (1) ai-chat Edge Function получает снапшот пользователя перед каждым ответом и вставляет его в system prompt; (2) новая Edge Function `ai-proactive` работает в двух режимах — плановый (pg_cron каждые 2 дня) и триггерный (DB webhook при смене уровня на red или критичном балле теста). Результат проактивного сообщения: пуш + запись в `ai_proactive_messages`, карточка на HomeScreen.

**Tech Stack:** Supabase Edge Functions (Deno), Gemini 2.5 Flash, pg_cron, Supabase DB Webhooks, React Native, Expo Push Notifications.

---

## Subsystem 1: Персонализация @одного

### Что меняется в `ai-chat/index.ts`

Перед построением сообщений для модели — один SQL-запрос:

```sql
SELECT
  u.level,
  u.current_focus,
  um.dominant_dimension,
  um.anxiety_score,
  um.burnout_score,
  um.stress_score,
  um.loneliness_score,
  (
    SELECT ROUND(AVG(score)::numeric, 1)
    FROM mood_checkins
    WHERE user_id = $1 AND created_at > NOW() - INTERVAL '7 days'
  ) AS mood_avg_7d,
  (
    SELECT score FROM mood_checkins
    WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1
  ) AS mood_last,
  (
    SELECT score FROM mood_checkins
    WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1 OFFSET 6
  ) AS mood_7d_ago
FROM users u
LEFT JOIN user_metrics um ON um.user_id = u.user_id
  AND um.week_start = DATE_TRUNC('week', NOW())::date
WHERE u.user_id = $1
```

Результат оборачивается в блок и вставляется в начало system prompt:

```
Контекст пользователя (не упоминай эти данные напрямую — используй для тона и понимания):
- Уровень: ${level} ${levelTrend}
- Доминирующее измерение: ${dominant_dimension ?? 'нет данных'} (${score}/100)
- Настроение за 7 дней: ${mood_7d_ago} → ${mood_last} (${moodTrend})
- Тревога: ${anxiety_score ?? '—'}/100 | Выгорание: ${burnout_score ?? '—'}/100
```

`levelTrend` и `moodTrend` — простые строки «↑ улучшается» / «↓ ухудшается» / «→ стабильно», считаются по сравнению с предыдущей неделей (`user_metrics` предыдущей недели) и по динамике mood_checkins.

**Правило для @одного** (добавить в system prompt):
```
Используй контекст молча — не цитируй цифры, не говори «я вижу что у тебя тревога».
Если уровень red или burnout > 65 — не давай советов пока не спросят, просто будь рядом.
Если настроение падает 3+ дня — не торопи с решениями.
```

---

## Subsystem 2: Проактивные сообщения

### Новая таблица `ai_proactive_messages`

```sql
CREATE TABLE ai_proactive_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('scheduled', 'triggered')),
  trigger_reason TEXT,  -- 'level_red', 'high_anxiety', 'high_burnout', 'scheduled'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ,
  push_sent BOOLEAN DEFAULT FALSE
);

CREATE INDEX ON ai_proactive_messages (user_id, read_at);
ALTER TABLE ai_proactive_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own" ON ai_proactive_messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users update own" ON ai_proactive_messages FOR UPDATE USING (auth.uid() = user_id);
```

### Edge Function `ai-proactive/index.ts`

**Определение режима:**
```ts
const triggerType = req.headers.get('x-trigger-type'); // 'cron' | 'webhook'
```

**Режим cron (плановый):**
- Берёт пользователей у которых: `last_login_date > NOW() - 7 days` AND нет записи в `ai_proactive_messages` за последние 2 дня
- Для каждого: тянет контекст, генерирует сообщение, вставляет в таблицу, шлёт пуш
- Максимум 50 пользователей за запуск (чтобы уложиться в timeout)

**Режим webhook (триггерный):**
- Payload: `{ record: { user_id, level } }` (из test_results) или `{ record: { user_id, test_id, normalized_score } }` (из psych_test_results)
- Проверки:
  - `test_results`: `record.level === 'red'` AND `old_record.level !== 'red'`
  - `psych_test_results`: `record.normalized_score > 70` AND `record.test_id IN ('gad7', 'olbi_short')`
- Проверка дедупликации: нет triggered-сообщения за последние 24 часа для этого юзера
- Генерирует и сразу отправляет

**Генерация сообщения (Gemini 2.5 Flash):**
```
System: Ты — @один, голос приложения для людей которым бывает плохо.
Напиши одно короткое сообщение (1-2 предложения) для пользователя.
Без советов, без клише, без "ты не один", без восклицательных знаков, без эмодзи.
Говори как живой человек который просто хотел написать.
Trigger: ${triggerReason} | Контекст: ${userContext}
```

**Примеры результата:**
- (scheduled, level red, настроение падает): «Просто хотел написать — как ты сейчас?»
- (triggered, high_anxiety): «Увидел результаты теста. Тревожных дней бывает много подряд.»
- (scheduled, всё стабильно): «Ты тут уже несколько недель. Это что-то значит.»

**Push notification:**
```ts
await sendPushNotification(pushToken, {
  title: '@один',
  body: text,
  data: { screen: 'AiChat', proactiveMessageId: messageId }
})
```

### Настройка триггеров

**pg_cron** (добавить в Supabase Dashboard → Database → Cron Jobs):
```sql
SELECT cron.schedule(
  'ai-proactive-scheduled',
  '0 10 */2 * *',  -- каждые 2 дня в 10:00
  $$SELECT net.http_post(
    url := 'https://yincycmdsdluueqsxtwn.supabase.co/functions/v1/ai-proactive',
    headers := '{"x-trigger-type":"cron","Authorization":"Bearer <CRON_SECRET>"}'::jsonb
  )$$
);
```

**DB Webhooks** (Supabase Dashboard → Database → Webhooks):
- Webhook 1: table `test_results`, event INSERT → POST `/functions/v1/ai-proactive` с header `x-trigger-type: webhook`
- Webhook 2: table `psych_test_results`, event INSERT → POST `/functions/v1/ai-proactive` с header `x-trigger-type: webhook`
- Оба требуют header `x-webhook-secret: <WEBHOOK_SECRET>`

### HomeScreen — карточка

В `loadData()` (useFocusEffect) добавить запрос:
```js
const { data: proactiveMsg } = await supabase
  .from('ai_proactive_messages')
  .select('id, text, created_at')
  .eq('user_id', store.userId)
  .is('read_at', null)
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle();
```

Карточка рендерится выше «фокуса дня», только если `proactiveMsg` не null:

```jsx
{proactiveMsg && (
  <TouchableOpacity onPress={handleProactiveMessageTap}>
    <View style={styles.proactiveCard}>
      <Text style={styles.proactiveLabel}>@один</Text>
      <Text style={styles.proactiveText}>{proactiveMsg.text}</Text>
    </View>
  </TouchableOpacity>
)}
```

Тап → `markProactiveRead(proactiveMsg.id)` → `navigation.navigate('AiChat', { initialMessage: proactiveMsg.text })`.

В AiChatScreen: если `route.params.initialMessage` — показать его как первое сообщение от @одного (без запроса к API, просто отображение).

---

## Файлы

| Файл | Изменение |
|------|-----------|
| `supabase/functions/ai-chat/index.ts` | Добавить fetchUserContext() + inject в system prompt |
| `supabase/functions/ai-proactive/index.ts` | Новый файл |
| `ustal/screens/HomeScreen.js` | Запрос + карточка proactiveMsg |
| `ustal/screens/AiChatScreen.js` | Принимать `initialMessage` из params |
| Supabase Dashboard | Миграция таблицы + cron job + 2 webhooks |

---

## Ограничения

- Проактивное сообщение не генерируется если у юзера нет push_token
- Не более 1 scheduled сообщения за 2 дня на пользователя
- Не более 1 triggered сообщения за 24 часа на пользователя (дедупликация)
- Контекст user_metrics может быть null (первая неделя) — graceful fallback на level only
