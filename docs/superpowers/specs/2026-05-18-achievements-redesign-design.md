# Achievements Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Переработать систему достижений для максимального retention — видимый прогресс по ежедневным привычкам, сюрприз за глубину, 27 достижений в 5 тематических группах + улучшения карточки психотеста на HomeScreen.

**Architecture:** Достижения хранятся в `user_achievements` (без изменений схемы). Добавляется таблица `breathing_sessions` для трекинга дыхательных сессий. `checkAndAwardAchievements` переписывается с параллельными запросами. Профиль получает новую секцию «В процессе» с прогресс-барами и категорированный грид.

**Tech Stack:** React Native, Supabase PostgreSQL, Ionicons

---

## Полный список достижений (27 шт.)

### Группа «Путь» — тесты и состояние

| id | Название | Условие | Скрытое |
|---|---|---|---|
| `first_test` | Первый шаг | 1 тест пройден | нет |
| `five_tests` | Привычка | 5 тестов | нет |
| `ten_tests` | Самоанализ | 10 тестов | да |
| `twenty_tests` | Глубже | 20 тестов | да |
| `comeback` | Возвращение | уровень вышел из красного | нет |
| `stable` | Стабильность | 3 зелёных подряд | нет |

### Группа «Каждый день» — ежедневные привычки

| id | Название | Условие | Скрытое |
|---|---|---|---|
| `checkin_first` | Честно | первый чекин настроения | нет |
| `checkin_7` | Неделя честности | 7 чекинов подряд | да |
| `daily_7` | Неделя | 7 дней ответа на вопрос дня подряд | да |
| `daily_30` | Месяц | 30 дней ответа подряд | да |
| `streak_14` | Две недели | login_streak ≥ 14 | да |

### Группа «Голос» — самовыражение

| id | Название | Условие | Скрытое |
|---|---|---|---|
| `profile_done` | Личность | заполнен статус + аватар | нет |
| `first_post` | Голос | первый пост в ленте | да |
| `first_thought` | Мысль вслух | первая анонимная мысль | нет |
| `thought_reactions_5` | Тебя услышали | 5 реакций на свою мысль | да |
| `first_reaction` | Поддержал | первая реакция на чужую мысль | нет |

### Группа «Связи» — социальность

| id | Название | Условие | Скрытое |
|---|---|---|---|
| `first_friend` | Не один | первый друг принят | нет |
| `first_dm` | Написал первым | первое личное сообщение отправлено | нет |
| `helper_1` | Кто-то заметил | 1 человек нажал «он мне помог» | нет |
| `helper_5` | Рядом | 5 человек нажали «помог» | да |
| `helper_20` | Маяк | 20 человек нажали «помог» | да |

### Группа «Глубина» — исследование

| id | Название | Условие | Скрытое |
|---|---|---|---|
| `psych_first` | Под поверхностью | первый психотест пройден | нет |
| `psych_all` | Полная картина | все 8 психотестов пройдены хотя бы по разу | да |
| `breathing_first` | Выдох | первая сессия дыхания | нет |
| `breathing_10` | Дышу | 10 сессий дыхания | да |
| `fish_first` | Рыбак | первая пойманная рыба | нет |
| `fish_rare` | Редкость | поймана рыба rarity = 'rare' или 'legendary' | да |

---

## Блок «В процессе» (прогресс-бары)

Показывается всегда вверху секции достижений. Три фиксированных карточки:

1. **Стрик вопроса дня** — `текущий стрик / 7`, после 7 переключается на `/ 30`
2. **Чекин настроения** — `streak чекинов подряд / 7`
3. **Психотесты** — `уникальных test_id в psych_test_results / 8`

Карточка: название слева, прогресс-бар по центру, `X/Y` справа. Цвет бара — `colors.accent`.

Стрик чекинов считается в runtime: берём `mood_checkins` за последние 30 дней, считаем последовательные дни назад от сегодня.

---

## Секция достижений в ProfileScreen

### Шапка
```
Достижения  ·  7 из 27  [прогресс-бар]
```

### Блок «В процессе»
Три карточки с прогресс-барами (описание выше).

### Грид по группам
Каждая группа: заголовок (11px, uppercase, `colors.muted`) + грид 3 колонки.

- Заработанное: иконка Ionicons в цвете `colors.accent`, название, описание
- Незаработанное обычное: иконка `lock-closed-outline` приглушённая, название серым, описание `?`
- Незаработанное скрытое: иконка `help-outline`, название `???`, описание `эту получают единицы`

**Замена эмодзи → Ionicons.** Каждое достижение получает поле `icon: 'ionicon-name'`. Примеры:
- `first_test` → `flask-outline`
- `comeback` → `trending-up-outline`
- `stable` → `leaf-outline`
- `first_friend` → `people-outline`
- `first_thought` → `chatbubble-ellipses-outline`
- `helper_20` → `bonfire-outline`
- `breathing_first` → `sync-outline`
- `fish_rare` → `fish-outline`
- `psych_all` → `telescope-outline`
- и т.д. — полный список в `constants.js`

---

## Улучшения карточки психотеста (HomeScreen)

Карточка психотеста уже существует на HomeScreen. Два изменения:

### 1. Знак вопроса с аннотацией
В правой части заголовка карточки — иконка `help-circle-outline` (16px, `colors.muted`). При нажатии — `Alert.alert` с текстом:

> «короткие вопросы — честные ответы. для себя: чтобы замечать то, что обычно не замечаешь. для приложения: чтобы оно лучше понимало тебя и показывало то, что сейчас нужно»

Заголовок алерта: `«зачем тесты?»`

### 2. «Обновится завтра» после прохождения
Когда `lastDoneTestId !== null` (тест уже пройден сегодня) — в нижней части карточки добавляется строка:

```
обновится завтра
```

Стиль: 11px, `colors.muted`, курсив, выровнено по центру, `marginTop: 6`.

---

## Новая таблица: breathing_sessions

```sql
create table breathing_sessions (
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

BreathingScreen при завершении сессии (нажатие «Стоп» или окончание цикла) вставляет строку:
```js
await supabase.from('breathing_sessions').insert({ user_id: store.userId });
```

---

## checkAndAwardAchievements — новая структура

Параллельные запросы одним `Promise.all`, затем логика выдачи. Псевдокод:

```js
const checkAndAwardAchievements = async () => {
  if (!store.userId) return;
  try {
    const uid = store.userId;
    const [
      { data: existing },
      { count: testCount },
      { data: recentTests },
      { count: friendCount },
      { count: dmCount },
      { count: postCount },
      { data: dailyAnswers },
      { count: helpCount },
      { data: thoughts },
      { data: reactions },
      { data: breathingSessions },
      { data: caughtFish },
      { data: psychResults },
      { data: userRow },
    ] = await Promise.all([
      supabase.from('user_achievements').select('achievement_id').eq('user_id', uid),
      supabase.from('test_results').select('*', { count: 'exact', head: true }).eq('user_id', uid),
      supabase.from('test_results').select('level').eq('user_id', uid).order('created_at', { ascending: false }).limit(20),
      supabase.from('friendships').select('*', { count: 'exact', head: true }).or(`requester_id.eq.${uid},receiver_id.eq.${uid}`).eq('status', 'accepted'),
      supabase.from('direct_messages').select('*', { count: 'exact', head: true }).eq('sender_id', uid),
      supabase.from('feed_posts').select('*', { count: 'exact', head: true }).eq('author_id', uid),
      supabase.from('daily_answers').select('question_date').eq('user_id', uid).order('question_date', { ascending: false }).limit(35),
      supabase.from('user_helps').select('*', { count: 'exact', head: true }).eq('helper_id', uid),
      supabase.from('anonymous_thoughts').select('id').eq('user_id', uid).limit(1),
      supabase.from('thought_reactions').select('thought_id').eq('user_id', uid).limit(1),
      supabase.from('breathing_sessions').select('*', { count: 'exact', head: true }).eq('user_id', uid),
      supabase.from('caught_fish').select('fish_name, rarity').eq('user_id', uid),
      supabase.from('psych_test_results').select('test_id').eq('user_id', uid),
      supabase.from('users').select('login_streak, status, avatar_url').eq('user_id', uid).single(),
    ]);
    // ... логика toAward[]
  } catch {
    // тихий fallback
  }
};
```

Все проверки условий делаются синхронно после `Promise.all`.

---

## Файлы к изменению

| Файл | Что меняется |
|---|---|
| `ustal/constants.js` | Полностью переписать `ACHIEVEMENTS` — 27 записей с `icon` вместо `emoji` |
| `ustal/screens/ProfileScreen.js` | Новая секция «В процессе», категорированный грид, замена emoji→Ionicons, переписать `checkAndAwardAchievements` |
| `ustal/screens/HomeScreen.js` | Знак вопроса на карточке психотеста, «обновится завтра» |
| `ustal/screens/BreathingScreen.js` | Вставка строки в `breathing_sessions` при завершении сессии |
| Supabase migration | Создать таблицу `breathing_sessions` с RLS |
