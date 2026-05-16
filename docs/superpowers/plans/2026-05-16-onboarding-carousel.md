# Онбординг-карусель — План реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Показывать новому пользователю карусель из 5 слайдов после первого теста — знакомство с ключевыми функциями приложения.

**Architecture:** Новый экран `OnboardingCarouselScreen` встраивается между `OnboardingMomentScreen` и `Main`. Слайды рендерятся как React Native компоненты (не PNG — проще обновлять, не нужен отдельный шаг захвата скриншотов). Состояние «видел онбординг» хранится в `users.onboarding_seen`.

**Tech Stack:** React Native 0.81, Expo 54, Supabase JS v2, React Navigation v7.

---

## Структура файлов

| Действие | Файл | Что меняется |
|----------|------|-------------|
| Создать | `ustal/screens/OnboardingCarouselScreen.js` | Новый экран карусели |
| Изменить | `ustal/App.js` | Регистрация экрана, добавить `onboarding_seen` в select |
| Изменить | `ustal/screens/OnboardingMomentScreen.js` | После done → navigate OnboardingCarousel |
| Изменить | `ustal/screens/ProfileScreen.js` | Кнопка «как пользоваться» |
| Миграция | Supabase dashboard / CLI | `onboarding_seen BOOLEAN DEFAULT false` |

---

## Task 1: Миграция БД

**Files:**
- Run SQL in Supabase dashboard

- [ ] **Step 1: Добавить колонку**

Открой Supabase Dashboard → SQL Editor, выполни:

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_seen BOOLEAN DEFAULT false;
```

- [ ] **Step 2: Проверить**

```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'users' AND column_name = 'onboarding_seen';
```

Ожидаемый результат: строка с `boolean`, `false`.

- [ ] **Step 3: Commit**

```bash
git commit --allow-empty -m "feat(db): добавить колонку users.onboarding_seen"
```

---

## Task 2: OnboardingCarouselScreen

**Files:**
- Create: `ustal/screens/OnboardingCarouselScreen.js`

- [ ] **Step 1: Создать файл с данными слайдов и структурой**

`ustal/screens/OnboardingCarouselScreen.js`:

```js
import { useRef, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, Dimensions, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../supabase';
import { store } from '../store';
import { colors } from '../theme';

const SLIDES = [
  {
    key: '1',
    title: 'Найди своих',
    desc: 'Лента и комнаты — только для людей с твоим уровнем. Здесь не притворяются.',
  },
  {
    key: '2',
    title: 'Поговори',
    desc: 'Комнаты по уровню, глобальный чат и @один — ИИ, который просто слушает.',
  },
  {
    key: '3',
    title: 'Выдохни',
    desc: 'Коробочное дыхание, медитативная рыбалка и анонимные мысли — когда слов нет.',
  },
  {
    key: '4',
    title: 'Следи за собой',
    desc: 'Тест раз в сутки определяет твой уровень. Динамика видна — становится лучше или хуже.',
  },
  {
    key: '5',
    title: 'Приложение учится вместе с тобой',
    desc: 'Мы анализируем твою активность — и подстраиваем рекомендации, контент и подсказки именно под тебя.',
  },
];
```

- [ ] **Step 2: Добавить компоненты-иллюстрации для каждого слайда**

Добавить после `SLIDES` в тот же файл:

```js
function SlideVisual1() {
  return (
    <View style={vis.wrap}>
      {[
        { name: 'А', color: '#c9a96e', text: 'сегодня просто не могу заставить себя выйти из дома' },
        { name: 'М', color: '#AA7C00', text: 'кто-нибудь ещё чувствует что устал от всего' },
      ].map((item, i) => (
        <View key={i} style={vis.card}>
          <View style={[vis.avatar, { backgroundColor: item.color }]}>
            <Text style={vis.avatarText}>{item.name}</Text>
          </View>
          <Text style={vis.cardText}>{item.text}</Text>
        </View>
      ))}
    </View>
  );
}

function SlideVisual2() {
  return (
    <View style={vis.wrap}>
      <View style={vis.card}>
        <View style={[vis.avatar, { backgroundColor: '#c9a96e' }]}>
          <Text style={[vis.avatarText, { fontSize: 14 }]}>✦</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[vis.cardText, { fontWeight: '700' }]}>@один</Text>
          <Text style={[vis.cardText, { color: colors.muted, fontSize: 11 }]}>я здесь каждый день</Text>
        </View>
      </View>
      <View style={{ paddingHorizontal: 12, gap: 6 }}>
        <View style={vis.bubble}>
          <Text style={vis.bubbleText}>как ты сейчас?</Text>
        </View>
        <View style={[vis.bubble, vis.bubbleRight]}>
          <Text style={[vis.bubbleText, { color: colors.white }]}>не очень. просто устал</Text>
        </View>
      </View>
    </View>
  );
}

function SlideVisual3() {
  return (
    <View style={vis.wrap}>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
        <View style={[vis.card, { flex: 1, alignItems: 'center' }]}>
          <Ionicons name="radio-button-on-outline" size={28} color={colors.accent} />
          <Text style={[vis.cardText, { marginTop: 4 }]}>дыхание</Text>
        </View>
        <View style={[vis.card, { flex: 1, alignItems: 'center' }]}>
          <Ionicons name="fish-outline" size={28} color={colors.accent} />
          <Text style={[vis.cardText, { marginTop: 4 }]}>рыбалка</Text>
        </View>
      </View>
      <View style={vis.card}>
        <Text style={[vis.cardText, { color: colors.muted, fontSize: 10, marginBottom: 4 }]}>АНОНИМНАЯ МЫСЛЬ ДНЯ</Text>
        <Text style={[vis.cardText, { fontStyle: 'italic' }]}>«иногда просто хочется чтобы кто-то спросил как дела»</Text>
      </View>
    </View>
  );
}

function SlideVisual4() {
  const bars = [
    { h: 30, color: '#5DAA72' },
    { h: 60, color: '#AA7C00' },
    { h: 70, color: '#AA7C00' },
    { h: 100, color: '#c0392b' },
    { h: 90, color: '#c0392b' },
    { h: 65, color: '#AA7C00' },
    { h: 55, color: '#AA7C00' },
  ];
  return (
    <View style={vis.wrap}>
      <View style={vis.card}>
        <Text style={[vis.cardText, { color: colors.muted, fontSize: 10, marginBottom: 8 }]}>ИСТОРИЯ УРОВНЕЙ</Text>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 48, gap: 4 }}>
          {bars.map((b, i) => (
            <View key={i} style={{ flex: 1, height: `${b.h}%`, backgroundColor: b.color, borderRadius: 4 }} />
          ))}
        </View>
      </View>
      <View style={[vis.card, { flexDirection: 'row', justifyContent: 'space-between' }]}>
        <View>
          <Text style={[vis.cardText, { color: colors.muted, fontSize: 10 }]}>сейчас</Text>
          <Text style={[vis.cardText, { fontWeight: '700', color: '#AA7C00' }]}>жёлтый</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[vis.cardText, { color: colors.muted, fontSize: 10 }]}>динамика</Text>
          <Text style={[vis.cardText, { fontWeight: '700', color: '#5DAA72' }]}>↑ лучше</Text>
        </View>
      </View>
    </View>
  );
}

function SlideVisual5() {
  return (
    <View style={vis.wrap}>
      <View style={vis.card}>
        <Text style={[vis.cardText, { color: colors.muted, fontSize: 10, marginBottom: 8 }]}>ДЛЯ ТЕБЯ СЕЙЧАС</Text>
        {[1, 2, 3].map(i => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent }} />
            <View style={{ flex: 1, height: 8, backgroundColor: '#F0E8D8', borderRadius: 4, width: `${90 - i * 10}%` }} />
          </View>
        ))}
      </View>
      <View style={vis.card}>
        <Text style={[vis.cardText, { color: colors.muted, fontSize: 10, marginBottom: 4 }]}>@один знает что тебе нужно</Text>
        <Text style={vis.cardText}>Твои паттерны → персональные советы и контент</Text>
      </View>
    </View>
  );
}

const VISUALS = [SlideVisual1, SlideVisual2, SlideVisual3, SlideVisual4, SlideVisual5];

const vis = StyleSheet.create({
  wrap: { padding: 12, gap: 8 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E8DFD0',
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  avatar: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  cardText: { fontSize: 12, color: colors.white, lineHeight: 17, flex: 1 },
  bubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#F0E8D8',
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    maxWidth: '80%',
  },
  bubbleRight: {
    alignSelf: 'flex-end',
    backgroundColor: '#c9a96e',
  },
  bubbleText: { fontSize: 12, color: colors.white, lineHeight: 17 },
});
```

- [ ] **Step 3: Добавить основной компонент экрана**

Добавить в конец файла:

```js
export default function OnboardingCarouselScreen({ navigation }) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const flatRef = useRef(null);
  const [current, setCurrent] = useState(0);

  const goNext = async () => {
    if (current < SLIDES.length - 1) {
      const next = current + 1;
      flatRef.current?.scrollToIndex({ index: next, animated: true });
      setCurrent(next);
    } else {
      await supabase
        .from('users')
        .update({ onboarding_seen: true })
        .eq('user_id', store.userId);
      navigation.replace('Main');
    }
  };

  const renderSlide = ({ item, index }) => {
    const Visual = VISUALS[index];
    const isLast = index === SLIDES.length - 1;
    return (
      <View style={[styles.slide, { width }]}>
        <View style={styles.visualArea}>
          <Visual />
        </View>
        <View style={[styles.textArea, { paddingBottom: insets.bottom + 16 }]}>
          <Text style={styles.slideNum}>{String(index + 1).padStart(2, '0')} / {SLIDES.length}</Text>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.desc}>{item.desc}</Text>
          <View style={styles.footer}>
            <View style={styles.dots}>
              {SLIDES.map((_, i) => (
                <View key={i} style={[styles.dot, i === current && styles.dotActive]} />
              ))}
            </View>
            <TouchableOpacity style={styles.btn} onPress={goNext} activeOpacity={0.75}>
              <Text style={styles.btnText}>{isLast ? 'начать' : 'дальше →'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatRef}
        data={SLIDES}
        keyExtractor={item => item.key}
        renderItem={renderSlide}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        getItemLayout={(_, index) => ({
          length: Dimensions.get('window').width,
          offset: Dimensions.get('window').width * index,
          index,
        })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  slide: { flex: 1 },
  visualArea: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
  },
  textArea: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 20,
    shadowColor: '#8B7B6B',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  slideNum: { fontSize: 11, color: '#C0A882', fontWeight: '600', marginBottom: 6, letterSpacing: 0.5 },
  title: { fontSize: 22, fontWeight: '700', color: colors.white, marginBottom: 8 },
  desc: { fontSize: 14, color: '#6B5B4E', lineHeight: 21, marginBottom: 20 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dots: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#E8DFD0' },
  dotActive: { width: 20, backgroundColor: '#8B7355' },
  btn: {
    backgroundColor: '#8B7355',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  btnText: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },
});
```

- [ ] **Step 4: Commit**

```bash
git add ustal/screens/OnboardingCarouselScreen.js
git commit -m "feat(онбординг): создать OnboardingCarouselScreen — 5 слайдов"
```

---

## Task 3: Регистрация экрана в навигации

**Files:**
- Modify: `ustal/App.js`

- [ ] **Step 1: Добавить импорт**

В `ustal/App.js` после строки `import OnboardingMomentScreen from './screens/OnboardingMomentScreen';` добавить:

```js
import OnboardingCarouselScreen from './screens/OnboardingCarouselScreen';
```

- [ ] **Step 2: Добавить Stack.Screen**

В `ustal/App.js` после строки `<Stack.Screen name="OnboardingMoment" component={OnboardingMomentScreen} />` добавить:

```js
<Stack.Screen name="OnboardingCarousel" component={OnboardingCarouselScreen} />
```

- [ ] **Step 3: Commit**

```bash
git add ustal/App.js
git commit -m "feat(навигация): зарегистрировать OnboardingCarouselScreen"
```

---

## Task 4: Переход из OnboardingMomentScreen

**Files:**
- Modify: `ustal/screens/OnboardingMomentScreen.js`

- [ ] **Step 1: Найти все точки выхода из OnboardingMomentScreen**

Выход из экрана сейчас: `navigation.replace('Recommendations', { level })`.  
Нужно найти все строки где экран переходит в `Recommendations` или `Main` после завершения:

```bash
grep -n "replace\|navigate" ustal/screens/OnboardingMomentScreen.js
```

- [ ] **Step 2: Заменить навигацию после завершения**

Все вхождения `navigation.replace('Recommendations', { level })` и `navigation.replace('Main')` в OnboardingMomentScreen заменить на:

```js
navigation.replace('OnboardingCarousel');
```

Важно: строка в TestScreen (`navigation.replace('OnboardingMoment', { level })`) остаётся как есть — менять не нужно.

- [ ] **Step 3: Commit**

```bash
git add ustal/screens/OnboardingMomentScreen.js
git commit -m "feat(онбординг): OnboardingMoment → OnboardingCarousel после завершения"
```

---

## Task 5: Кнопка в ProfileScreen

**Files:**
- Modify: `ustal/screens/ProfileScreen.js`

- [ ] **Step 1: Найти строку с кнопкой «Написать в поддержку»**

```bash
grep -n "Написать в поддержку" ustal/screens/ProfileScreen.js
```

- [ ] **Step 2: Добавить кнопку «Как пользоваться» перед ней**

Найди строку:
```js
<Row icon="mail-outline" label="Написать в поддержку" onPress={() => navigation.navigate('Support')} last={false} />
```

Добавь перед ней:
```js
<Row icon="help-circle-outline" label="Как пользоваться приложением" onPress={() => navigation.navigate('OnboardingCarousel')} last={false} />
```

- [ ] **Step 3: Обновить OnboardingCarouselScreen для режима повтора**

В `ustal/screens/OnboardingCarouselScreen.js` в функции `goNext` последней ветке (`else`) заменить:

```js
// было:
navigation.replace('Main');

// стало (поддержка и replace и goBack):
if (navigation.canGoBack()) {
  navigation.goBack();
} else {
  navigation.replace('Main');
}
```

- [ ] **Step 4: Commit**

```bash
git add ustal/screens/ProfileScreen.js ustal/screens/OnboardingCarouselScreen.js
git commit -m "feat(профиль): кнопка повторного просмотра онбординга"
```

---

## Task 6: Финальная проверка

- [ ] **Step 1: Проверить флоу нового пользователя**

1. Создай тестовый аккаунт
2. Пройди тест → убедись что после OnboardingMoment открывается карусель
3. Пролистай все 5 слайдов, нажми «начать»
4. Убедись что в `users` проставился `onboarding_seen = true`

```sql
SELECT user_id, onboarding_seen FROM users ORDER BY created_at DESC LIMIT 5;
```

- [ ] **Step 2: Проверить повтор из профиля**

1. Войди как существующий пользователь
2. Профиль → «Как пользоваться приложением»
3. Карусель открывается, кнопка «начать» → возврат в профиль (goBack)

- [ ] **Step 3: Финальный коммит**

```bash
git add -A
git commit -m "feat(онбординг): карусель — финальная проверка пройдена"
git push origin main
```
