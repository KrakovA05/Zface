# Admin User Profile — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Дать администратору полный профиль любого пользователя с историей уровней, психометрикой, активностью и логом всех модераторских действий — плюс полный арсенал действий прямо с экрана.

**Architecture:** Новый экран `AdminUserProfileScreen` (Stack, поверх табов) доступен из любой точки где есть аватар/имя пользователя. Таблица `admin_actions` логирует каждое действие. Предупреждения идут через расширенную `moderation_notices` (новая колонка `type`).

**Tech Stack:** React Native + Expo, Supabase (PostgreSQL, RLS), React Navigation Stack

---

## Что меняется / создаётся

| Файл | Действие |
|------|----------|
| `supabase/migrations/011_admin_profile.sql` | Создать |
| `ustal/screens/AdminUserProfileScreen.js` | Создать |
| `ustal/App.js` | Добавить маршрут `AdminUserProfile` |
| `ustal/screens/AdminScreen.js` | Обновить точки входа |
| `ustal/screens/ChatScreen.js` | Добавить пункт «Профиль» в меню (только admin) |
| `ustal/screens/RoomsScreen.js` | То же |
| `ustal/screens/FeedScreen.js` | Тап на имя автора → AdminUserProfile для admin |
| `ustal/screens/PostScreen.js` | То же для комментариев |
| `ustal/screens/HomeScreen.js` | Заголовок modNotice меняется по `type` |

---

## База данных

### Таблица `admin_actions`

```sql
CREATE TABLE public.admin_actions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    UUID NOT NULL REFERENCES public.users(user_id) ON DELETE SET NULL,
  target_id   UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN ('ban','unban','warning','level_change','delete')),
  details     JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.admin_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_actions_admin_only" ON public.admin_actions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE user_id = auth.uid() AND is_admin = true)
  );
```

`details` содержит в зависимости от типа:
- `ban`: `{ banned_until, reason }`
- `unban`: `{}`
- `warning`: `{ message }`
- `level_change`: `{ old_level, new_level, reason }`
- `delete`: `{}`

### Расширение `moderation_notices`

```sql
ALTER TABLE public.moderation_notices
  ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'deletion'
    CHECK (type IN ('deletion', 'warning'));
```

### RPC `admin_delete_user`

```sql
CREATE OR REPLACE FUNCTION public.admin_delete_user(target_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users WHERE user_id = auth.uid() AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'not_admin';
  END IF;

  DELETE FROM public.users WHERE user_id = target_id;
  DELETE FROM auth.users WHERE id = target_id;
END;
$$;
```

---

## Экран `AdminUserProfileScreen`

### Props / Route params
```js
route.params = { userId: string }
```

### Загрузка данных (параллельно)
```js
const [profile, testHistory, metrics, actionLog, activityCounts] = await Promise.all([
  supabase.from('users').select('user_id, username, email, level, avatar_url, status, created_at, last_seen, banned_until, ban_reason').eq('user_id', userId).single(),
  supabase.from('test_results').select('level, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(8),
  supabase.from('user_metrics').select('*').eq('user_id', userId).order('week_start', { ascending: false }).limit(1).maybeSingle(),
  supabase.from('admin_actions').select('*').eq('target_id', userId).order('created_at', { ascending: false }).limit(20),
  Promise.all([
    supabase.from('feed_posts').select('id', { count: 'exact', head: true }).eq('author_id', userId),
    supabase.from('messages').select('id', { count: 'exact', head: true }).eq('sender_id', userId),
    supabase.from('post_comments').select('id', { count: 'exact', head: true }).eq('author_id', userId),
    supabase.from('reports').select('id', { count: 'exact', head: true }).eq('reported_user_id', userId),
  ]),
])
```

### Секции UI (сверху вниз)

**1. Шапка**
- Аватар (`Avatar` компонент), `@username`, уровень-бейдж с цветом
- Email, дата регистрации (`created_at`), последний визит (`last_seen`)
- Если `banned_until > now()` → красная плашка «Забанен до [дата] · [причина]»

**2. Активность** — 4 каунтера в ряд
- Постов, сообщений, комментариев, жалоб (из `activityCounts`)

**3. История уровней**
- Список последних 8 тестов: дата + уровень цветным текстом
- Пример: `"17 мая · red"`, `"10 мая · yellow"`

**4. Психометрика**
- Последняя запись `user_metrics`: anxiety_score, stress_score, apathy_score, loneliness_score — в виде строк `"Тревога: 72"`, `"Стресс: 58"` и т.д.
- Если нет данных → `"Психотесты не проходились"`

**5. История действий**
- Лента из `admin_actions`, каждая строка: дата + тип + детали
- Пример: `"03.06 — Предупреждение: «повторный спам»"`, `"12.05 — Бан до 19.05 (спам)"`
- Если пусто → `"Действий не было"`

**6. Sticky-панель действий** (прикреплена к низу экрана)
```
[Забанить]  [Предупреждение]  [Сменить уровень]  [Удалить аккаунт]
```

### Модал «Предупреждение»

```js
// При submit:
await supabase.from('moderation_notices').insert({
  user_id: userId,
  type: 'warning',
  text: warningText,
})
await supabase.from('admin_actions').insert({
  admin_id: store.userId,
  target_id: userId,
  action_type: 'warning',
  details: { message: warningText },
})
```

### Модал «Сменить уровень»

```js
// Три кнопки: green / yellow / red
await supabase.from('users').update({ level: newLevel }).eq('user_id', userId)
await supabase.from('admin_actions').insert({
  admin_id: store.userId,
  target_id: userId,
  action_type: 'level_change',
  details: { old_level: profile.level, new_level: newLevel },
})
```

### Удаление аккаунта

```js
// Двойной Alert, затем:
await supabase.rpc('admin_delete_user', { target_id: userId })
navigation.goBack()
```

### Бан/разбан

Использует существующий `BanModal`. После apply — INSERT в `admin_actions`:
```js
await supabase.from('admin_actions').insert({
  admin_id: store.userId,
  target_id: userId,
  action_type: bannedUntil ? 'ban' : 'unban',
  details: bannedUntil ? { banned_until: bannedUntil, reason } : {},
})
```

---

## Точки входа

### App.js
```jsx
<Stack.Screen name="AdminUserProfile" component={AdminUserProfileScreen} options={{ headerShown: false }} />
```

### AdminScreen — таб «Пользователи»
```js
// Заменить navigate('UserProfile', ...) на:
navigation.navigate('AdminUserProfile', { userId: item.user_id })
```

### AdminScreen — таб «Жалобы»
```jsx
// Добавить тап на имя нарушителя:
<TouchableOpacity onPress={() => navigation.navigate('AdminUserProfile', { userId: item.reported_user_id })}>
  <Text>@{item.reported?.username}</Text>
</TouchableOpacity>
```

### ChatScreen / RoomsScreen — меню сообщения
```jsx
// В ChatActionMenu или inline меню добавить пункт (только admin):
{store.isAdmin && (
  <TouchableOpacity onPress={() => navigation.navigate('AdminUserProfile', { userId: msg.sender_id })}>
    <Text>Профиль пользователя</Text>
  </TouchableOpacity>
)}
```

### FeedScreen / PostScreen — тап на имя автора
```js
// При тапе на имя/аватар автора:
const handleAuthorPress = (authorId) => {
  if (store.isAdmin) {
    navigation.navigate('AdminUserProfile', { userId: authorId })
  } else {
    navigation.navigate('UserProfile', { user: { user_id: authorId, ... } })
  }
}
```

### HomeScreen — заголовок modNotice
```jsx
// Читать type из modNotice:
<Text style={s.modTitle}>
  {modNotice?.type === 'warning' ? 'Предупреждение от модератора' : 'Сообщение удалено'}
</Text>
```

---

## RLS и безопасность

- `admin_actions`: только `is_admin = true` читает и пишет
- `admin_delete_user` RPC: проверяет `is_admin` внутри функции через `auth.uid()`
- Смена уровня: уже есть RLS UPDATE для admin на таблице `users`
- `moderation_notices`: admin INSERT, пользователь SELECT/UPDATE — уже настроено

---

## Что НЕ входит в скоп

- История DM-переписок пользователя (слишком инвазивно)
- IP/устройство (Supabase не хранит автоматически)
- Массовые действия (забанить всех с уровнем red)
