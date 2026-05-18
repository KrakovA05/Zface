# Premium Monetization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить единый Premium-план через RevenueCat — с гейтингом AI-компаньона, аналитической истории, приватного режима и эксклюзивных рыб.

**Architecture:** RevenueCat управляет подписками (Apple IAP + Google Billing), webhook обновляет `users.is_premium` в Supabase. `store.isPremium` читается при старте приложения. Пейволл (`PremiumScreen`) открывается только в момент действия — не как баннер.

**Tech Stack:** React Native + Expo, Supabase, RevenueCat `react-native-purchases`, существующий Edge Function `ai-chat` на Groq.

**Важно:** Tasks 1–9 тестируются в Expo Go через ручную установку `store.isPremium = true`. Task 10 (RevenueCat SDK) требует development build через EAS.

---

## Структура файлов

| Файл | Действие | Что делает |
|------|----------|-----------|
| `ustal/store.js` | Modify | Добавить `isPremium`, `premiumSince` |
| `ustal/utils/usePremium.js` | Create | Хук `usePremium()` |
| `ustal/App.js` | Modify | Читать `is_premium`, `premium_since` из Supabase; зарегистрировать PremiumScreen |
| `ustal/screens/PremiumScreen.js` | Create | Paywall-экран |
| `ustal/screens/AiChatScreen.js` | Modify | Проверка `isPremium` при старте |
| `ustal/screens/AnalyticsScreen.js` | Modify | Гейтинг DimensionHistory + Premium-баннер + Insights-карточка |
| `ustal/screens/FishingScreen.js` | Modify | 3 premium-рыбы + замо́к в коллекции |
| `ustal/screens/AccountSettingsScreen.js` | Modify | Тоггл «Скрыть уровень» (только Premium) |
| `ustal/screens/ProfileScreen.js` | Modify | Строка «поддерживает проект с [месяц год]» |
| `supabase/functions/revenuecat-webhook/index.ts` | Create | Webhook обновляет `is_premium` |

---

## Task 1: Supabase — миграция схемы

**Files:**
- SQL в Supabase Dashboard → SQL Editor

- [ ] **Шаг 1: Применить миграцию**

Открыть Supabase Dashboard → SQL Editor, выполнить:

```sql
-- Добавить Premium-поля в users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_premium       BOOL        DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS premium_expires_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS premium_since    DATE        DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS hide_level       BOOL        DEFAULT FALSE;
```

- [ ] **Шаг 2: Проверить**

```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'users'
  AND column_name IN ('is_premium','premium_expires_at','premium_since','hide_level');
```

Ожидаемый результат: 4 строки, все присутствуют.

- [ ] **Шаг 3: Commit**

```bash
git commit --allow-empty -m "feat(premium): миграция — is_premium, premium_expires_at, premium_since, hide_level"
```

---

## Task 2: store + usePremium хук

**Files:**
- Modify: `ustal/store.js`
- Create: `ustal/utils/usePremium.js`

- [ ] **Шаг 1: Обновить store.js**

Файл `/Users/user/Zface/ustal/store.js` — заменить полностью:

```js
export const store = {
  username: '',
  email: '',
  level: 'green',
  userId: '',
  avatarUrl: '',
  status: '',
  goal: '',
  isAdmin: false,
  isPremium: false,
  premiumSince: null, // 'YYYY-MM-DD' или null
  hideLevel: false,
};
```

- [ ] **Шаг 2: Создать usePremium.js**

Создать файл `/Users/user/Zface/ustal/utils/usePremium.js`:

```js
import { store } from '../store';

export function usePremium() {
  return store.isPremium;
}
```

- [ ] **Шаг 3: Обновить App.js — читать Premium-поля при логине**

В `App.js`, функция `init`, найти строку:
```js
.select('username, level, email, avatar_url, status, login_streak, last_login_date, goal, is_admin, banned_until')
```
Заменить на:
```js
.select('username, level, email, avatar_url, status, login_streak, last_login_date, goal, is_admin, banned_until, is_premium, premium_since, hide_level')
```

Найти блок `if (userData) {` и после `store.isAdmin = userData.is_admin || false;` добавить:

```js
store.isPremium = userData.is_premium || false;
store.premiumSince = userData.premium_since || null;
store.hideLevel = userData.hide_level || false;
```

- [ ] **Шаг 4: Commit**

```bash
git add ustal/store.js ustal/utils/usePremium.js ustal/App.js
git commit -m "feat(premium): store.isPremium + usePremium хук + загрузка из Supabase при старте"
```

---

## Task 3: PremiumScreen — paywall-экран

**Files:**
- Create: `ustal/screens/PremiumScreen.js`

- [ ] **Шаг 1: Создать PremiumScreen.js**

Создать файл `/Users/user/Zface/ustal/screens/PremiumScreen.js`:

```js
import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, shared } from '../theme';

const FEATURES = [
  { icon: 'sparkles-outline',   text: '@один — AI-компаньон доступен полностью' },
  { icon: 'stats-chart-outline', text: 'История каждого измерения за 12 недель' },
  { icon: 'bulb-outline',       text: 'Паттерны и инсайты в твоих данных' },
  { icon: 'fish-outline',       text: 'Три эксклюзивные рыбы и новые пейзажи' },
  { icon: 'eye-off-outline',    text: 'Приватный режим — скрыть уровень от других' },
];

export default function PremiumScreen({ navigation }) {
  const [period, setPeriod] = useState('month');

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.close} onPress={() => navigation.goBack()} activeOpacity={0.7}>
        <Ionicons name="close" size={24} color={colors.muted} />
      </TouchableOpacity>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Premium</Text>
        <Text style={styles.sub}>Глубже. Приватнее. Рядом.</Text>

        <View style={styles.featureList}>
          {FEATURES.map((f, i) => (
            <View key={i} style={styles.featureRow}>
              <Ionicons name={f.icon} size={20} color={colors.accent} />
              <Text style={styles.featureText}>{f.text}</Text>
            </View>
          ))}
        </View>

        <View style={styles.toggle}>
          <TouchableOpacity
            style={[styles.toggleBtn, period === 'month' && styles.toggleBtnActive]}
            onPress={() => setPeriod('month')}
            activeOpacity={0.7}
          >
            <Text style={[styles.toggleLabel, period === 'month' && styles.toggleLabelActive]}>Месяц</Text>
            <Text style={[styles.togglePrice, period === 'month' && styles.togglePriceActive]}>199 ₽</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, period === 'year' && styles.toggleBtnActive]}
            onPress={() => setPeriod('year')}
            activeOpacity={0.7}
          >
            <Text style={[styles.toggleLabel, period === 'year' && styles.toggleLabelActive]}>Год</Text>
            <Text style={[styles.togglePrice, period === 'year' && styles.togglePriceActive]}>1490 ₽  −38%</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={[shared.button, styles.ctaBtn]} activeOpacity={0.85} onPress={() => {
          // RevenueCat purchase подключается в Task 10
          // Для разработки: store.isPremium = true вручную через консоль
        }}>
          <Text style={shared.buttonText}>Попробовать 7 дней бесплатно</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.restore} onPress={() => {
          // RevenueCat restorePurchases — Task 10
        }}>
          <Text style={styles.restoreText}>Восстановить покупку</Text>
        </TouchableOpacity>

        <Text style={styles.legal}>
          Подписка продлевается автоматически. Управление и отмена — в настройках App Store или Google Play. Деньги списываются при подтверждении покупки.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  close: { position: 'absolute', top: 16, right: 16, zIndex: 10, padding: 4 },
  content: { paddingHorizontal: 24, paddingTop: 64, paddingBottom: 48 },
  title: { fontSize: 30, fontWeight: '800', color: colors.white, textAlign: 'center', marginBottom: 6 },
  sub: { fontSize: 15, color: colors.muted, textAlign: 'center', marginBottom: 32 },
  featureList: { marginBottom: 28, gap: 16 },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  featureText: { flex: 1, fontSize: 15, color: colors.white, lineHeight: 21 },
  toggle: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  toggleBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 14,
    backgroundColor: colors.card, borderWidth: 1, borderColor: '#E8DFD0',
  },
  toggleBtnActive: { borderColor: colors.accent, borderWidth: 2 },
  toggleLabel: { fontSize: 13, color: colors.muted, marginBottom: 2 },
  toggleLabelActive: { color: colors.accent, fontWeight: '600' },
  togglePrice: { fontSize: 16, fontWeight: '700', color: colors.white },
  togglePriceActive: { color: colors.accent },
  ctaBtn: { marginBottom: 14 },
  restore: { alignItems: 'center', paddingVertical: 8, marginBottom: 16 },
  restoreText: { fontSize: 13, color: colors.muted },
  legal: { fontSize: 11, color: colors.muted, textAlign: 'center', lineHeight: 16 },
});
```

- [ ] **Шаг 2: Зарегистрировать в App.js**

В `App.js` добавить импорт после остальных экранов:
```js
import PremiumScreen from './screens/PremiumScreen';
```

В `Stack.Navigator` добавить экран (после `DimensionHistory`):
```jsx
<Stack.Screen name="Premium" component={PremiumScreen} options={{ headerShown: false, presentation: 'modal' }} />
```

- [ ] **Шаг 3: Commit**

```bash
git add ustal/screens/PremiumScreen.js ustal/App.js
git commit -m "feat(premium): PremiumScreen — paywall с переключателем месяц/год"
```

---

## Task 4: Gate — AiChatScreen

**Files:**
- Modify: `ustal/screens/AiChatScreen.js`

- [ ] **Шаг 1: Добавить проверку isPremium**

В `AiChatScreen.js` найти строку с импортами (`import { store } from '../store';` уже есть) и добавить импорт хука:

```js
import { usePremium } from '../utils/usePremium';
```

В теле компонента `export default function AiChatScreen({ navigation })` добавить в самом начале — до любых хуков и перед `return`:

```js
const isPremium = usePremium();

useEffect(() => {
  if (!isPremium) {
    navigation.replace('Premium');
  }
}, []);

if (!isPremium) return null;
```

- [ ] **Шаг 2: Проверить**

В `store.js` временно установить `isPremium: false`, запустить `npm start`, открыть таб @один — должен открыться PremiumScreen.
Потом `isPremium: true` — должен открыться чат.
Вернуть `isPremium: false` в store.js (дефолт).

- [ ] **Шаг 3: Commit**

```bash
git add ustal/screens/AiChatScreen.js
git commit -m "feat(premium): AiChatScreen закрыт за Premium — редирект на PremiumScreen"
```

---

## Task 5: Gate — AnalyticsScreen + инсайты

**Files:**
- Modify: `ustal/screens/AnalyticsScreen.js`

- [ ] **Шаг 1: Добавить импорт usePremium**

В начало файла `AnalyticsScreen.js` добавить:
```js
import { usePremium } from '../utils/usePremium';
```

- [ ] **Шаг 2: Гейтинг DimensionHistory**

В компоненте `ProfileSection` (где передаётся `navigation` prop) найти строку:
```js
onPress={() => navigation.navigate('DimensionHistory', { dimension: dim, label: DIMENSION_LABELS[dim] })}
```
Заменить на:
```js
onPress={() => {
  if (!store.isPremium) { navigation.navigate('Premium'); return; }
  navigation.navigate('DimensionHistory', { dimension: dim, label: DIMENSION_LABELS[dim] });
}}
```

После строки с `<Ionicons name="chevron-forward" .../>` ничего менять не нужно — иконка уже есть.

- [ ] **Шаг 3: Premium-баннер под ProfileSection**

Найти место где рендерится `<ProfileSection .../>`. Сразу после него добавить:

```jsx
{!store.isPremium && (
  <TouchableOpacity
    style={styles.premiumBanner}
    onPress={() => navigation.navigate('Premium')}
    activeOpacity={0.8}
  >
    <Ionicons name="sparkles-outline" size={15} color={colors.accent} />
    <Text style={styles.premiumBannerText}>История измерений и инсайты — в Premium</Text>
    <Ionicons name="chevron-forward" size={15} color={colors.accent} />
  </TouchableOpacity>
)}
```

- [ ] **Шаг 4: Insights-карточка (только Premium)**

Добавить функцию генерации инсайтов перед компонентами (после WEEKLY_PHRASES):

```js
function generateInsights(history) {
  if (!history || history.length < 3) return [];
  const latest = history[history.length - 1];
  const earlier = history[history.length - 3];
  const dims = ['anxiety', 'stress', 'apathy', 'loneliness', 'burnout', 'self_esteem', 'social_anxiety', 'attachment'];
  return dims
    .map(dim => {
      const delta = (latest[`${dim}_score`] ?? 0) - (earlier[`${dim}_score`] ?? 0);
      if (Math.abs(delta) < 10) return null;
      const label = DIMENSION_LABELS[dim];
      return delta < 0
        ? `${label} снизилась на ${Math.abs(delta)} пунктов за 3 недели — становится лучше`
        : `${label} выросла на ${delta} пунктов за 3 недели — стоит обратить внимание`;
    })
    .filter(Boolean)
    .slice(0, 3);
}
```

В основном компоненте `AnalyticsScreen`, там где используются данные `metricsHistory`, добавить переменную:

```js
const insights = store.isPremium ? generateInsights(metricsHistory) : [];
```

Сразу после баннера из Шага 3 добавить карточку инсайтов:

```jsx
{store.isPremium && insights.length > 0 && (
  <View style={styles.insightsCard}>
    <Text style={styles.insightsTitle}>Паттерны</Text>
    {insights.map((text, i) => (
      <View key={i} style={styles.insightRow}>
        <View style={styles.insightDot} />
        <Text style={styles.insightText}>{text}</Text>
      </View>
    ))}
  </View>
)}
```

- [ ] **Шаг 5: Добавить стили**

В `StyleSheet.create({...})` добавить:

```js
premiumBanner: {
  flexDirection: 'row', alignItems: 'center', gap: 8,
  backgroundColor: colors.card, borderRadius: 12, padding: 14,
  marginHorizontal: 16, marginBottom: 8,
  borderWidth: 1, borderColor: colors.accent + '40',
},
premiumBannerText: { flex: 1, fontSize: 13, color: colors.accent },
insightsCard: {
  backgroundColor: colors.card, borderRadius: 16,
  padding: 16, marginHorizontal: 16, marginBottom: 8,
  borderWidth: 1, borderColor: '#E8DFD0',
},
insightsTitle: {
  fontSize: 12, fontWeight: '700', color: '#A09080',
  textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 12,
},
insightRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
insightDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent, marginTop: 6 },
insightText: { flex: 1, fontSize: 13, color: colors.white, lineHeight: 19 },
```

- [ ] **Шаг 6: Commit**

```bash
git add ustal/screens/AnalyticsScreen.js
git commit -m "feat(premium): гейтинг истории измерений + Premium-баннер + карточка инсайтов"
```

---

## Task 6: Приватный режим — hide_level

**Files:**
- Modify: `ustal/screens/AccountSettingsScreen.js`
- Modify: `ustal/screens/UserProfileScreen.js`

- [ ] **Шаг 1: Тоггл в AccountSettingsScreen**

В `AccountSettingsScreen.js` добавить импорт:
```js
import { Switch } from 'react-native';
import { usePremium } from '../utils/usePremium';
```

В компоненте добавить state:
```js
const isPremium = usePremium();
const [hideLevel, setHideLevel] = useState(store.hideLevel);
const [savingHide, setSavingHide] = useState(false);
```

Добавить функцию сохранения:
```js
async function saveHideLevel(value) {
  setSavingHide(true);
  const { error } = await supabase
    .from('users')
    .update({ hide_level: value })
    .eq('user_id', store.userId);
  if (!error) {
    store.hideLevel = value;
    setHideLevel(value);
  }
  setSavingHide(false);
}
```

В JSX, перед кнопкой «Выйти» (или в конце ScrollView), добавить секцию:
```jsx
<View style={styles.section}>
  <Text style={styles.sectionTitle}>Приватность</Text>
  <View style={styles.hideLevelRow}>
    <View style={{ flex: 1 }}>
      <Text style={styles.hideLevelLabel}>Скрыть уровень от других</Text>
      <Text style={styles.hideLevelSub}>
        {isPremium ? 'Другие не увидят твой цвет на профиле' : 'Доступно в Premium'}
      </Text>
    </View>
    {savingHide
      ? <ActivityIndicator size="small" color={colors.accent} />
      : <Switch
          value={hideLevel}
          onValueChange={val => { if (isPremium) saveHideLevel(val); else navigation.navigate('Premium'); }}
          trackColor={{ false: '#E8DFD0', true: colors.accent }}
          thumbColor="#FFFFFF"
          disabled={!isPremium}
        />
    }
  </View>
</View>
```

Добавить стили:
```js
section: { marginTop: 24 },
sectionTitle: { fontSize: 12, fontWeight: '700', color: '#A09080', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 12 },
hideLevelRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#E8DFD0', gap: 12 },
hideLevelLabel: { fontSize: 15, color: colors.white, fontWeight: '500', marginBottom: 2 },
hideLevelSub: { fontSize: 12, color: colors.muted },
```

- [ ] **Шаг 2: UserProfileScreen — маскировка уровня**

В `UserProfileScreen.js` найти запрос профиля пользователя (`.from('users').select(...)`). Добавить `hide_level` в select.

После получения данных добавить переменную:
```js
const displayLevel = userData.hide_level ? null : userData.level;
```

Заменить все использования `userData.level` при отображении цвета/лейбла уровня на `displayLevel`. Если `displayLevel === null`, аватар показывается серым (передать `level={null}` в компонент `Avatar`), уровень-лейбл не рендерится.

- [ ] **Шаг 3: Commit**

```bash
git add ustal/screens/AccountSettingsScreen.js ustal/screens/UserProfileScreen.js
git commit -m "feat(premium): приватный режим hide_level — тоггл в настройках + маскировка на профиле"
```

---

## Task 7: ProfileScreen — «поддерживает проект»

**Files:**
- Modify: `ustal/screens/ProfileScreen.js`

- [ ] **Шаг 1: Добавить строку supporter**

В `ProfileScreen.js` найти функцию форматирования или добавить вверху компонента:

```js
function formatPremiumSince(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const months = ['января','февраля','марта','апреля','мая','июня',
                   'июля','августа','сентября','октября','ноября','декабря'];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}
```

В JSX, под отображением никнейма / статуса (но до основных кнопок), добавить:

```jsx
{store.isPremium && store.premiumSince && (
  <Text style={styles.supporterLabel}>
    поддерживает проект с {formatPremiumSince(store.premiumSince)}
  </Text>
)}
```

Добавить стиль:
```js
supporterLabel: { fontSize: 12, color: colors.accent, textAlign: 'center', marginTop: 4, opacity: 0.85 },
```

- [ ] **Шаг 2: Commit**

```bash
git add ustal/screens/ProfileScreen.js
git commit -m "feat(premium): строка 'поддерживает проект с [месяц год]' на ProfileScreen"
```

---

## Task 8: Эксклюзивные рыбы для Premium

**Files:**
- Modify: `ustal/screens/FishingScreen.js`

- [ ] **Шаг 1: Добавить импорт usePremium**

В `FishingScreen.js` добавить:
```js
import { usePremium } from '../utils/usePremium';
```

- [ ] **Шаг 2: Добавить 3 premium-рыбы в массив FISH**

В массиве `FISH` (строки 64–78) добавить после 'Лунная форель':
```js
{ name: 'Радужный хариус',  emoji: '🎣', rarity: 'premium', min: 0.5, max: 2.0, times: ['morning'], premium: true },
{ name: 'Бездонный угорь',  emoji: '🐌', rarity: 'premium', min: 3.0, max: 8.0, times: ['night'],   premium: true },
{ name: 'Светящийся налим', emoji: '💫', rarity: 'premium', min: 1.5, max: 4.0, times: null,        premium: true },
```

Добавить в объект `RARITY`:
```js
premium: { color: '#7B61FF', label: 'Премиум' },
```

- [ ] **Шаг 3: Фильтровать premium-рыбы для не-Premium пользователей**

В функции `rollFish(period)`, найти строку `const FISH = [...]` — она определена в модульном скоупе. В начало функции `rollFish` добавить:

```js
const rollFish = (period) => {
  const availableFish = store.isPremium ? FISH : FISH.filter(f => !f.premium);
  // ... остальной код функции — заменить все обращения к FISH на availableFish
```

Найти все `FISH.filter(...)` внутри тела `rollFish` и заменить на `availableFish.filter(...)`.

- [ ] **Шаг 4: Замо́к в коллекции**

В коде где рендерится сетка поймённых рыб (ProfileScreen или встроено в FishingScreen), в счётчике `поймано X из ...` изменить знаменатель чтобы для free-пользователей не показывались premium:

```js
const totalFishCount = store.isPremium
  ? FISH.filter(f => f.rarity !== 'trash' && f.rarity !== 'special').length
  : FISH.filter(f => f.rarity !== 'trash' && f.rarity !== 'special' && !f.premium).length;
```

В сетке/списке рыб: premium-рыбы для не-Premium показываются как:
```jsx
{!store.isPremium && fish.premium && (
  <View style={styles.premiumFishLock}>
    <Text style={styles.premiumFishLockText}>🔒 Premium</Text>
  </View>
)}
```

Добавить стиль:
```js
premiumFishLock: { alignItems: 'center', opacity: 0.5 },
premiumFishLockText: { fontSize: 10, color: '#7B61FF', fontWeight: '600' },
```

- [ ] **Шаг 5: Commit**

```bash
git add ustal/screens/FishingScreen.js
git commit -m "feat(premium): 3 эксклюзивные рыбы для Premium + замо́к в коллекции"
```

---

## Task 9: Edge Function — revenuecat-webhook

**Files:**
- Create: `supabase/functions/revenuecat-webhook/index.ts`

- [ ] **Шаг 1: Создать функцию**

Создать файл `/Users/user/Zface/supabase/functions/revenuecat-webhook/index.ts`:

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req: Request) => {
  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl  = Deno.env.get('SUPABASE_URL')!;
    const serviceKey   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const webhookSecret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET') || '';

    // Опциональная проверка Authorization-заголовка
    const authHeader = req.headers.get('Authorization') || '';
    if (webhookSecret && authHeader !== `Bearer ${webhookSecret}`) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const payload = await req.json();
    const event = payload.event;
    if (!event) {
      return new Response(JSON.stringify({ ok: true, skipped: 'no event' }), { headers: corsHeaders });
    }

    // RevenueCat передаёт Supabase user_id как app_user_id
    const userId = event.app_user_id;
    if (!userId) {
      return new Response(JSON.stringify({ ok: true, skipped: 'no user_id' }), { headers: corsHeaders });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    switch (event.type) {
      case 'INITIAL_PURCHASE':
      case 'RENEWAL':
      case 'REACTIVATED': {
        const expiresAt = event.expiration_at_ms
          ? new Date(event.expiration_at_ms).toISOString()
          : null;
        const updates: Record<string, unknown> = {
          is_premium: true,
          premium_expires_at: expiresAt,
        };
        if (event.type === 'INITIAL_PURCHASE') {
          updates.premium_since = new Date().toISOString().split('T')[0];
        }
        await supabase.from('users').update(updates).eq('user_id', userId);
        break;
      }
      case 'CANCELLATION':
      case 'EXPIRATION':
      case 'BILLING_ISSUE':
        await supabase.from('users').update({ is_premium: false }).eq('user_id', userId);
        break;
      default:
        break;
    }

    return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: corsHeaders },
    );
  }
});
```

- [ ] **Шаг 2: Задеплоить**

```bash
cd /Users/user/Zface
npx supabase functions deploy revenuecat-webhook --no-verify-jwt
```

- [ ] **Шаг 3: Добавить секрет в Supabase Dashboard**

Supabase Dashboard → Edge Functions → revenuecat-webhook → Secrets:
- `REVENUECAT_WEBHOOK_SECRET` = (будет задан при настройке RevenueCat)

- [ ] **Шаг 4: Commit**

```bash
git add supabase/functions/revenuecat-webhook/
git commit -m "feat(premium): revenuecat-webhook — синкает is_premium из событий RevenueCat"
```

---

## Task 10: RevenueCat SDK (требует EAS Dev Build)

**⚠️ Этот таск не работает в Expo Go. Нужен `eas build --profile development`.**

**Files:**
- Modify: `ustal/package.json` (через npm install)
- Modify: `ustal/app.json` (плагин RevenueCat)
- Modify: `ustal/screens/PremiumScreen.js` (подключить реальные покупки)
- Modify: `ustal/App.js` (инициализировать SDK)

- [ ] **Шаг 1: Установить SDK**

```bash
cd /Users/user/Zface/ustal
npx expo install react-native-purchases react-native-purchases-ui --npm
```

- [ ] **Шаг 2: Добавить плагин в app.json**

В `ustal/app.json`, в блок `"plugins"` добавить:
```json
"react-native-purchases"
```

- [ ] **Шаг 3: Инициализировать SDK в App.js**

Добавить импорт:
```js
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
```

В функции `init()`, до `supabase.auth.getSession()`, добавить:
```js
const RC_API_KEY_IOS     = 'appl_XXXXXXXXXXXXXXX'; // взять из RevenueCat Dashboard
const RC_API_KEY_ANDROID = 'goog_XXXXXXXXXXXXXXX';
const apiKey = Platform.OS === 'ios' ? RC_API_KEY_IOS : RC_API_KEY_ANDROID;
Purchases.setLogLevel(LOG_LEVEL.WARN);
Purchases.configure({ apiKey });
```

После получения `session.user.id` добавить:
```js
await Purchases.logIn(session.user.id); // передаём Supabase user_id как App User ID
```

- [ ] **Шаг 4: Подключить покупки в PremiumScreen.js**

Добавить импорт:
```js
import Purchases from 'react-native-purchases';
```

Добавить состояние и функции:
```js
const [loading, setLoading] = useState(false);

async function handlePurchase() {
  try {
    setLoading(true);
    const offerings = await Purchases.getOfferings();
    const pkg = period === 'year'
      ? offerings.current?.annual
      : offerings.current?.monthly;
    if (!pkg) { Alert.alert('Ошибка', 'Покупка недоступна'); return; }
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    const isPremium = customerInfo.entitlements.active['premium'] !== undefined;
    if (isPremium) {
      store.isPremium = true;
      navigation.goBack();
    }
  } catch (e) {
    if (!e.userCancelled) Alert.alert('Ошибка', 'Не удалось совершить покупку');
  } finally {
    setLoading(false);
  }
}

async function handleRestore() {
  try {
    setLoading(true);
    const customerInfo = await Purchases.restorePurchases();
    const isPremium = customerInfo.entitlements.active['premium'] !== undefined;
    if (isPremium) {
      store.isPremium = true;
      navigation.goBack();
    } else {
      Alert.alert('Ничего не найдено', 'Активных подписок не обнаружено');
    }
  } catch {
    Alert.alert('Ошибка', 'Не удалось восстановить покупку');
  } finally {
    setLoading(false);
  }
}
```

В кнопку CTA добавить `onPress={handlePurchase}` и `disabled={loading}`.
В кнопку restore добавить `onPress={handleRestore}`.

- [ ] **Шаг 5: Настроить продукты в RevenueCat Dashboard**

1. Зарегистрироваться на app.revenuecat.com
2. Создать проект, добавить iOS App (Bundle ID из `app.json`) и Android App
3. В App Store Connect создать In-App Purchase: `premium_monthly` (Auto-Renewable, 199 ₽) и `premium_annual` (Auto-Renewable, 1490 ₽, 7-day trial)
4. В RevenueCat: Offerings → создать offering `default`, пакеты `monthly` и `annual`, привязать продукты
5. Entitlement: создать `premium`, добавить оба продукта

- [ ] **Шаг 6: Сборка и тест**

```bash
cd /Users/user/Zface/ustal
eas build --profile development --platform ios
```

- [ ] **Шаг 7: Commit**

```bash
git add ustal/screens/PremiumScreen.js ustal/App.js ustal/app.json ustal/package.json ustal/yarn.lock
git commit -m "feat(premium): RevenueCat SDK — реальные покупки Apple IAP + Google Billing"
```

---

## Self-review

**Spec coverage:**
- ✅ `is_premium` + `premium_since` + `hide_level` в БД → Task 1
- ✅ `store.isPremium` + `usePremium()` → Task 2
- ✅ PremiumScreen → Task 3
- ✅ @один целиком Premium → Task 4
- ✅ DimensionHistory гейтинг + баннер + инсайты → Task 5
- ✅ Приватный режим → Task 6
- ✅ «поддерживает проект» на ProfileScreen → Task 7
- ✅ Premium-рыбы + замо́к → Task 8
- ✅ revenuecat-webhook → Task 9
- ✅ RevenueCat SDK → Task 10

**Проверка консистентности:**
- `usePremium()` возвращает `store.isPremium` — все Tasks используют одинаковый паттерн ✅
- `store.isPremium` заполняется в App.js при старте → Tasks 4–8 корректно читают ✅
- RevenueCat `app_user_id` = Supabase `user_id` — это задаётся в Task 10 Шаг 3 (`Purchases.logIn(session.user.id)`) ✅
- `FISH` — Premium-рыбы используют поле `premium: true`, фильтр в `rollFish` корректен ✅
