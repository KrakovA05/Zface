# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## О проекте — Zface

**Zface** — мобильное приложение для людей с плохим ментальным состоянием. Идея: «найди своих» — людей, которым сейчас так же плохо, как тебе. Не терапия, не позитивный коучинг — честное сообщество.

### Концепция
- Пользователь проходит тест из 10 вопросов → получает **уровень**: `green` (норм), `yellow` (тяжеловато), `red` (совсем плохо)
- Уровень определяет, с кем ты общаешься: комнаты, лента, рекомендации — всё фильтруется по уровню
- Аватар и цвет никнейма везде отображают уровень пользователя — визуальный язык состояния

### Основные экраны
- **HomeScreen** — статус-карточка уровня, динамика изменений, кнопки «Узнать где ты сейчас» / «Рекомендации», стрик-бейдж, счётчик онлайна, вопрос дня (`daily_answers`), «Одно слово дня» + контекст (`daily_word_taps`, кеш в `wordTapCache`), чекин настроения + контекстная подсказка маршрута + пуш если 3 дня подряд ≤3, динамика сообщества, сетка модулей, график истории тестов (список — за кнопкой), напоминание если прошло >3 дней
- **FeedScreen** — лента постов с фильтром по уровню, создание поста (свой уровень / все), лайки, комментарии
- **MessagesScreen** — две вкладки: «Чаты» (общий чат, комнаты по уровню) и «Личные» (DM с друзьями), бейджи непрочитанных
- **FriendsScreen** — поиск по никнейму, поиск по ярлыкам, заявки в друзья (входящие/исходящие), список друзей, кнопка DM
- **ProfileScreen** — аватар (base64, редактируемый), статус (редактируемый), уровень, мотиватор дня, достижения (8 ачивок), свитч «Показывать динамику», счётчик «помог N людям» (`user_helps`), выход, удаление аккаунта, приглашение друга через Share API
- **ChatScreen** — глобальный чат (все уровни вместе), realtime, удаление своих сообщений, timestamp
- **RoomsScreen** — комнаты по уровню, только своя доступна, realtime чат, список участников + анонимные наблюдатели (Presence), тап аватара → профиль, timestamp; ночная комната — вход и написание только анонимно, кастомный аватар скрыт
- **DirectMessageScreen** — личная переписка, блокировка проверяется перед отправкой, тап аватара → профиль, timestamp
- **PostScreen** — комментарии к посту ленты, realtime, удаление своих комментариев
- **ThoughtsScreen** — анонимная мысль дня (1 раз в сутки), реакции «я понимаю / я тоже / держись», счётчики реакций других
- **NotificationsScreen** — центр уведомлений: лайки, комментарии, заявки в друзья, письма, реакции на мысль, «ты помог». Тап → глубокий переход на конкретный пост/профиль/вкладку. Колокольчик с бейджем в шапке HomeScreen.
- **SupportScreen** — форма обращения в поддержку (категория + тема + текст). Суpabase Edge Function `send-support-email` → Resend → корпоративная почта + запись в `support_requests`.
- **ResourcesScreen** — психологические материалы из Supabase (`resources`): секция «Для тебя сейчас» (топ-5 по релевантности к текущим метрикам пользователя), аккордеон «Другие темы» по 8 категориям; ссылки через `Linking.openURL()`
- **PsychTestScreen** — прохождение валидированных психологических тестов; принимает `{ testId, onComplete }` через route.params; поддерживает scoring: sum / mean / sum_with_reverse; сохраняет в `psych_test_results`
- **UserProfileScreen** — профиль другого пользователя: добавить в друзья / принять / отклонить / удалить, DM, блокировка, жалоба, динамика уровня (если `show_history = true`), кнопка «Он мне помог» с каунтером (`user_helps`)
- **BreathingScreen** — коробочное дыхание 4-4-4-4, Animated-анимация круга, фазы вдох/задержка/выдох/пауза
- **FishingScreen** — мини-игра «рыбалка» как медитативная активность; математически прорисованная удочка (seg-helper через atan2), float с анимацией, 14 рыб с временно́й привязкой, «Записка в бутылке»
- **TestScreen** — тест из 10 вопросов, определяет уровень, один раз в 24 часа
- **RecommendationsScreen** — персональные рекомендации после теста, динамика уровня (лучше/хуже/стабильно)
- **OnboardingMomentScreen** — после первого теста показывает: сколько человек с тем же уровнем + один анонимный ответ на вопрос дня

> **BarScreen.js** — файл существует, но экран удалён из навигации и Home. Не использовать.

### Целевая аудитория
Люди 16–30 лет, которым бывает плохо и которые хотят найти других таких же — без лишних слов и фальши.

### Текущий статус
MVP+. Функционал: авторизация с подтверждением email, тест (1 раз в 24ч), лента с комментариями, чаты (глобальный/комнаты), DM, друзья, блокировки, жалобы, достижения, вопрос дня, слово дня, анонимные мысли + реакции, дыхание, рыбалка, рекомендации, онбординг, психологические материалы, проактивные пуши, push-уведомления по DM и заявкам, анонимные письма с ответами, центр уведомлений, форма поддержки, **психометрический движок** (8 валидированных тестов, еженедельные метрики, персональные рекомендации).

### Роадмап
- **[ROADMAP.md](ROADMAP.md)** — что ещё не сделано (блокеры релиза + опциональное)
- **[DONE.md](DONE.md)** — всё уже реализованное

Клод обновляет оба файла самостоятельно, но **всегда спрашивает перед добавлением нового пункта**.

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
- **expo-haptics** — тактильная обратная связь на ключевых действиях (тап слова дня, чекин, отправка письма)
- **expo-store-review** — запрос рейтинга при первом открытии анонимного письма

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
  ├── Fishing            (мини-игра рыбалка, поверх табов)
  └── PsychTest          (прохождение валидированного теста, поверх табов, headerShown: false)
```

`App.js` при старте вызывает `supabase.auth.getSession()` — если сессия активна, грузит профиль и идёт сразу на `Main`, иначе на `Login`.

После прохождения теста (TestScreen) → `Recommendations` → `OnboardingMoment` (только первый раз) → `Main`.

### Global state (`store.js`)
Простой мутируемый объект — **не реактивный**. Компоненты не ре-рендерятся при изменении store автоматически. Используется только для данных текущего пользователя:
```js
store = { username, email, level, userId, avatarUrl, status, goal, isAdmin, referralDiscountPct }
```
Поля заполняются при логине/регистрации и при восстановлении сессии в App.js. Для отображения актуальных данных в экранах с профилем используется `useFocusEffect`.

`isAdmin` — флаг администратора. Аккаунт с `is_admin = true` в БД: имеет доступ во все цветовые комнаты, невидим в списке участников комнаты, невидим в поиске, при открытии его UserProfileScreen не показываются никакие кнопки действий (DM, добавить в друзья, заблокировать, пожаловаться).

`referralDiscountPct` — текущая реферальная скидка (0–50%, шаг 10% за каждые 5 приглашённых). Вычисляется при старте из таблицы `users`. Используется PremiumScreen для применения скидки.

### Shared resources
- `constants.js` — `LABELS`, `LEVEL_COLORS`, `LEVEL_DATA`, `PHRASES`, `MOTIVATORS`, `DAILY_QUESTIONS`, `ACHIEVEMENTS`, `DAILY_WORDS`; `LEVEL_COLORS.yellow = '#AA7C00'` (контрастный золотисто-жёлтый на светлом фоне)
- `theme.js` — объект `colors` (все цвета приложения) + `shared` StyleSheet (переиспользуемые стили: кнопки, инпуты, ярлыки)
- `utils.js` — `getConversationId(uid1, uid2)` для стабильного ID личного чата
- `components/Avatar.js` — аватар с fallback на букву+цвет уровня
- `components/StreakModal.js` — анимированный модал стрика входа (`Animated.spring` + смена цвета пламени по прогрессу); показывается из `App.js` раз в день

### Database schema (Supabase)

| Таблица | Ключевые поля | RLS |
|---------|--------------|-----|
| `users` | `user_id UUID`, `username`, `email`, `level`, `labels TEXT[]`, `status`, `avatar_url`, `last_seen`, `show_history BOOL`, `push_token TEXT`, `login_streak INT`, `last_login_date DATE` | ✅ |
| `messages` | `id`, `username`, `text`, `level`, `created_at`, `sender_id`, `edited_at` — глобальный чат + комнаты | ✅ |
| `direct_messages` | `id`, `conversation_id TEXT`, `sender_id UUID`, `sender_username`, `text`, `created_at`, `edited_at` | ✅ |
| `message_reactions` | `id`, `message_id UUID`, `message_table TEXT`, `user_id UUID`, `reaction TEXT`, `created_at` — уникальный индекс `(message_id, message_table, user_id)` | ✅ |
| `friendships` | `id`, `requester_id UUID`, `receiver_id UUID`, `status ('pending'\|'accepted')` | ✅ |
| `test_results` | `id`, `user_id UUID`, `level TEXT`, `score INT`, `created_at` — история тестов | ✅ |
| `feed_posts` | `id`, `author_id UUID`, `author_username`, `author_level`, `text`, `media_url TEXT`, `media_type TEXT`, `target_levels TEXT[]`, `likes INT`, `created_at` | ✅ |
| `post_likes` | `id`, `post_id UUID`, `user_id UUID` — трекинг индивидуальных лайков | ✅ |
| `post_comments` | `id`, `post_id UUID`, `author_id UUID`, `author_username`, `author_level`, `text`, `created_at` | ✅ |
| `daily_answers` | `id`, `user_id UUID`, `question_date DATE`, `question_text`, `answer`, `created_at` | ✅ |
| `daily_word_taps` | `id`, `user_id UUID`, `word_date DATE`, `word TEXT`, `reaction TEXT`, `created_at` | ✅ |
| `anonymous_thoughts` | `id`, `user_id UUID`, `thought_date DATE`, `text`, `created_at` | ✅ |
| `thought_reactions` | `id`, `thought_id UUID`, `user_id UUID`, `reaction TEXT ('понимаю'\|'тоже'\|'держись')`, `created_at` | ✅ |
| `user_achievements` | `id`, `user_id UUID`, `achievement_id TEXT`, `created_at` | ✅ |
| `blocks` | `id`, `blocker_id UUID`, `blocked_id UUID` | ✅ |
| `reports` | `id`, `reporter_id UUID`, `reported_user_id UUID`, `reason TEXT` | ✅ |
| `user_helps` | `id`, `helper_id UUID`, `helped_id UUID`, `created_at` — кнопка «Он мне помог» в UserProfileScreen | ✅ |
| `psych_test_results` | `id`, `user_id UUID`, `test_id TEXT`, `dimension TEXT`, `raw_score INT`, `normalized_score INT`, `answers JSONB`, `created_at` — результаты психологических тестов | ✅ |
| `user_metrics` | `id`, `user_id UUID`, `week_start DATE`, `anxiety/stress/apathy/loneliness/burnout/self_esteem/social_anxiety/attachment _score INT`, `composite_score INT`, `dominant_dimension TEXT`, `level TEXT` — еженедельные снапшоты психометрики, UNIQUE(user_id, week_start) | ✅ |
| `resources` | `id`, `title TEXT`, `type TEXT ('video'\|'article')`, `url TEXT`, `topic TEXT`, `dimension_weights JSONB` — база материалов с весами по измерениям | ✅ |
| `mood_checkins` | `id`, `user_id UUID`, `checkin_date DATE`, `score INT`, `note TEXT`, `created_at` — ежедневный чекин настроения (1–10), note — чип причины | ✅ |
| `ai_proactive_messages` | `id`, `user_id UUID`, `text TEXT`, `type TEXT ('scheduled'\|'triggered')`, `trigger_reason TEXT`, `created_at`, `read_at TIMESTAMPTZ`, `push_sent BOOL` — проактивные сообщения от @одного | ✅ |

#### Использование таблицы `messages` для разных чатов
- Глобальный чат: `level = 'global'`
- Комнаты по статусу (RoomsScreen): `level = 'green' | 'yellow' | 'red'`

#### Supabase Storage
- Bucket `post-media` — фото и видео из постов ленты (FeedScreen). Загружается через `supabase.storage.from('post-media').upload(...)`, URL сохраняется в `feed_posts.media_url`.

`conversation_id` = `[uid1, uid2].sort().join('_')` — всегда стабильный для пары юзеров.

Дружба однонаправленная в таблице: одна строка на заявку. `status='pending'` — заявка отправлена, `status='accepted'` — друзья. Для запроса "мои друзья" используется `.or('requester_id.eq.X,receiver_id.eq.X').eq('status','accepted')`.

#### Удаление аккаунта
Реализовано через Postgres-функцию `delete_user()` с `SECURITY DEFINER` — удаляет `public.users`, затем `auth.users`. Вызывается через `supabase.rpc('delete_user')`.

### Realtime
- Глобальный чат: подписка на `INSERT/UPDATE/DELETE` в `messages` (channel `global_messages`)
- Комнаты: подписка с фильтром `level=eq.${roomId}` в `messages` (channel `room_${roomId}`) + **Supabase Presence** для счётчика анонимных наблюдателей (channel с `config.presence`)
- Личные сообщения: подписка с фильтром `conversation_id=eq.${id}` в `direct_messages` (требует `REPLICA IDENTITY FULL` на таблице)
- Анонимные мысли: подписка на `INSERT/UPDATE` в `thought_reactions`

### Avatar storage
Аватары хранятся как base64 data URI прямо в `users.avatar_url`. Сжатие через `expo-image-picker` с `quality: 0.4, base64: true, aspect: [1,1]`.

### Уровни пользователей
`green` / `yellow` / `red` — определяются тестом (TestScreen), хранятся в `users.level` и `test_results`. Везде используются через `LEVEL_COLORS` и `LEVEL_DATA` из `constants.js`.

### Психометрический движок
- `utils/psychTests.js` — 8 валидированных тестов (`PSYCH_TESTS`), `WEEKLY_PHRASES`, `DIMENSION_WEIGHTS`, `scoreToLevel()`
- `utils/psychScheduler.js` — `getNextTestId(userId)` выбирает следующий тест: профильные (ecr_short, mini_spin) → ежемесячные (olbi_short, rosenberg) → еженедельная ротация (gad7, pss4, aes_short, ucla3)
- Edge Function `compute-weekly-profile` — запуск каждое воскресенье 03:00 (pg_cron), собирает тестовые баллы + поведенческие метрики → пишет в `user_metrics` → обновляет `users.level`
- Формула: `Балл(dim) = тест×0.6 + поведение×0.4`, если теста нет — поведение 100%; композитный скор — взвешенное среднее по 8 измерениям

### Тест и рекомендации
- `TestScreen` — 10 вопросов, считает pessimistic ответы, определяет level, сохраняет в `users.level` и `test_results`
- После теста переход на `RecommendationsScreen` с `{ level }` параметром
- `RecommendationsScreen` — загружает историю тестов из `test_results`, показывает динамику (лучше/хуже/стабильно) и персональные рекомендации

### Дизайн-система
Все экраны — **тёплая светлая тема** (`colors.background = '#FAF7F2'`, `colors.card = '#FFFFFF'`, `colors.white = '#2C2420'`). Ionicons везде, эмодзи не используются. Floating pill CustomTabBar (абсолютное позиционирование, `useSafeAreaInsets`). Поля ввода в чатах — полупрозрачные `rgba(0,0,0,0.04)`, `borderRadius: 22` (Telegram-стиль). Аватары — компонент `Avatar` с fallback на первую букву + цвет уровня.
