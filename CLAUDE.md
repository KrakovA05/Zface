# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## О проекте — Zface

**Zface** — мобильное приложение для людей с плохим ментальным состоянием. Идея: «найди своих» — людей, которым сейчас так же плохо, как тебе. Не терапия, не позитивный коучинг — честное сообщество.

### Концепция
- Пользователь проходит тест из 10 вопросов → получает **уровень**: `green` (норм), `yellow` (тяжеловато), `red` (совсем плохо)
- Уровень определяет, с кем ты общаешься: комнаты, лента, рекомендации — всё фильтруется по уровню
- Аватар и цвет никнейма везде отображают уровень пользователя — визуальный язык состояния

### Основные экраны
- **HomeScreen** — статус-карточка уровня, динамика изменений, кнопки «Пройти тест» / «Рекомендации», вопрос дня (`daily_answers`), «Одно слово дня» (`daily_word_taps`), динамика сообщества, сетка модулей, график истории тестов, напоминание если прошло >3 дней
- **FeedScreen** — лента постов с фильтром по уровню, создание поста (свой уровень / все), лайки, комментарии
- **MessagesScreen** — две вкладки: «Чаты» (общий чат, комнаты по уровню) и «Личные» (DM с друзьями), бейджи непрочитанных
- **FriendsScreen** — поиск по никнейму, поиск по ярлыкам, заявки в друзья (входящие/исходящие), список друзей, кнопка DM
- **ProfileScreen** — аватар (base64, редактируемый), статус (редактируемый), уровень, мотиватор дня, достижения (8 ачивок), свитч «Показывать динамику», выход, удаление аккаунта, приглашение друга через Share API
- **ChatScreen** — глобальный чат (все уровни вместе), realtime, удаление своих сообщений, timestamp
- **RoomsScreen** — комнаты по уровню, только своя доступна, realtime чат, список участников + анонимные наблюдатели (Presence), тап аватара → профиль, timestamp
- **DirectMessageScreen** — личная переписка, блокировка проверяется перед отправкой, тап аватара → профиль, timestamp
- **PostScreen** — комментарии к посту ленты, realtime, удаление своих комментариев
- **ThoughtsScreen** — анонимная мысль дня (1 раз в сутки), реакции «я понимаю / я тоже / держись», счётчики реакций других
- **ResourcesScreen** — психологические материалы: 5 тем (тревога, депрессия, выгорание, одиночество, самооценка), аккордеон с анимацией, реальные ссылки на YouTube и b17.ru/psychologies.ru через `Linking.openURL()`
- **UserProfileScreen** — профиль другого пользователя: добавить в друзья / принять / отклонить / удалить, DM, блокировка, жалоба, динамика уровня (если `show_history = true`)
- **BreathingScreen** — коробочное дыхание 4-4-4-4, Animated-анимация круга, фазы вдох/задержка/выдох/пауза
- **FishingScreen** — мини-игра «рыбалка» как медитативная активность; математически прорисованная удочка (seg-helper через atan2), float с анимацией, 14 рыб с временно́й привязкой, «Записка в бутылке»
- **TestScreen** — тест из 10 вопросов, определяет уровень, один раз в 24 часа
- **RecommendationsScreen** — персональные рекомендации после теста, динамика уровня (лучше/хуже/стабильно)
- **OnboardingMomentScreen** — после первого теста показывает: сколько человек с тем же уровнем + один анонимный ответ на вопрос дня

> **BarScreen.js** — файл существует, но экран удалён из навигации и Home. Не использовать.

### Целевая аудитория
Люди 16–30 лет, которым бывает плохо и которые хотят найти других таких же — без лишних слов и фальши.

### Текущий статус
MVP+. Функционал: авторизация с подтверждением email, тест (1 раз в 24ч), лента с комментариями, чаты (глобальный/комнаты), DM, друзья, блокировки, жалобы, достижения, вопрос дня, слово дня, анонимные мысли + реакции, дыхание, рыбалка, рекомендации, онбординг, психологические материалы, проактивные пуши, push-уведомления по DM и заявкам.

### Роадмап
Запланированные фичи и задачи перед релизом — в файле **[ROADMAP.md](ROADMAP.md)**.
Клод обновляет его самостоятельно, но **всегда спрашивает перед добавлением нового пункта**.

---

## Git — обязательные правила

- **После каждого масштабного изменения** (новый экран, изменение БД, новая фича, рефакторинг) — пушить в GitHub только после подтверждения пользователя:
```bash
git add .
git commit -m "описание изменений"
git push origin main
```
- Репозиторий: `https://github.com/KrakovA05/Zface`
- Не накапливать изменения — пушить сразу после подтверждения.
- **Все commit message писать на русском языке** — соавтор читает историю коммитов на GitHub и должен понимать что было сделано.

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
- **expo-image-picker** — выбор фото для аватара (base64, quality 0.4)

### Navigation structure
```
Stack.Navigator
  ├── Login / Register / EmailConfirm          (auth flow, без хедера)
  ├── Test / Recommendations / OnboardingMoment (post-test flow, без хедера)
  ├── Main → Tab.Navigator (CustomTabBar — floating pill)
  │     ├── Home, Feed, Messages, Friends, Profile
  ├── DirectMessage      (личная переписка, поверх табов)
  ├── UserProfile        (профиль другого юзера, поверх табов)
  ├── Rooms              (комнаты по уровню, поверх табов)
  ├── Chat               (глобальный чат, поверх табов)
  ├── Post               (комментарии к посту, поверх табов)
  ├── Thoughts           (анонимные мысли, поверх табов)
  ├── Resources          (психологические материалы, поверх табов)
  ├── Breathing          (дыхательные упражнения, поверх табов)
  └── Fishing            (мини-игра рыбалка, поверх табов)
```

`App.js` при старте вызывает `supabase.auth.getSession()` — если сессия активна, грузит профиль и идёт сразу на `Main`, иначе на `Login`.

После прохождения теста (TestScreen) → `Recommendations` → `OnboardingMoment` (только первый раз) → `Main`.

### Global state (`store.js`)
Простой мутируемый объект — **не реактивный**. Компоненты не ре-рендерятся при изменении store автоматически. Используется только для данных текущего пользователя:
```js
store = { username, email, level, userId, avatarUrl, status }
```
Поля заполняются при логине/регистрации и при восстановлении сессии в App.js. Для отображения актуальных данных в экранах с профилем используется `useFocusEffect`.

### Shared resources
- `constants.js` — `LABELS`, `LEVEL_COLORS`, `LEVEL_DATA`, `PHRASES`, `MOTIVATORS`, `DAILY_QUESTIONS`, `ACHIEVEMENTS`, `WORDS_OF_DAY`
- `theme.js` — объект `colors` (все цвета приложения) + `shared` StyleSheet (переиспользуемые стили: кнопки, инпуты, ярлыки)
- `utils.js` — `getConversationId(uid1, uid2)` для стабильного ID личного чата
- `components/Avatar.js` — аватар с fallback на букву+цвет уровня

### Database schema (Supabase)

| Таблица | Ключевые поля | RLS |
|---------|--------------|-----|
| `users` | `user_id UUID`, `username`, `email`, `level`, `labels TEXT[]`, `status`, `avatar_url`, `last_seen`, `show_history BOOL` | ✅ |
| `messages` | `id`, `username`, `text`, `level`, `created_at`, `sender_id` — глобальный чат + комнаты | ✅ |
| `direct_messages` | `id`, `conversation_id TEXT`, `sender_id UUID`, `sender_username`, `text`, `created_at` | ✅ |
| `friendships` | `id`, `requester_id UUID`, `receiver_id UUID`, `status ('pending'\|'accepted')` | ✅ |
| `test_results` | `id`, `user_id UUID`, `level TEXT`, `score INT`, `created_at` — история тестов | ✅ |
| `feed_posts` | `id`, `author_id UUID`, `author_username`, `author_level`, `text`, `target_levels TEXT[]`, `likes INT`, `created_at` | ✅ |
| `post_comments` | `id`, `post_id UUID`, `author_id UUID`, `author_username`, `author_level`, `text`, `created_at` | ✅ |
| `daily_answers` | `id`, `user_id UUID`, `question_date DATE`, `question_text`, `answer`, `created_at` | ✅ |
| `daily_word_taps` | `id`, `user_id UUID`, `word_date DATE`, `word TEXT`, `reaction TEXT`, `created_at` | ✅ |
| `anonymous_thoughts` | `id`, `user_id UUID`, `thought_date DATE`, `text`, `created_at` | ✅ |
| `thought_reactions` | `id`, `thought_id UUID`, `user_id UUID`, `reaction TEXT ('понимаю'\|'тоже'\|'держись')`, `created_at` | ✅ |
| `user_achievements` | `id`, `user_id UUID`, `achievement_id TEXT`, `created_at` | ✅ |
| `blocks` | `id`, `blocker_id UUID`, `blocked_id UUID` | ✅ |
| `reports` | `id`, `reporter_id UUID`, `reported_user_id UUID`, `reason TEXT` | ✅ |

#### Использование таблицы `messages` для разных чатов
- Глобальный чат: `level = 'global'`
- Комнаты по статусу (RoomsScreen): `level = 'green' | 'yellow' | 'red'`

`conversation_id` = `[uid1, uid2].sort().join('_')` — всегда стабильный для пары юзеров.

Дружба однонаправленная в таблице: одна строка на заявку. `status='pending'` — заявка отправлена, `status='accepted'` — друзья. Для запроса "мои друзья" используется `.or('requester_id.eq.X,receiver_id.eq.X').eq('status','accepted')`.

#### Удаление аккаунта
Реализовано через Postgres-функцию `delete_user()` с `SECURITY DEFINER` — удаляет `public.users`, затем `auth.users`. Вызывается через `supabase.rpc('delete_user')`.

### Realtime
- Глобальный чат: подписка на `INSERT` в `messages` (channel `global_messages`)
- Комнаты: подписка с фильтром `level=eq.${roomId}` в `messages` (channel `room_${roomId}`)
- Личные сообщения: подписка с фильтром `conversation_id=eq.${id}` в `direct_messages` (требует `REPLICA IDENTITY FULL` на таблице)
- Анонимные мысли: подписка на `INSERT/UPDATE` в `thought_reactions`

### Avatar storage
Аватары хранятся как base64 data URI прямо в `users.avatar_url`. Сжатие через `expo-image-picker` с `quality: 0.4, base64: true, aspect: [1,1]`.

### Уровни пользователей
`green` / `yellow` / `red` — определяются тестом (TestScreen), хранятся в `users.level` и `test_results`. Везде используются через `LEVEL_COLORS` и `LEVEL_DATA` из `constants.js`.

### Тест и рекомендации
- `TestScreen` — 10 вопросов, считает pessimistic ответы, определяет level, сохраняет в `users.level` и `test_results`
- После теста переход на `RecommendationsScreen` с `{ level }` параметром
- `RecommendationsScreen` — загружает историю тестов из `test_results`, показывает динамику (лучше/хуже/стабильно) и персональные рекомендации

### Дизайн-система
Все экраны — тёмная тема (`colors.background`). Ionicons везде, эмодзи не используются. Floating pill CustomTabBar (абсолютное позиционирование, `useSafeAreaInsets`). Поля ввода в чатах — полупрозрачные `rgba(255,255,255,0.07)`, `borderRadius: 22` (Telegram-стиль). Аватары — компонент `Avatar` с fallback на первую букву + цвет уровня.
