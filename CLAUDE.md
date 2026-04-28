# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## О проекте — Zface

**Zface** — мобильное приложение для людей с плохим ментальным состоянием. Идея: «найди своих» — людей, которым сейчас так же плохо, как тебе. Не терапия, не позитивный коучинг — честное сообщество.

### Концепция
- Пользователь проходит тест из 10 вопросов → получает **уровень**: `green` (норм), `yellow` (тяжеловато), `red` (совсем плохо)
- Уровень определяет, с кем ты общаешься: комнаты, лента, рекомендации — всё фильтруется по уровню
- Аватар и цвет никнейма везде отображают уровень пользователя — визуальный язык состояния

### Основные экраны
- **HomeScreen** — статус-карточка уровня, динамика изменений, кнопки «Пройти тест» / «Рекомендации», вопрос дня (daily_answers), сетка модулей, график истории тестов, напоминание пройти тест если прошло >3 дней
- **FeedScreen** — лента постов с фильтром по уровню, создание поста (свой уровень / все), лайки
- **MessagesScreen** — две вкладки: «Чаты» (общий чат, комнаты по уровню, бар) и «Личные» (DM с друзьями)
- **FriendsScreen** — поиск по никнейму, заявки в друзья (входящие/исходящие), список друзей, кнопка DM
- **ProfileScreen** — аватар (base64, редактируемый), статус (редактируемый), уровень, мотиватор дня, достижения (система из 8 ачивок), выход, удаление аккаунта, приглашение друга через Share API
- **ChatScreen** — глобальный чат (все уровни вместе), realtime, удаление своих сообщений
- **RoomsScreen** — комнаты по уровню, только своя доступна, realtime чат, список участников, тап аватара → профиль
- **BarScreen** — онлайн-бар: 4 столика с realtime чатом, тап аватара → профиль
- **DirectMessageScreen** — личная переписка, блокировка проверяется перед отправкой, тап аватара → профиль
- **UserProfileScreen** — профиль другого пользователя: добавить в друзья / принять / отклонить / удалить, DM, блокировка, жалоба
- **BreathingScreen** — коробочное дыхание 4-4-4-4, Animated-анимация круга, фазы вдох/задержка/выдох/пауза
- **FishingScreen** — мини-игра «рыбалка» как медитативная активность
- **TestScreen** — тест из 10 вопросов, определяет уровень, один раз в сутки (проверка по last test date)
- **RecommendationsScreen** — персональные рекомендации после теста, Ionicons-иконки, тапабельные активности, динамика уровня

### Целевая аудитория
Люди 16–30 лет, которым бывает плохо и которые хотят найти других таких же — без лишних слов и фальши.

### Текущий статус
MVP реализован. Функционал: авторизация, тест (1 раз в сутки), лента, чаты (глобальный/комнаты/бар), друзья, DM, блокировки, жалобы, достижения, вопрос дня, дыхательные упражнения, рыбалка, рекомендации.

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
  ├── Login / Register / Test / Recommendations   (auth flow + post-test, без хедера)
  ├── Main → Tab.Navigator (CustomTabBar — floating pill)
  │     ├── Home, Feed, Messages, Friends, Profile
  ├── DirectMessage      (личная переписка, поверх табов)
  ├── UserProfile        (профиль другого юзера, поверх табов)
  ├── Rooms              (комнаты по уровню, поверх табов)
  ├── Chat               (глобальный чат, поверх табов)
  ├── Breathing          (дыхательные упражнения, поверх табов)
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
- `constants.js` — `LABELS`, `LEVEL_COLORS`, `LEVEL_DATA`, `PHRASES`, `MOTIVATORS`, `DAILY_QUESTIONS`, `ACHIEVEMENTS`
- `theme.js` — объект `colors` (все цвета приложения) + `shared` StyleSheet (переиспользуемые стили: кнопки, инпуты, ярлыки)
- `utils.js` — `getConversationId(uid1, uid2)` для стабильного ID личного чата
- `components/Avatar.js` — аватар с fallback на букву+цвет уровня

### Database schema (Supabase)

| Таблица | Ключевые поля | RLS |
|---------|--------------|-----|
| `users` | `user_id UUID`, `username`, `email`, `level`, `labels TEXT[]`, `status`, `avatar_url`, `last_seen` | ✅ |
| `messages` | `id`, `username`, `text`, `level`, `created_at`, `sender_id` — глобальный чат + комнаты + бар | ✅ |
| `direct_messages` | `id`, `conversation_id TEXT`, `sender_id UUID`, `sender_username`, `text`, `created_at` | ✅ |
| `friendships` | `id`, `requester_id UUID`, `receiver_id UUID`, `status ('pending'\|'accepted')` | ✅ |
| `test_results` | `id`, `user_id UUID`, `level TEXT`, `score INT`, `created_at` — история тестов | ✅ |
| `feed_posts` | `id`, `author_id UUID`, `author_username`, `author_level`, `text`, `target_levels TEXT[]`, `likes INT`, `created_at` | ✅ |
| `daily_answers` | `id`, `user_id UUID`, `question_date DATE`, `question_text`, `answer`, `created_at` | ✅ |
| `user_achievements` | `id`, `user_id UUID`, `achievement_id TEXT`, `created_at` | ✅ |
| `blocks` | `id`, `blocker_id UUID`, `blocked_id UUID` | ✅ |
| `reports` | `id`, `reporter_id UUID`, `reported_user_id UUID`, `reason TEXT` | ✅ |

#### Использование таблицы `messages` для разных чатов
- Глобальный чат: `level = 'global'`
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

### Дизайн-система
Все экраны — тёмная тема (`colors.background`). Ionicons везде, эмодзи не используются. Floating pill CustomTabBar (абсолютное позиционирование, `useSafeAreaInsets`). Поля ввода в чатах — полупрозрачные `rgba(255,255,255,0.07)`, `borderRadius: 22` (Telegram-стиль). Аватары — компонент `Avatar` с fallback на первую букву + цвет уровня.
