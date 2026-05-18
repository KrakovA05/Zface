# Premium Monetization Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Добавить единый Premium-план (~199 ₽/мес) с AI-компаньоном, аналитической глубиной и личными кастомизациями — без разрушения ДНК продукта (равенство в чатах, уязвимая аудитория).

**Architecture:** RevenueCat управляет подписками (Apple IAP + Google Billing), webhook синкает статус в Supabase (`users.is_premium`). React Native хук `usePremium()` читает статус из store. Пейволл появляется только в момент когда пользователь уже хочет что-то сделать — не как баннер.

**Tech Stack:** React Native + Expo, Supabase, RevenueCat SDK (`react-native-purchases`), Groq (AI-компаньон уже работает на Groq)

---

## Граница Free / Premium

### Бесплатно навсегда
- Все чаты, комнаты, DM — социальное ядро не монетизируется
- Ежедневный тест + все психометрические тесты
- Чекин настроения, вопрос дня, слово дня
- Анонимные письма, дыхание, рыбалка (11 базовых рыб)
- Текущий составной уровень + текущие баллы по 8 измерениям (снапшот)
- Проактивные сообщения от @один (остаются бесплатными)
- Кризисные ресурсы и телефон доверия

### Premium (~199 ₽/мес или ~1490 ₽/год, 7 дней триал)

**Глубина:**
- История по 8 измерениям — линейные графики за 12 недель (DimensionHistoryScreen)
- Текстовые инсайты — автогенерация паттернов: «когда ты активнее в чатах, тревога снижается»
- Экспорт снапшота профиля — изображение для психолога или личного архива

**AI-компаньон @один (целиком Premium):**
- У @один уже есть отдельный таб в баре и полноценный чат-экран — всё реализовано
- Таб виден всем, но при тапе бесплатный пользователь видит PremiumScreen
- Premium даёт полный доступ к чату без ограничений
- Тон уже настроен: помогает разобраться в ситуации, без конкретных советов, без перегибов

**Личное пространство:**
- Приватный режим — скрыть свой уровень от других в чатах и профиле
- Расширенная рыбалка — 3 эксклюзивные редкие рыбы + 2 дополнительных пейзажа
- На странице профиля (не в чатах!) — тихая строка «поддерживает проект с [месяц год]»

**Принципиально НЕ делаем:**
- Цветные ники / рамки аватаров в чатах — создаёт видимое расслоение «богатый/бедный»
- Платный доступ к тестам, кризисным ресурсам, чатам
- Рекламу (ни в каком виде)

---

## Архитектура

### Supabase
```sql
-- Добавить в таблицу users
ALTER TABLE users ADD COLUMN is_premium BOOL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN premium_expires_at TIMESTAMPTZ;

-- Новая таблица для диалогов с AI-компаньоном
CREATE TABLE ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('user', 'assistant')),
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
-- Автоочистка: сообщения старше 30 дней удаляются (pg_cron или триггер)

CREATE INDEX ON ai_messages(user_id, created_at DESC);
```

RLS на `ai_messages`: пользователь видит только свои сообщения.

### Edge Functions
- `revenuecat-webhook` — принимает события от RevenueCat (`INITIAL_PURCHASE`, `RENEWAL`, `CANCELLATION`, `EXPIRATION`), обновляет `users.is_premium` и `users.premium_expires_at`
- `ai-companion` — уже существует (Groq). Добавить: поддержка user-initiated сообщений (сейчас только проактивные)

### React Native
```js
// store.js — добавить поля
store = { ..., isPremium: false, premiumExpiresAt: null }

// usePremium.js — хук
export function usePremium() {
  return store.isPremium;
}

// Паттерн использования в любом экране:
const isPremium = usePremium();
if (!isPremium) {
  navigation.navigate('Premium');
  return;
}
```

### RevenueCat
- SDK: `react-native-purchases`
- Продукты: `premium_monthly` (199 ₽/мес) + `premium_annual` (1490 ₽/год)
- Триал: 7 дней бесплатно на первой подписке
- Webhook → Edge Function `revenuecat-webhook`

---

## Точки входа в пейволл

| Место | Триггер |
|-------|---------|
| AnalyticsScreen | Тап по строке измерения → DimensionHistoryScreen |
| Таб @один | Тап на таб → если не Premium, сразу PremiumScreen |
| FishingScreen | Тап на замо́к у редкой рыбы или пейзажа |
| ProfileScreen | Шестерёнка → пункт «Premium» |
| AnalyticsScreen | Ненавязчивый баннер внизу экрана «История и инсайты — в Premium» |

**Правило:** пейволл показывается только когда пользователь уже хочет что-то сделать. Никаких автоматических попапов при старте или на главном экране.

---

## PremiumScreen (пейволл-экран)

- Без хедера (`headerShown: false`)
- Список 4–5 буллетов что получаешь (с иконками)
- Переключатель месяц / год с разницей цены
- Большая кнопка «Попробовать 7 дней бесплатно»
- Мелкая ссылка «Восстановить покупку»
- Мелкий текст с условиями (обязательно по правилам App Store)
- Кнопка закрыть (крестик)

---

## AICompanionScreen

Экран уже реализован. Для Premium-гейтинга нужно:
- При старте экрана проверять `store.isPremium`
- Если `false` → `navigation.replace('Premium')`
- Вся остальная логика (Groq, история, кризисный баннер) остаётся без изменений

---

## Этические ограничения

- @один не диагностирует, не назначает лечение, не притворяется человеком
- Кризисные ресурсы остаются бесплатными всегда
- Никакого давления на конвертацию в уязвимые моменты (пейволл не показывается после негативного чекина)
- Данные `ai_messages` не используются для обучения моделей, удаляются через 30 дней

---

## Timing

Монетизацию можно запустить одновременно с релизом или после набора первых пользователей — решение остаётся открытым. Архитектура одинакова в обоих случаях. Если старт без монетизации — PremiumScreen просто не подключается к навигации.
