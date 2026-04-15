# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All commands run from `ustal/`:

```bash
npm start          # запуск Expo dev server (открыть в Expo Go на телефоне)
npm run ios        # запуск на iOS симуляторе
npm run android    # запуск на Android эмуляторе
```

Установка пакетов — **только через npm**, yarn не установлен:
```bash
npm install <package>
```

Для Expo-совместимых пакетов предпочтительно:
```bash
npx expo install <package> --npm
```

## Architecture

### Stack
- **React Native 0.81** + **Expo ~54** (Expo Go, New Architecture включена)
- **Supabase** — PostgreSQL + auth + realtime (postgres_changes)
- **React Navigation v7** — Stack + BottomTabs (вложенная навигация)
- **expo-av** — аудио (RelaxScreen)
- **expo-image-picker** — выбор фото для аватара

### Navigation structure
```
Stack.Navigator
  ├── Login / Register / Test / Recommendations   (auth flow + post-test, без хедера)
  ├── Main → Tab.Navigator
  │     ├── Home, Feed, Chat, Friends, Profile
  ├── DirectMessage      (личная переписка, поверх табов)
  ├── UserProfile        (профиль другого юзера, поверх табов)
  ├── Rooms              (комнаты по статусу, поверх табов)
  ├── Relax              (ambient звуки, поверх табов)
  ├── Fishing            (мини-игра рыбалка, поверх табов)
  └── Bar                (онлайн-бар, поверх табов)
```

`App.js` при старте вызывает `supabase.auth.getSession()` — если сессия активна, грузит профиль и идёт сразу на `Main`, иначе на `Login`.

После прохождения теста (TestScreen) навигация идёт на `Recommendations`, откуда на `Main`.

### Global state (`store.js`)
Простой мутируемый объект — **не реактивный**. Компоненты не ре-рендерятся при изменении store автоматически. Используется только для данных текущего пользователя:
```js
store = { username, email, level, userId, avatarUrl, status }
```
Поля заполняются при логине/регистрации и при восстановлении сессии в App.js. Для отображения актуальных данных в экранах с профилем используется `useFocusEffect`.

### Shared resources
- `constants.js` — `LABELS`, `LEVEL_COLORS`, `LEVEL_DATA`, `PHRASES`, `MOTIVATORS`
- `theme.js` — объект `colors` (все цвета приложения) + `shared` StyleSheet (переиспользуемые стили: кнопки, инпуты, ярлыки)
- `utils.js` — `getConversationId(uid1, uid2)` для стабильного ID личного чата
- `components/Avatar.js` — аватар с fallback на букву+цвет уровня

### Database schema (Supabase)

| Таблица | Ключевые поля | RLS |
|---------|--------------|-----|
| `users` | `user_id UUID`, `username`, `email`, `level`, `labels TEXT[]`, `status`, `avatar_url` | ✅ |
| `messages` | `id`, `username`, `text`, `level`, `created_at` — глобальный чат + комнаты + бар | ✅ |
| `direct_messages` | `id`, `conversation_id TEXT`, `sender_id UUID`, `sender_username`, `text`, `created_at` | ✅ |
| `friendships` | `id`, `requester_id UUID`, `receiver_id UUID`, `status ('pending'\|'accepted')` | ✅ |
| `test_results` | `id`, `user_id UUID`, `level TEXT`, `score INT`, `created_at` — история тестов | ✅ |
| `feed_posts` | `id`, `author_id UUID`, `author_username`, `author_level`, `text`, `target_levels TEXT[]`, `likes INT`, `created_at` | ✅ |

#### Использование таблицы `messages` для разных чатов
- Глобальный чат: `level = 'green' | 'yellow' | 'red'` (исторически, фильтруется по уровню)
- Комнаты по статусу (RoomsScreen): `level = 'green' | 'yellow' | 'red'`
- Бар (BarScreen): `level = 'bar_main' | 'bar_quiet' | 'bar_music' | 'bar_random'`

`conversation_id` = `[uid1, uid2].sort().join('_')` — всегда стабильный для пары юзеров.

Дружба однонаправленная в таблице: одна строка на заявку. `status='pending'` — заявка отправлена, `status='accepted'` — друзья. Для запроса "мои друзья" используется `.or('requester_id.eq.X,receiver_id.eq.X').eq('status','accepted')`.

### Realtime
- Глобальный чат: подписка на `INSERT` в `messages` (channel `global_messages`)
- Комнаты: подписка с фильтром `level=eq.${roomId}` в `messages` (channel `room_${roomId}`)
- Бар: подписка с фильтром `level=eq.bar_${tableId}` в `messages` (channel `bar_${tableId}`)
- Личные сообщения: подписка с фильтром `conversation_id=eq.${id}` в `direct_messages` (требует `REPLICA IDENTITY FULL` на таблице)

### Avatar storage
Аватары хранятся как base64 data URI прямо в `users.avatar_url`. Сжатие через `expo-image-picker` с `quality: 0.4, base64: true, aspect: [1,1]`.

### Уровни пользователей
`green` / `yellow` / `red` — определяются тестом (TestScreen), хранятся в `users.level` и `test_results`. Везде используются через `LEVEL_COLORS` и `LEVEL_DATA` из `constants.js`.

### Тест и рекомендации
- `TestScreen` — 10 вопросов, считает pessimistic ответы, определяет level, сохраняет в `users.level` и `test_results`
- После теста переход на `RecommendationsScreen` с `{ level }` параметром
- `RecommendationsScreen` — загружает историю тестов из `test_results`, показывает динамику (лучше/хуже/стабильно) и персональные рекомендации

### Новые экраны (добавлены в рамках MVP модернизации)
- `RecommendationsScreen` — персональные рекомендации после теста
- `FeedScreen` — лента постов с фильтром по уровню
- `RoomsScreen` — комнаты по статусу с realtime чатом
- `FishingScreen` — мини-игра рыбалка (успокаивающая активность)
- `BarScreen` — онлайн-бар с несколькими столиками и чатом
