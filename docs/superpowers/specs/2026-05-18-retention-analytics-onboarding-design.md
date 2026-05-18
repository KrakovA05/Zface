# Retention: Онбординг + Живая Аналитика — Дизайн

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Дата:** 2026-05-18
**Статус:** Approved

---

## Контекст и проблема

Приложение имеет три слоя retention:
- **Слой A (неделя 1):** самоанализ — тесты, метрики, «вот ты сейчас»
- **Слой Б (неделя 2–4):** сообщество — левел-матчинг, комнаты
- **Слой В (месяц 1+):** история — путь не теряется при смене уровня

Этот спек закрывает **Слой A**. Две ключевые проблемы:

1. **"Aha" разорван.** Последовательность «уровень → вопросы которые бьют в нерв → аналитика про себя» уже существует, но размазана по экранам. Человек проходит тест уровня, попадает на главный с восемью модулями и уходит не дойдя до психотестов и аналитики.

2. **Аналитика несвежая.** `compute-weekly-profile` запускается только по cron в воскресенье. Пользователь прошёл тест, сделал чекин — аналитика та же. Петля действие → фидбек сломана.

---

## Флоу после изменений

**Первый тест:**
```
TestScreen → Recommendations → AnalyticsPreviewScreen → PsychTestScreen (опц.) → OnboardingMoment → Карусель → Main
```

**Повторные визиты:**
- После чекина или психотеста → карточка «твой профиль обновился» на HomeScreen
- AnalyticsScreen всегда показывает живые данные

---

## Изменение 1: AnalyticsPreviewScreen (новый экран)

Показывается **только при первом тесте** (после Recommendations, до OnboardingMoment).

### Внешний вид

```
────────────────────────────────
  Твой профиль

  [Жёлтый ████████░░░░ 58/100]   ← заполнен (из теста)

  Тревога     [░░░░░░░░░░░░] ?    ← заблокировано
  Стресс      [░░░░░░░░░░░░] ?
  + ещё 6 измерений...

  «узнай подробнее — 4 вопроса»

        [Узнать →]
        [Пропустить]
────────────────────────────────
```

### Поведение

- Кнопка **«Узнать →»** → `PsychTestScreen` с `{ testId: 'pss4', onComplete: () => navigate('OnboardingMoment', { level }) }`
- PSS-4 выбран как первый: 4 вопроса, измерение «стресс» — самое понятное пользователю
- Кнопка **«Пропустить»** → `OnboardingMoment` без психотеста
- После завершения психотеста → AnalyticsPreview НЕ показывается снова; психотест доступен с HomeScreen в обычном порядке

### Навигация

В `RecommendationsScreen` (строка 208): при `isFirstTest` вместо `OnboardingMoment` → `AnalyticsPreview`:
```js
navigation.replace('AnalyticsPreview', { level })
```

Регистрация в `App.js`:
```jsx
<Stack.Screen name="AnalyticsPreview" component={AnalyticsPreviewScreen} options={{ headerShown: false }} />
```

---

## Изменение 2: Живая аналитика в AnalyticsScreen

### Проблема с текущей архитектурой

`AnalyticsScreen` читает из `user_metrics` — еженедельного снапшота. Функция `compute-weekly-profile` защищена `CRON_SECRET` и обрабатывает всех пользователей — вызывать из приложения нельзя.

### Решение: client-side вычисление

Добавить функцию `computeLiveProfile(uid)` которая запрашивает сырые данные из Supabase и применяет ту же формулу. `user_metrics` остаётся для:
- Тренда за 4 недели (секция 4 в AnalyticsScreen)
- Дельты (база сравнения — последний снапшот)

### Формула (идентична edge function)

```js
// Тестовые баллы: последний psych_test_results за 30 дней по каждому dim
// Поведенческие за текущую неделю (с понедельника):
//   anxiety:        ночные сообщения (0–5 утра), norm(count, 0, 10)
//   stress:         Math.max(0, 7 - checkinCount), norm(x, 0, 7)
//   loneliness:     Math.max(0, 5 - uniqueDMConversations), norm(x, 0, 5)
//   apathy:         Math.max(0, 7 - min(7, msgCount)), norm(x, 0, 7)
//   self_esteem:    100 - norm(helpsReceivedCount, 0, 5)
//   burnout:        checkinTrend < -2 → 70, < 0 → 40, else 20
//   social_anxiety: Math.max(0, 10 - msgCount), norm(x, 0, 10)
//   attachment:     testScore ?? 50

// Итог по измерению: hasTest ? test*0.6 + behav*0.4 : behav
// Композитный: взвешенная сумма (веса из DIMENSION_WEIGHTS)
```

Данные грузятся одним `Promise.all` при открытии экрана. Результат — объект той же структуры что `user_metrics`, отображается в существующих компонентах без изменения UI.

---

## Изменение 3: Дельта на барах психометрического профиля

### Источник «предыдущего» значения

Последняя запись из `user_metrics` (ORDER BY week_start DESC LIMIT 1). Если записи нет — дельта не показывается.

### Правило цвета

Все 8 измерений: **высокий балл = хуже**. Правило единое:
- Δ < 0 (снизился) → зелёный ✓
- Δ > 0 (вырос) → красный ✗
- Δ = 0 → ничего

### Переименование меток

| Было | Стало | Почему |
|------|-------|--------|
| `Самооценка` | `Нехватка уверенности` | «высокий балл = плохо» стало очевидным |
| `Привязанность` | `Тревога привязанности` | ECR-Short меряет именно тревогу |

Остальные 6 остаются без изменений.

### Визуальное отображение в `ProfileSection`

```
Тревога          [████████████░░░░░░░░]  65  ▲8 (красный)
Стресс           [████████░░░░░░░░░░░░]  45  ▼10 (зелёный)
Апатия           [██████████████░░░░░░]  72   — 
```

Бар:
- Основной цвет бара — `colors.accent` (нейтральный)
- Дельта-сегмент: между `min(prev, cur)` и `max(prev, cur)`, цвет зависит от направления
- Числовой дельта `▲8` / `▼10` рядом с баллом

Структура бара в JSX:
```jsx
<View style={barWrap}>
  {/* базовый бар до текущего значения */}
  <View style={[barFill, { width: `${score}%` }]} />
  {/* дельта-сегмент */}
  {delta !== 0 && (
    <View style={[
      deltaSegment,
      {
        left: `${Math.min(score, prevScore)}%`,
        width: `${Math.abs(delta)}%`,
        backgroundColor: delta > 0 ? colors.pink : '#5DAA72',
        opacity: 0.5,
      }
    ]} />
  )}
</View>
```

---

## Изменение 4: Карточка «твой профиль обновился» на HomeScreen

### Условие показа

Показывается когда в `AsyncStorage` есть флаг `profile_updated` со значением `true`. Флаг выставляется в:
- `PsychTestScreen` — после сохранения результата
- HomeScreen — после завершения чекина настроения (уже есть `onCheckinDone` коллбек)

После показа карточки флаг снимается.

### Внешний вид

```
╔════════════════════════════════╗
║  твой профиль обновился    →   ║
╚════════════════════════════════╝
```

Маленькая карточка: 11–12px текст, `colors.muted`, без восклицательного знака. Тап → `navigation.navigate('Analytics')`. Помещается под «Фокус дня» или над модулями — там где сейчас есть место.

### Реализация флага

```js
// В PsychTestScreen после insert в psych_test_results:
await AsyncStorage.setItem('profile_updated', 'true');

// В HomeScreen при рендере:
const [profileUpdated, setProfileUpdated] = useState(false);
useFocusEffect(useCallback(() => {
  AsyncStorage.getItem('profile_updated').then(v => {
    if (v === 'true') setProfileUpdated(true);
  });
}, []));

// При нажатии:
const goToAnalytics = async () => {
  await AsyncStorage.removeItem('profile_updated');
  setProfileUpdated(false);
  navigation.navigate('Analytics');
};
```

---

## Файлы к изменению

| Файл | Что меняется |
|------|-------------|
| `ustal/screens/AnalyticsPreviewScreen.js` | Создать новый экран |
| `ustal/screens/AnalyticsScreen.js` | Добавить `computeLiveProfile`, дельта на барах, переименовать метки |
| `ustal/screens/HomeScreen.js` | Карточка «твой профиль обновился» |
| `ustal/screens/PsychTestScreen.js` | Выставить AsyncStorage флаг после сохранения |
| `ustal/screens/RecommendationsScreen.js` | При `isFirstTest` → `AnalyticsPreview` вместо `OnboardingMoment` |
| `ustal/App.js` | Зарегистрировать `AnalyticsPreviewScreen` |
