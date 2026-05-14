# Психометрический движок Zface — План реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Заменить простой 10-вопросный тест многомерной системой — 8 валидированных психологических тестов + пассивные метрики активности → еженедельный составной скор → персональные рекомендации материалов и мягкая интерпретация на главном экране.

**Architecture:** Supabase Edge Function `compute-weekly-profile` запускается каждое воскресенье, агрегирует данные из psych_test_results + поведенческих таблиц, записывает снапшот в user_metrics и обновляет users.level. Клиентская часть — новый экран PsychTestScreen + обновлённые HomeScreen и ResourcesScreen.

**Tech Stack:** React Native 0.81 / Expo 54, Supabase (PostgreSQL + Edge Functions Deno/TypeScript), существующий паттерн экранов (useState/useEffect/supabase queries).

---

## Task 1: Миграции БД — три новые таблицы

**Files:**
- Create: `supabase/migrations/001_psychometric_tables.sql`

- [ ] **Шаг 1: Создать папку и файл миграции**

```bash
mkdir -p /Users/user/Zface/supabase/migrations
```

- [ ] **Шаг 2: Записать SQL миграцию**

Создать файл `supabase/migrations/001_psychometric_tables.sql`:

```sql
-- Результаты психологических тестов
CREATE TABLE IF NOT EXISTS psych_test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
  test_id TEXT NOT NULL,
  dimension TEXT NOT NULL,
  raw_score INT NOT NULL,
  normalized_score INT NOT NULL,
  answers JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE psych_test_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users see own psych results"
  ON psych_test_results FOR ALL
  USING (auth.uid() = user_id);

-- Еженедельные снапшоты метрик
CREATE TABLE IF NOT EXISTS user_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  anxiety_score INT DEFAULT 0,
  stress_score INT DEFAULT 0,
  apathy_score INT DEFAULT 0,
  loneliness_score INT DEFAULT 0,
  burnout_score INT DEFAULT 0,
  self_esteem_score INT DEFAULT 0,
  social_anxiety_score INT DEFAULT 0,
  attachment_score INT DEFAULT 0,
  composite_score INT NOT NULL DEFAULT 0,
  dominant_dimension TEXT,
  level TEXT NOT NULL DEFAULT 'green',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, week_start)
);

ALTER TABLE user_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users see own metrics"
  ON user_metrics FOR ALL
  USING (auth.uid() = user_id);

-- База материалов
CREATE TABLE IF NOT EXISTS resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  type TEXT CHECK (type IN ('video', 'article')),
  url TEXT NOT NULL,
  topic TEXT NOT NULL,
  dimension_weights JSONB NOT NULL DEFAULT '{}'
);

ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "resources readable by all authenticated"
  ON resources FOR SELECT
  USING (auth.role() = 'authenticated');
```

- [ ] **Шаг 3: Применить миграцию через Supabase MCP**

Выполнить содержимое файла `supabase/migrations/001_psychometric_tables.sql` через `mcp__supabase__apply_migration`.

- [ ] **Шаг 4: Проверить таблицы**

Выполнить SQL через `mcp__supabase__execute_sql`:
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('psych_test_results', 'user_metrics', 'resources');
```
Ожидаемый результат: три строки.

- [ ] **Шаг 5: Commit**

```bash
git add supabase/migrations/001_psychometric_tables.sql
git commit -m "БД: таблицы psych_test_results, user_metrics, resources"
```

---

## Task 2: Заполнить таблицу resources начальными данными

**Files:**
- Create: `supabase/migrations/002_seed_resources.sql`

- [ ] **Шаг 1: Создать файл seed**

Создать `supabase/migrations/002_seed_resources.sql`:

```sql
INSERT INTO resources (title, type, url, topic, dimension_weights) VALUES
-- Тревога
('Как справиться с тревогой', 'video', 'https://www.youtube.com/watch?v=rJy_0VpWDGM', 'anxiety',
 '{"anxiety": 0.9, "stress": 0.4, "social_anxiety": 0.3}'),
('Лабковский: как избавиться от страха', 'video', 'https://www.youtube.com/watch?v=oAJRs9lSgIc', 'anxiety',
 '{"anxiety": 0.9, "social_anxiety": 0.5}'),
('Дневник тревог: уменьшаем тревожность', 'article', 'https://www.b17.ru/article/549223/', 'anxiety',
 '{"anxiety": 0.8, "stress": 0.3}'),
('Тревога: цикл статей', 'article', 'https://www.b17.ru/article/iamhigh_trevoga2/', 'anxiety',
 '{"anxiety": 0.9, "apathy": 0.2}'),

-- Апатия и депрессия
('Апатия: когда ничего не хочется', 'video', 'https://www.youtube.com/watch?v=rewr6Q7jnVo', 'depression',
 '{"apathy": 0.9, "burnout": 0.4, "self_esteem": 0.3}'),
('Как бороться с депрессией и апатией', 'video', 'https://www.youtube.com/watch?v=giPo2OX1FdY', 'depression',
 '{"apathy": 0.9, "burnout": 0.5}'),
('Апатия, депрессия. Где брать ресурс?', 'article', 'https://www.b17.ru/article/kritskayaapatia/', 'depression',
 '{"apathy": 0.9, "burnout": 0.4, "self_esteem": 0.3}'),
('Что такое депрессия: взгляд психолога', 'article', 'https://www.b17.ru/article/16298/', 'depression',
 '{"apathy": 0.8, "loneliness": 0.3}'),

-- Выгорание
('Как распознать эмоциональное выгорание', 'video', 'https://www.youtube.com/watch?v=R8H0o5Avh98', 'burnout',
 '{"burnout": 0.9, "stress": 0.5, "apathy": 0.4}'),
('Выгорание vs усталость: лекция Филоник', 'video', 'https://www.youtube.com/watch?v=MG2o_ZKZYsM', 'burnout',
 '{"burnout": 0.9, "stress": 0.4}'),
('Выгорание: доказательные методы помощи', 'article', 'https://www.b17.ru/article/827185/', 'burnout',
 '{"burnout": 0.9, "stress": 0.4, "apathy": 0.3}'),
('Пошаговая стратегия восстановления', 'article', 'https://www.b17.ru/article/830567/', 'burnout',
 '{"burnout": 0.8, "apathy": 0.4}'),

-- Одиночество
('Одиночество: как перестать бояться себя', 'video', 'https://www.youtube.com/watch?v=n3Xv_g3g-mA', 'loneliness',
 '{"loneliness": 0.9, "social_anxiety": 0.4, "attachment": 0.3}'),
('Почему мы чувствуем себя одинокими', 'article', 'https://www.b17.ru/article/odinochestvo_prichiny/', 'loneliness',
 '{"loneliness": 0.9, "attachment": 0.4}'),
('Как найти своих людей', 'article', 'https://www.b17.ru/article/kak_nayti_svoikh/', 'loneliness',
 '{"loneliness": 0.8, "social_anxiety": 0.5, "attachment": 0.4}'),

-- Самооценка
('Как перестать себя критиковать', 'video', 'https://www.youtube.com/watch?v=y_vS87RX5QA', 'self_esteem',
 '{"self_esteem": 0.9, "anxiety": 0.3}'),
('Самооценка и внутренний критик', 'article', 'https://www.b17.ru/article/samootsenka_kritik/', 'self_esteem',
 '{"self_esteem": 0.9, "anxiety": 0.2}'),
('Как принять себя: практика самосострадания', 'article', 'https://www.b17.ru/article/samosostradanie/', 'self_esteem',
 '{"self_esteem": 0.8, "apathy": 0.3, "burnout": 0.2}'),

-- Стресс
('Стресс: что происходит в теле и голове', 'video', 'https://www.youtube.com/watch?v=v-t1Z5-oPtU', 'stress',
 '{"stress": 0.9, "anxiety": 0.4}'),
('Хронический стресс: как остановить', 'article', 'https://www.b17.ru/article/khronicheskiy_stress/', 'stress',
 '{"stress": 0.9, "burnout": 0.4, "anxiety": 0.3}'),

-- Отношения и привязанность
('Тревожная привязанность: как выйти из замкнутого круга', 'video', 'https://www.youtube.com/watch?v=pY5BpAMDe_c', 'attachment',
 '{"attachment": 0.9, "anxiety": 0.4, "social_anxiety": 0.3}'),
('Стили привязанности в отношениях', 'article', 'https://www.b17.ru/article/stili_privyazannosti/', 'attachment',
 '{"attachment": 0.9, "loneliness": 0.3}'),

-- Социальная тревожность
('Социальная тревожность: я среди людей', 'video', 'https://www.youtube.com/watch?v=1HE6KW0mIBw', 'social_anxiety',
 '{"social_anxiety": 0.9, "anxiety": 0.5, "loneliness": 0.3}'),
('Страх осуждения и как с ним жить', 'article', 'https://www.b17.ru/article/strakh_osuzhdeniya/', 'social_anxiety',
 '{"social_anxiety": 0.9, "anxiety": 0.4, "self_esteem": 0.3}');
```

- [ ] **Шаг 2: Применить seed через mcp__supabase__apply_migration**

- [ ] **Шаг 3: Проверить**

```sql
SELECT COUNT(*) FROM resources;
```
Ожидаемый результат: 23.

- [ ] **Шаг 4: Commit**

```bash
git add supabase/migrations/002_seed_resources.sql
git commit -m "БД: начальные данные таблицы resources"
```

---

## Task 3: Константы психологических тестов

**Files:**
- Create: `ustal/utils/psychTests.js`

- [ ] **Шаг 1: Создать файл с тестами**

Создать `ustal/utils/psychTests.js`:

```js
// Валидированные психологические тесты
// Тир 1 — ПРОФИЛЬ (один раз при онбординге)
// Тир 2 — ЕЖЕНЕДЕЛЬНО (ротация, 1-2 теста в неделю)
// Тир 3 — ЕЖЕМЕСЯЧНО

export const PSYCH_TESTS = {

  // ─── ТИР 1: ПРОФИЛЬ ────────────────────────────────────────────────────────

  ecr_short: {
    id: 'ecr_short',
    tier: 'profile',
    dimension: 'attachment',
    title: 'Стиль привязанности',
    subtitle: 'ECR-Short — 6 вопросов',
    intro: 'Эти вопросы помогут понять как ты строишь отношения с людьми. Нет правильных ответов.',
    scale: { min: 1, max: 7, labels: ['совсем не согласен', 'полностью согласен'] },
    scoring: 'mean', // среднее, затем нормализация
    questions: [
      'Я боюсь потерять партнёра или близкого человека.',
      'Мне нужно много заверений в том, что меня любят.',
      'Я беспокоюсь что меня бросят.',
      'Мне некомфортно когда кто-то слишком сближается со мной.',
      'Я предпочитаю не зависеть от других людей.',
      'Мне трудно полностью довериться другому человеку.',
    ],
    normalize: (rawMean) => Math.round(((rawMean - 1) / 6) * 100),
  },

  mini_spin: {
    id: 'mini_spin',
    tier: 'profile',
    dimension: 'social_anxiety',
    title: 'Социальная тревожность',
    subtitle: 'Mini-SPIN — 3 вопроса',
    intro: 'Три коротких вопроса о том как ты чувствуешь себя среди людей.',
    scale: { min: 0, max: 4, labels: ['никогда', 'всегда'] },
    scoring: 'sum',
    questions: [
      'Страх опозориться или показаться глупым удерживает меня от действий или высказываний.',
      'Я избегаю ситуаций в которых являюсь центром внимания.',
      'Неловкость или смущение в присутствии других людей причиняет мне сильное беспокойство.',
    ],
    maxRaw: 12,
    normalize: (rawSum) => Math.round((rawSum / 12) * 100),
  },

  // ─── ТИР 2: ЕЖЕНЕДЕЛЬНО ────────────────────────────────────────────────────

  gad7: {
    id: 'gad7',
    tier: 'weekly',
    dimension: 'anxiety',
    title: 'Тревога',
    subtitle: 'GAD-7 — 7 вопросов',
    intro: 'Оцени как часто за последние 2 недели тебя беспокоило каждое из следующих состояний.',
    scale: { min: 0, max: 3, labels: ['совсем нет', 'почти каждый день'] },
    scoring: 'sum',
    questions: [
      'Ощущение нервозности, тревожности или нахождения на грани срыва.',
      'Невозможность остановить беспокойство или взять его под контроль.',
      'Чрезмерное беспокойство по разным поводам.',
      'Сложность расслабиться.',
      'Такое беспокойство что сложно усидеть на месте.',
      'Лёгкая раздражительность или нервозность.',
      'Ощущение страха как будто может произойти что-то ужасное.',
    ],
    maxRaw: 21,
    normalize: (rawSum) => Math.round((rawSum / 21) * 100),
  },

  pss4: {
    id: 'pss4',
    tier: 'weekly',
    dimension: 'stress',
    title: 'Стресс',
    subtitle: 'PSS-4 — 4 вопроса',
    intro: 'Вопросы о твоих чувствах и мыслях за последний месяц.',
    scale: { min: 0, max: 4, labels: ['никогда', 'очень часто'] },
    scoring: 'sum_with_reverse',
    reverseItems: [2, 3], // индексы вопросов с обратной шкалой
    questions: [
      'Как часто ты расстраивался из-за чего-то неожиданного?',
      'Как часто ты чувствовал что не можешь контролировать важные вещи в своей жизни?',
      'Как часто ты чувствовал уверенность в своей способности справляться с личными проблемами?',
      'Как часто ты чувствовал что дела идут так как тебе хочется?',
    ],
    maxRaw: 16,
    normalize: (rawSum) => Math.round((rawSum / 16) * 100),
  },

  aes_short: {
    id: 'aes_short',
    tier: 'weekly',
    dimension: 'apathy',
    title: 'Апатия',
    subtitle: '5 вопросов',
    intro: 'Оцени своё состояние за последнюю неделю.',
    scale: { min: 1, max: 4, labels: ['совсем не так', 'именно так'] },
    scoring: 'sum',
    questions: [
      'Мне интересно заниматься привычными делами.',
      'Я делаю вещи в течение дня.',
      'Мне важно доделывать то что я начинаю.',
      'Мне хочется делать новые вещи.',
      'Мне важно то что происходит со мной.',
    ],
    maxRaw: 20,
    reverseAll: true, // все вопросы обратные — высокий балл = низкая апатия
    normalize: (rawSum) => {
      const inverted = 20 - rawSum + 5; // инвертируем: высокий исходный = низкая апатия
      return Math.round(Math.max(0, Math.min(100, (inverted / 20) * 100)));
    },
  },

  ucla3: {
    id: 'ucla3',
    tier: 'weekly',
    dimension: 'loneliness',
    title: 'Одиночество',
    subtitle: 'UCLA-3 — 3 вопроса',
    intro: 'Три вопроса о том как ты ощущаешь себя в отношениях с людьми.',
    scale: { min: 1, max: 3, labels: ['никогда', 'часто'] },
    scoring: 'sum',
    questions: [
      'Как часто ты чувствуешь что тебе не хватает общения?',
      'Как часто ты чувствуешь себя брошенным?',
      'Как часто ты чувствуешь себя изолированным от других?',
    ],
    maxRaw: 9,
    normalize: (rawSum) => Math.round(((rawSum - 3) / 6) * 100),
  },

  // ─── ТИР 3: ЕЖЕМЕСЯЧНО ─────────────────────────────────────────────────────

  olbi_short: {
    id: 'olbi_short',
    tier: 'monthly',
    dimension: 'burnout',
    title: 'Выгорание',
    subtitle: 'OLBI-Short — 8 вопросов',
    intro: 'Вопросы о твоей работе, учёбе или основной деятельности.',
    scale: { min: 1, max: 4, labels: ['полностью согласен', 'полностью не согласен'] },
    scoring: 'sum_with_reverse',
    reverseItems: [1, 3, 5, 7],
    questions: [
      'Во время работы я часто чувствую эмоциональное истощение.',
      'После работы мне нужно больше времени чем раньше чтобы расслабиться.',
      'Я могу терпеть давление своей работы хорошо.',
      'Во время работы я часто чувствую себя физически измотанным.',
      'Я нахожу свою работу трудной для выполнения.',
      'После работы у меня обычно достаточно сил для семьи и друзей.',
      'Работа для меня позитивный вызов.',
      'Во время работы я часто чувствую себя беспомощным.',
    ],
    maxRaw: 32,
    normalize: (rawSum) => Math.round((rawSum / 32) * 100),
  },

  rosenberg: {
    id: 'rosenberg',
    tier: 'monthly',
    dimension: 'self_esteem',
    title: 'Самооценка',
    subtitle: 'Шкала Розенберга — 10 вопросов',
    intro: 'Оцени насколько каждое утверждение подходит тебе.',
    scale: { min: 1, max: 4, labels: ['полностью не согласен', 'полностью согласен'] },
    scoring: 'sum_with_reverse',
    reverseItems: [1, 2, 4, 6, 7], // вопросы с обратной шкалой
    questions: [
      'В целом я доволен собой.',
      'Временами я думаю что я вообще ни на что не годен.',
      'Я думаю что у меня есть ряд хороших качеств.',
      'Я способен кое-что делать не хуже чем большинство людей.',
      'Я думаю что мне особо нечем гордиться.',
      'Я отношусь к себе с уважением.',
      'В целом я склонён считать что я неудачник.',
      'Мне бы хотелось больше уважать себя.',
      'Иногда я чувствую себя бесполезным.',
      'Временами я думаю что я во всём нехорош.',
    ],
    maxRaw: 40,
    // высокий исходный балл = высокая самооценка = НИЗКИЙ дистресс
    normalize: (rawSum) => Math.round(Math.max(0, 100 - ((rawSum - 10) / 30) * 100)),
  },
};

// Тир → порядок ротации для еженедельных тестов
export const WEEKLY_TEST_ROTATION = ['gad7', 'pss4', 'aes_short', 'ucla3'];

// Фразы для HomeScreen по доминирующему измерению
export const WEEKLY_PHRASES = {
  anxiety:        'Эта неделя была напряжённой. Ты справляешься.',
  stress:         'Много всего навалилось. Дай себе передохнуть.',
  loneliness:     'Последнее время ты больше наблюдаешь. Это нормально.',
  burnout:        'Похоже, ты устал. Не от лени — просто устал.',
  apathy:         'Сейчас всё кажется серым. Это пройдёт.',
  social_anxiety: 'Общение даётся непросто. Ты не один такой.',
  self_esteem:    'Ты справился с кое-чем на этой неделе. Замечаешь?',
  attachment:     'Близость пугает. Это честно — и с этим можно работать.',
  improving:      'Эта неделя чуть легче предыдущей.',
  ok:             'Ты в порядке. Так и держи.',
};

// Веса измерений в композитном скоре
export const DIMENSION_WEIGHTS = {
  anxiety:        0.20,
  stress:         0.20,
  apathy:         0.15,
  loneliness:     0.15,
  burnout:        0.10,
  self_esteem:    0.10,
  social_anxiety: 0.05,
  attachment:     0.05,
};

// Маппинг скора в уровень
export function scoreToLevel(compositeScore) {
  if (compositeScore <= 33) return 'green';
  if (compositeScore <= 66) return 'yellow';
  return 'red';
}
```

- [ ] **Шаг 2: Проверить что файл создан корректно**

```bash
node -e "const t = require('./ustal/utils/psychTests.js'); console.log(Object.keys(t.PSYCH_TESTS).length, 'тестов')"
```
Ожидаемый результат: `8 тестов`

- [ ] **Шаг 3: Commit**

```bash
git add ustal/utils/psychTests.js
git commit -m "Константы: 8 валидированных психологических тестов"
```

---

## Task 4: Экран PsychTestScreen

**Files:**
- Create: `ustal/screens/PsychTestScreen.js`
- Modify: `ustal/App.js` — добавить маршрут

- [ ] **Шаг 1: Создать экран**

Создать `ustal/screens/PsychTestScreen.js`:

```js
import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { supabase } from '../supabase';
import { store } from '../store';
import { colors, shared } from '../theme';
import { PSYCH_TESTS } from '../utils/psychTests';

export default function PsychTestScreen({ route, navigation }) {
  const { testId, onComplete } = route.params;
  const test = PSYCH_TESTS[testId];
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const scaleOptions = [];
  for (let v = test.scale.min; v <= test.scale.max; v++) scaleOptions.push(v);

  const handleAnswer = async (value) => {
    const newAnswers = [...answers, value];
    setAnswers(newAnswers);

    if (current + 1 < test.questions.length) {
      setCurrent(current + 1);
      return;
    }

    setSaving(true);
    const rawScore = computeRaw(test, newAnswers);
    const normalizedScore = test.normalize(rawScore);

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('psych_test_results').insert({
        user_id: user.id,
        test_id: test.id,
        dimension: test.dimension,
        raw_score: rawScore,
        normalized_score: normalizedScore,
        answers: newAnswers,
      });
    }
    setSaving(false);
    setDone(true);
  };

  if (done) {
    return (
      <View style={styles.container}>
        <Text style={styles.doneTitle}>Готово</Text>
        <Text style={styles.doneSub}>Ответы сохранены. Спасибо.</Text>
        <TouchableOpacity
          style={[shared.button, { marginTop: 32 }]}
          onPress={() => { if (onComplete) onComplete(); navigation.goBack(); }}
        >
          <Text style={shared.buttonText}>Продолжить</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (saving) return <ActivityIndicator style={{ flex: 1 }} color={colors.accent} />;

  const q = test.questions[current];
  const progress = (current + 1) / test.questions.length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.testTitle}>{test.title}</Text>
      <Text style={styles.testSubtitle}>{test.subtitle}</Text>

      {current === 0 && (
        <Text style={styles.intro}>{test.intro}</Text>
      )}

      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>
      <Text style={styles.progressText}>{current + 1} / {test.questions.length}</Text>

      <Text style={styles.question}>{q}</Text>

      <View style={styles.scaleRow}>
        <Text style={styles.scaleLabel}>{test.scale.labels[0]}</Text>
        <Text style={styles.scaleLabel}>{test.scale.labels[1]}</Text>
      </View>
      <View style={styles.optionsRow}>
        {scaleOptions.map(v => (
          <TouchableOpacity
            key={v}
            style={styles.optionBtn}
            onPress={() => handleAnswer(v)}
            activeOpacity={0.7}
          >
            <Text style={styles.optionText}>{v}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

function computeRaw(test, answers) {
  if (test.scoring === 'mean') {
    return answers.reduce((s, v) => s + v, 0) / answers.length;
  }
  if (test.scoring === 'sum_with_reverse') {
    const maxVal = test.scale.max;
    const minVal = test.scale.min;
    return answers.reduce((s, v, i) => {
      const val = test.reverseItems?.includes(i) ? (maxVal + minVal - v) : v;
      return s + val;
    }, 0);
  }
  return answers.reduce((s, v) => s + v, 0);
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 24, paddingBottom: 48 },
  testTitle: { fontSize: 22, fontWeight: '700', color: colors.white, marginBottom: 4 },
  testSubtitle: { fontSize: 14, color: colors.muted, marginBottom: 16 },
  intro: { fontSize: 15, color: colors.white, opacity: 0.75, marginBottom: 20, lineHeight: 22 },
  progressBar: { height: 4, backgroundColor: colors.border, borderRadius: 2, marginBottom: 8 },
  progressFill: { height: 4, backgroundColor: colors.accent, borderRadius: 2 },
  progressText: { fontSize: 12, color: colors.muted, marginBottom: 24, textAlign: 'right' },
  question: { fontSize: 17, color: colors.white, lineHeight: 26, marginBottom: 32, fontWeight: '500' },
  scaleRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  scaleLabel: { fontSize: 11, color: colors.muted, maxWidth: 100 },
  optionsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  optionBtn: {
    flex: 1, aspectRatio: 1, backgroundColor: colors.card,
    borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  optionText: { fontSize: 16, fontWeight: '600', color: colors.white },
  doneTitle: { fontSize: 26, fontWeight: '700', color: colors.white, textAlign: 'center', marginTop: 80 },
  doneSub: { fontSize: 16, color: colors.muted, textAlign: 'center', marginTop: 12 },
});
```

- [ ] **Шаг 2: Добавить маршрут в App.js**

В `ustal/App.js` добавить импорт после существующих импортов экранов:
```js
import PsychTestScreen from './screens/PsychTestScreen';
```

В Stack.Navigator добавить маршрут (рядом с другими экранами поверх табов):
```jsx
<Stack.Screen name="PsychTest" component={PsychTestScreen} options={{ headerShown: false }} />
```

- [ ] **Шаг 3: Проверить вручную**

Запустить `npm start` из `ustal/`. Убедиться что приложение компилируется без ошибок.

- [ ] **Шаг 4: Commit**

```bash
git add ustal/screens/PsychTestScreen.js ustal/App.js
git commit -m "Экран: PsychTestScreen — прохождение валидированных тестов"
```

---

## Task 5: Профильные тесты при онбординге

**Files:**
- Modify: `ustal/screens/OnboardingMomentScreen.js` — добавить предложение пройти профильные тесты

- [ ] **Шаг 1: Прочитать текущий OnboardingMomentScreen**

```bash
cat ustal/screens/OnboardingMomentScreen.js
```

- [ ] **Шаг 2: Добавить кнопку «Узнать свой стиль» в конце онбординга**

В конце экрана OnboardingMomentScreen, перед кнопкой «Перейти в приложение», добавить блок:

```jsx
<TouchableOpacity
  style={[shared.button, { marginBottom: 12, backgroundColor: colors.card }]}
  onPress={() => navigation.navigate('PsychTest', {
    testId: 'ecr_short',
    onComplete: () => navigation.navigate('PsychTest', {
      testId: 'mini_spin',
      onComplete: () => navigation.navigate('Main'),
    }),
  })}
>
  <Text style={[shared.buttonText, { color: colors.accent }]}>
    Пройти тест на стиль общения (2 мин)
  </Text>
</TouchableOpacity>
```

Кнопку «Перейти в приложение» оставить как есть — пользователь может пропустить.

- [ ] **Шаг 3: Проверить вручную**

Зарегистрировать тестового пользователя, пройти тест → убедиться что онбординг предлагает профильные тесты и после них уходит на Main.

- [ ] **Шаг 4: Commit**

```bash
git add ustal/screens/OnboardingMomentScreen.js
git commit -m "Онбординг: предложение профильных тестов ECR-Short + Mini-SPIN"
```

---

## Task 6: Утилита подбора следующего теста

**Files:**
- Create: `ustal/utils/psychScheduler.js`

- [ ] **Шаг 1: Создать утилиту**

Создать `ustal/utils/psychScheduler.js`:

```js
import { supabase } from '../supabase';
import { PSYCH_TESTS, WEEKLY_TEST_ROTATION } from './psychTests';

// Возвращает testId следующего теста для пользователя или null если ничего не нужно
export async function getNextTestId(userId) {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=вс, 1=пн...
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - dayOfWeek);
  startOfWeek.setHours(0, 0, 0, 0);

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Получить все прохождения за этот месяц
  const { data: results } = await supabase
    .from('psych_test_results')
    .select('test_id, created_at')
    .eq('user_id', userId)
    .gte('created_at', startOfMonth.toISOString())
    .order('created_at', { ascending: false });

  const passedThisMonth = new Set((results || []).map(r => r.test_id));
  const passedThisWeek = new Set(
    (results || [])
      .filter(r => new Date(r.created_at) >= startOfWeek)
      .map(r => r.test_id)
  );

  // Проверить ежемесячные — показываем в первые 3 дня месяца
  if (now.getDate() <= 3) {
    for (const tid of ['olbi_short', 'rosenberg']) {
      if (!passedThisMonth.has(tid)) return tid;
    }
  }

  // Проверить профильные — показываем если ни разу не проходил
  const { data: allResults } = await supabase
    .from('psych_test_results')
    .select('test_id')
    .eq('user_id', userId)
    .in('test_id', ['ecr_short', 'mini_spin']);

  const passedEver = new Set((allResults || []).map(r => r.test_id));
  for (const tid of ['ecr_short', 'mini_spin']) {
    if (!passedEver.has(tid)) return tid;
  }

  // Проверить еженедельные — показываем один тест в неделю
  if (passedThisWeek.size < 1) {
    // Ротация: выбираем тот что дольше всего не проходили
    const lastPassed = {};
    for (const r of (results || [])) {
      if (WEEKLY_TEST_ROTATION.includes(r.test_id) && !lastPassed[r.test_id]) {
        lastPassed[r.test_id] = new Date(r.created_at);
      }
    }
    const sorted = WEEKLY_TEST_ROTATION.sort((a, b) => {
      const ta = lastPassed[a] || new Date(0);
      const tb = lastPassed[b] || new Date(0);
      return ta - tb;
    });
    return sorted[0];
  }

  return null; // всё на этой неделе сделано
}
```

- [ ] **Шаг 2: Commit**

```bash
git add ustal/utils/psychScheduler.js
git commit -m "Утилита: планировщик психологических тестов"
```

---

## Task 7: Блок «тест недели» на HomeScreen

**Files:**
- Modify: `ustal/screens/HomeScreen.js`

- [ ] **Шаг 1: Добавить импорты в HomeScreen.js**

В начало файла добавить:
```js
import { getNextTestId } from '../utils/psychScheduler';
import { PSYCH_TESTS } from '../utils/psychTests';
```

- [ ] **Шаг 2: Добавить state**

После существующих useState-объявлений добавить:
```js
const [nextTestId, setNextTestId] = useState(null);
```

- [ ] **Шаг 3: Загрузить следующий тест в useEffect**

В существующий useEffect (где загружаются данные пользователя) добавить:
```js
const testId = await getNextTestId(user.id);
setNextTestId(testId);
```

- [ ] **Шаг 4: Добавить карточку теста перед секцией «Модули»**

Найти строку `<Text style={styles.sectionTitle}>Модули</Text>` и добавить перед ней:

```jsx
{nextTestId && PSYCH_TESTS[nextTestId] && (
  <TouchableOpacity
    style={styles.testPromptCard}
    onPress={() => navigation.navigate('PsychTest', {
      testId: nextTestId,
      onComplete: () => setNextTestId(null),
    })}
    activeOpacity={0.8}
  >
    <Ionicons name="flask-outline" size={20} color={colors.accent} />
    <View style={{ flex: 1, marginLeft: 12 }}>
      <Text style={styles.testPromptTitle}>
        {PSYCH_TESTS[nextTestId].title}
      </Text>
      <Text style={styles.testPromptSub}>
        {PSYCH_TESTS[nextTestId].subtitle} · займёт пару минут
      </Text>
    </View>
    <Ionicons name="chevron-forward" size={16} color={colors.muted} />
  </TouchableOpacity>
)}
```

- [ ] **Шаг 5: Добавить стили**

В StyleSheet.create добавить:
```js
testPromptCard: {
  backgroundColor: colors.card,
  borderRadius: 16,
  padding: 16,
  flexDirection: 'row',
  alignItems: 'center',
  marginBottom: 16,
  borderWidth: 1,
  borderColor: colors.border,
},
testPromptTitle: {
  fontSize: 15,
  fontWeight: '600',
  color: colors.white,
},
testPromptSub: {
  fontSize: 12,
  color: colors.muted,
  marginTop: 2,
},
```

- [ ] **Шаг 6: Проверить вручную**

Открыть HomeScreen — карточка теста должна появляться если есть незакрытый тест.

- [ ] **Шаг 7: Commit**

```bash
git add ustal/screens/HomeScreen.js
git commit -m "HomeScreen: карточка следующего психологического теста"
```

---

## Task 8: Edge Function compute-weekly-profile

**Files:**
- Create: `supabase/functions/compute-weekly-profile/index.ts`

- [ ] **Шаг 1: Создать папку**

```bash
mkdir -p /Users/user/Zface/supabase/functions/compute-weekly-profile
```

- [ ] **Шаг 2: Создать Edge Function**

Создать `supabase/functions/compute-weekly-profile/index.ts`:

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const DIMENSION_WEIGHTS: Record<string, number> = {
  anxiety:        0.20,
  stress:         0.20,
  apathy:         0.15,
  loneliness:     0.15,
  burnout:        0.10,
  self_esteem:    0.10,
  social_anxiety: 0.05,
  attachment:     0.05,
};

function scoreToLevel(score: number): string {
  if (score <= 33) return 'green';
  if (score <= 66) return 'yellow';
  return 'red';
}

function normalize0to100(value: number, min: number, max: number): number {
  if (max === min) return 0;
  return Math.round(Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100)));
}

Deno.serve(async () => {
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // начало этой недели
  weekStart.setHours(0, 0, 0, 0);
  const weekStartStr = weekStart.toISOString().split('T')[0];
  const weekStartIso = weekStart.toISOString();

  // Получить всех пользователей
  const { data: users, error: usersErr } = await supabase
    .from('users')
    .select('user_id');
  if (usersErr) return new Response(JSON.stringify({ error: usersErr.message }), { status: 500 });

  let processed = 0;

  for (const user of users ?? []) {
    const uid = user.user_id;

    // ── 1. Тестовые баллы (последние за каждое измерение за 30 дней) ──────────
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const { data: testResults } = await supabase
      .from('psych_test_results')
      .select('dimension, normalized_score, created_at')
      .eq('user_id', uid)
      .gte('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: false });

    const testScores: Record<string, number> = {};
    for (const r of testResults ?? []) {
      if (!testScores[r.dimension]) testScores[r.dimension] = r.normalized_score;
    }

    // ── 2. Поведенческие метрики за эту неделю ────────────────────────────────
    const { count: msgCount } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('sender_id', uid)
      .gte('created_at', weekStartIso);

    const { data: dmData } = await supabase
      .from('direct_messages')
      .select('conversation_id')
      .eq('sender_id', uid)
      .gte('created_at', weekStartIso);
    const uniqueConversations = new Set((dmData ?? []).map(d => d.conversation_id)).size;

    const { data: nightMsgs } = await supabase
      .from('messages')
      .select('created_at')
      .eq('sender_id', uid)
      .gte('created_at', weekStartIso);
    const nightCount = (nightMsgs ?? []).filter(m => {
      const h = new Date(m.created_at).getHours();
      return h >= 0 && h < 5;
    }).length;

    const { count: checkinCount } = await supabase
      .from('mood_checkins')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', uid)
      .gte('checkin_date', weekStartStr);

    const { data: checkinData } = await supabase
      .from('mood_checkins')
      .select('score')
      .eq('user_id', uid)
      .gte('checkin_date', weekStartStr)
      .order('checkin_date', { ascending: true });
    const checkinScores = (checkinData ?? []).map(c => c.score);
    const checkinTrend = checkinScores.length >= 2
      ? checkinScores[checkinScores.length - 1] - checkinScores[0]
      : 0;

    const { count: helpsCount } = await supabase
      .from('user_helps')
      .select('*', { count: 'exact', head: true })
      .eq('helped_id', uid)
      .gte('created_at', weekStartIso);

    // ── 3. Поведенческие скоры → 0-100 ────────────────────────────────────────
    const behavioralScores: Record<string, number> = {
      // Высокая ночная активность → высокая тревога
      anxiety: normalize0to100(nightCount, 0, 10),
      // Высокий стресс → мало сообщений + мало чекинов
      stress: normalize0to100(Math.max(0, 7 - (checkinCount ?? 0)), 0, 7),
      // Одиночество → мало уникальных собеседников
      loneliness: normalize0to100(Math.max(0, 5 - uniqueConversations), 0, 5),
      // Апатия → мало активных дней
      apathy: normalize0to100(Math.max(0, 7 - (msgCount ?? 0 > 0 ? Math.min(7, msgCount!) : 0)), 0, 7),
      // Самооценка → много «помог»
      self_esteem: Math.max(0, 100 - normalize0to100(helpsCount ?? 0, 0, 5)),
      // Тренд чекинов — если падает → выгорание
      burnout: checkinTrend < -2 ? 70 : checkinTrend < 0 ? 40 : 20,
      social_anxiety: normalize0to100(Math.max(0, 10 - (msgCount ?? 0)), 0, 10),
      attachment: testScores['attachment'] ?? 50,
    };

    // ── 4. Итоговый балл по каждому измерению (60% тест + 40% поведение) ─────
    const dimensionScores: Record<string, number> = {};
    for (const dim of Object.keys(DIMENSION_WEIGHTS)) {
      const testScore = testScores[dim] ?? behavioralScores[dim] ?? 50;
      const behavScore = behavioralScores[dim] ?? testScore;
      const hasTest = testScores[dim] !== undefined;
      dimensionScores[dim] = Math.round(
        hasTest ? testScore * 0.6 + behavScore * 0.4 : behavScore
      );
    }

    // ── 5. Композитный скор ───────────────────────────────────────────────────
    let composite = 0;
    for (const [dim, weight] of Object.entries(DIMENSION_WEIGHTS)) {
      composite += (dimensionScores[dim] ?? 50) * weight;
    }
    composite = Math.round(composite);

    const dominant = Object.entries(dimensionScores)
      .sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'stress';

    const level = scoreToLevel(composite);

    // ── 6. Записать снапшот ────────────────────────────────────────────────────
    await supabase.from('user_metrics').upsert({
      user_id: uid,
      week_start: weekStartStr,
      anxiety_score: dimensionScores.anxiety,
      stress_score: dimensionScores.stress,
      apathy_score: dimensionScores.apathy,
      loneliness_score: dimensionScores.loneliness,
      burnout_score: dimensionScores.burnout,
      self_esteem_score: dimensionScores.self_esteem,
      social_anxiety_score: dimensionScores.social_anxiety,
      attachment_score: dimensionScores.attachment,
      composite_score: composite,
      dominant_dimension: dominant,
      level,
    }, { onConflict: 'user_id,week_start' });

    // ── 7. Обновить users.level ────────────────────────────────────────────────
    await supabase.from('users').update({ level }).eq('user_id', uid);

    processed++;
  }

  return new Response(JSON.stringify({ processed, weekStart: weekStartStr }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
```

- [ ] **Шаг 3: Задеплоить Edge Function через mcp__supabase__deploy_edge_function**

Задеплоить функцию `compute-weekly-profile` с содержимым файла выше.

- [ ] **Шаг 4: Настроить расписание (pg_cron)**

Выполнить SQL через mcp__supabase__apply_migration:
```sql
-- Включить pg_cron если не включён
SELECT cron.schedule(
  'weekly-profile-compute',
  '0 3 * * 0',  -- каждое воскресенье в 03:00
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/compute-weekly-profile',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

- [ ] **Шаг 5: Commit**

```bash
git add supabase/functions/compute-weekly-profile/index.ts
git commit -m "Edge Function: compute-weekly-profile — еженедельный подсчёт метрик"
```

---

## Task 9: ResourcesScreen — персональные рекомендации

**Files:**
- Modify: `ustal/screens/ResourcesScreen.js`

- [ ] **Шаг 1: Обновить ResourcesScreen**

Заменить содержимое `ustal/screens/ResourcesScreen.js` на:

```js
import {
  StyleSheet, Text, View, TouchableOpacity, ScrollView,
  Linking, Animated, LayoutAnimation, Platform, UIManager, ActivityIndicator,
} from 'react-native';
import { useRef, useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../supabase';
import { store } from '../store';
import { colors } from '../theme';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

const TOPIC_META = {
  anxiety:        { label: 'Тревога',               icon: 'pulse-outline',       color: '#E8A838' },
  depression:     { label: 'Апатия и депрессия',     icon: 'cloud-outline',       color: '#7B9BD5' },
  burnout:        { label: 'Выгорание',              icon: 'flame-outline',       color: '#E07060' },
  loneliness:     { label: 'Одиночество',            icon: 'person-outline',      color: '#9B7BD5' },
  self_esteem:    { label: 'Самооценка',             icon: 'star-outline',        color: '#60B8A0' },
  stress:         { label: 'Стресс',                 icon: 'thunderstorm-outline',color: '#D57B60' },
  attachment:     { label: 'Отношения',              icon: 'heart-outline',       color: '#D56080' },
  social_anxiety: { label: 'Социальная тревожность', icon: 'people-outline',      color: '#80A0D5' },
};

export default function ResourcesScreen() {
  const [loading, setLoading] = useState(true);
  const [recommended, setRecommended] = useState([]);
  const [byTopic, setByTopic] = useState({});
  const [openTopics, setOpenTopics] = useState({});
  const animations = useRef({});

  useFocusEffect(useCallback(() => {
    loadResources();
  }, []));

  const loadResources = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();

    // Получить ресурсы
    const { data: resources } = await supabase
      .from('resources')
      .select('*');

    if (!resources) { setLoading(false); return; }

    // Получить метрики пользователя (последний снапшот)
    let userMetrics = null;
    if (user) {
      const { data: m } = await supabase
        .from('user_metrics')
        .select('*')
        .eq('user_id', user.id)
        .order('week_start', { ascending: false })
        .limit(1)
        .maybeSingle();
      userMetrics = m;
    }

    // Подсчитать релевантность
    const scored = resources.map(r => {
      let score = 0;
      if (userMetrics && r.dimension_weights) {
        const weights = r.dimension_weights;
        const dimMap = {
          anxiety: userMetrics.anxiety_score,
          stress: userMetrics.stress_score,
          apathy: userMetrics.apathy_score,
          loneliness: userMetrics.loneliness_score,
          burnout: userMetrics.burnout_score,
          self_esteem: userMetrics.self_esteem_score,
          social_anxiety: userMetrics.social_anxiety_score,
          attachment: userMetrics.attachment_score,
        };
        for (const [dim, weight] of Object.entries(weights)) {
          score += (dimMap[dim] ?? 50) * (weight as number);
        }
      }
      return { ...r, relevanceScore: score };
    });

    // Топ-5 рекомендованных
    const top5 = [...scored]
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 5);
    setRecommended(top5);

    // Сгруппировать по темам
    const grouped: Record<string, typeof scored> = {};
    for (const r of scored) {
      if (!grouped[r.topic]) grouped[r.topic] = [];
      grouped[r.topic].push(r);
    }
    setByTopic(grouped);
    setLoading(false);
  };

  const toggleTopic = (topicId) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenTopics(prev => ({ ...prev, [topicId]: !prev[topicId] }));
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color={colors.accent} />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>Материалы</Text>

      {recommended.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Для тебя сейчас</Text>
          {recommended.map(item => (
            <ResourceItem key={item.id} item={item} />
          ))}
        </View>
      )}

      <Text style={styles.sectionTitle}>Другие темы</Text>
      {Object.entries(byTopic).map(([topicId, items]) => {
        const meta = TOPIC_META[topicId] || { label: topicId, icon: 'book-outline', color: colors.accent };
        const isOpen = openTopics[topicId];
        return (
          <View key={topicId} style={styles.topicBlock}>
            <TouchableOpacity style={styles.topicHeader} onPress={() => toggleTopic(topicId)} activeOpacity={0.7}>
              <Ionicons name={meta.icon as any} size={20} color={meta.color} />
              <Text style={styles.topicLabel}>{meta.label}</Text>
              <Text style={styles.topicCount}>{items.length}</Text>
              <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.muted} />
            </TouchableOpacity>
            {isOpen && items.map(item => <ResourceItem key={item.id} item={item} />)}
          </View>
        );
      })}
    </ScrollView>
  );
}

function ResourceItem({ item }) {
  return (
    <TouchableOpacity style={styles.item} onPress={() => Linking.openURL(item.url)} activeOpacity={0.7}>
      <Ionicons
        name={item.type === 'video' ? 'play-circle-outline' : 'document-text-outline'}
        size={18}
        color={colors.accent}
        style={{ marginRight: 10 }}
      />
      <Text style={styles.itemTitle}>{item.title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 48 },
  header: { fontSize: 26, fontWeight: '700', color: colors.white, marginBottom: 24 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: colors.white, marginBottom: 12 },
  topicBlock: { backgroundColor: colors.card, borderRadius: 16, marginBottom: 12, overflow: 'hidden' },
  topicHeader: {
    flexDirection: 'row', alignItems: 'center', padding: 16, gap: 10,
  },
  topicLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.white },
  topicCount: { fontSize: 12, color: colors.muted, marginRight: 4 },
  item: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  itemTitle: { flex: 1, fontSize: 14, color: colors.white, lineHeight: 20 },
});
```

- [ ] **Шаг 2: Проверить вручную**

Открыть ResourcesScreen — должна загружаться секция «Для тебя сейчас» (если есть метрики) и аккордеон «Другие темы».

- [ ] **Шаг 3: Commit**

```bash
git add ustal/screens/ResourcesScreen.js
git commit -m "ResourcesScreen: персональные рекомендации из Supabase"
```

---

## Task 10: HomeScreen — еженедельная карточка состояния

**Files:**
- Modify: `ustal/screens/HomeScreen.js`

- [ ] **Шаг 1: Добавить импорт**

```js
import { WEEKLY_PHRASES } from '../utils/psychTests';
```

- [ ] **Шаг 2: Добавить state для метрик**

```js
const [weeklyInsight, setWeeklyInsight] = useState(null);
```

- [ ] **Шаг 3: Загрузить метрики в useEffect**

В существующий useEffect после загрузки пользователя добавить:

```js
const { data: metrics } = await supabase
  .from('user_metrics')
  .select('dominant_dimension, composite_score, level')
  .eq('user_id', user.id)
  .order('week_start', { ascending: false })
  .limit(1)
  .maybeSingle();

if (metrics) {
  const dim = metrics.dominant_dimension;
  const phrase = WEEKLY_PHRASES[dim] || WEEKLY_PHRASES.ok;
  setWeeklyInsight(phrase);
}
```

- [ ] **Шаг 4: Добавить карточку перед «Модули»**

Перед `<Text style={styles.sectionTitle}>Модули</Text>` добавить:

```jsx
{weeklyInsight && (
  <View style={styles.weeklyInsightCard}>
    <Text style={styles.weeklyInsightText}>{weeklyInsight}</Text>
    <TouchableOpacity
      onPress={() => navigation.navigate('Resources')}
      style={styles.weeklyInsightBtn}
    >
      <Text style={styles.weeklyInsightBtnText}>Материалы для тебя</Text>
      <Ionicons name="arrow-forward" size={14} color={colors.accent} />
    </TouchableOpacity>
  </View>
)}
```

- [ ] **Шаг 5: Добавить стили**

```js
weeklyInsightCard: {
  backgroundColor: colors.card,
  borderRadius: 16,
  padding: 18,
  marginBottom: 16,
  borderLeftWidth: 3,
  borderLeftColor: colors.accent,
},
weeklyInsightText: {
  fontSize: 15,
  color: colors.white,
  lineHeight: 22,
  marginBottom: 12,
},
weeklyInsightBtn: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 6,
},
weeklyInsightBtnText: {
  fontSize: 13,
  color: colors.accent,
  fontWeight: '600',
},
```

- [ ] **Шаг 6: Проверить вручную**

HomeScreen должен показывать карточку с фразой если в user_metrics есть снапшот для пользователя.

- [ ] **Шаг 7: Финальный commit**

```bash
git add ustal/screens/HomeScreen.js
git commit -m "HomeScreen: еженедельная карточка состояния с переходом на материалы"
```

---

## Что проверить после реализации всех тасков

1. Зарегистрировать нового пользователя → убедиться что онбординг предлагает профильные тесты
2. Пройти ECR-Short + Mini-SPIN → проверить записи в `psych_test_results`
3. На HomeScreen видна карточка «следующий тест»
4. Пройти GAD-7 → запись в `psych_test_results` с `dimension = 'anxiety'`
5. Вызвать Edge Function вручную через Supabase Dashboard → проверить что `user_metrics` обновился
6. После обновления метрик открыть ResourcesScreen → секция «Для тебя сейчас» показывает релевантные материалы
7. Карточка на HomeScreen показывает правильную фразу по `dominant_dimension`
