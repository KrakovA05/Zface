# Реферальная система — Дизайн

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Дата:** 2026-05-20  
**Статус:** Approved

**Цель:** Добавить реферальную систему — инвайт-ссылки через deep link + ручной код, прогрессивная скидка на премиум (5 чел = 10%, каждые следующие 5 = +10%, макс 50%), отдельный InviteScreen с прогрессом.

**Архитектура:** Одно новое поле `referred_by UUID` в таблице `users`. Deep link через URL-схему `neOdin://invite/{username}`. Код сохраняется в AsyncStorage при открытии ссылки, читается на RegisterScreen. Скидка вычисляется на лету из COUNT запроса. Применение скидки через RevenueCat — в отдельном спеке по премиуму; этот спек делает всё до момента оплаты.

**Стек:** React Native, Expo Linking, AsyncStorage, Supabase, Share API (уже используется в ProfileScreen).

---

## База данных

```sql
ALTER TABLE users ADD COLUMN referred_by UUID REFERENCES users(user_id) ON DELETE SET NULL;
```

Больше никаких новых таблиц. Счётчик и скидка вычисляются на лету:

```js
// Количество приглашённых пользователей
const { count } = await supabase
  .from('users')
  .select('user_id', { count: 'exact', head: true })
  .eq('referred_by', store.userId)

// Прогрессивная скидка
function getReferralDiscount(count) {
  return Math.min(Math.floor(count / 5) * 10, 50)
}
// 0→0%, 5→10%, 10→20%, 15→30%, 20→40%, 25+→50%
```

RLS: `referred_by` читается как любое другое поле users. Новая политика не нужна.

---

## Deep link

### app.json

Добавить в секцию `expo`:
```json
"scheme": "neOdin"
```

Это создаёт схему `neOdin://`. Ссылка для инвайта: `neOdin://invite/{username}`.

### App.js — обработка входящих ссылок

Добавить в `useEffect` при старте приложения (рядом с `supabase.auth.getSession()`):

```js
import { Linking } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

function parseInviteCode(url) {
  const match = url?.match(/invite\/([^/?#]+)/)
  return match ? match[1] : null
}

// Внутри useEffect:
const initialUrl = await Linking.getInitialURL()
if (initialUrl) {
  const code = parseInviteCode(initialUrl)
  if (code) await AsyncStorage.setItem('pendingInviteCode', code)
}

const linkingSub = Linking.addEventListener('url', async ({ url }) => {
  const code = parseInviteCode(url)
  if (code) await AsyncStorage.setItem('pendingInviteCode', code)
})
// Убрать подписку при размонтировании: return () => linkingSub.remove()
```

---

## Флоу регистрации

### RegisterScreen.js

1. На `useEffect` при монтировании: читать `pendingInviteCode` из AsyncStorage, предзаполнить state `inviteCode`.
2. Добавить необязательное поле ввода «Кто пригласил? (необязательно)» — предзаполняется из AsyncStorage, редактируемое.
3. После успешной регистрации: если `inviteCode.trim()` не пустой — найти приглашающего по username, записать `referred_by`.
4. Очистить `pendingInviteCode` из AsyncStorage.

```js
// После успешной регистрации нового пользователя (newUserId уже известен):
const trimmedCode = inviteCode.trim()
if (trimmedCode) {
  const { data: inviter } = await supabase
    .from('users')
    .select('user_id')
    .eq('username', trimmedCode)
    .maybeSingle()
  if (inviter && inviter.user_id !== newUserId) {
    await supabase.from('users').update({ referred_by: inviter.user_id }).eq('user_id', newUserId)
  }
  await AsyncStorage.removeItem('pendingInviteCode')
}
```

**Edge cases:**
- Несуществующий ник → `inviter` = null → тихо пропускаем, регистрация продолжается нормально
- Свой ник → `inviter.user_id === newUserId` → игнорируем
- `referred_by` уже заполнен (повторный вход) → не перезаписываем (обновление делается только при первой регистрации)

---

## InviteScreen

**Файл:** `ustal/screens/InviteScreen.js`

### Данные

```js
const [referralCount, setReferralCount] = useState(0)
const [loading, setLoading] = useState(true)

useFocusEffect(useCallback(() => {
  async function load() {
    const { count } = await supabase
      .from('users')
      .select('user_id', { count: 'exact', head: true })
      .eq('referred_by', store.userId)
    setReferralCount(count || 0)
    setLoading(false)
  }
  load()
}, []))

const discount = getReferralDiscount(referralCount)          // текущая скидка %
const nextMilestone = Math.ceil((referralCount + 1) / 5) * 5 // следующий порог
const progressInLevel = referralCount % 5                    // прогресс внутри текущего уровня
const inviteLink = `neOdin://invite/${store.username}`
```

### Компоненты экрана

1. **Шапка** — стрелка назад + заголовок «Пригласить друга»

2. **Подзаголовок** — «Поделись с теми, кому сейчас тяжело. За каждые 5 человек — +10% скидки на премиум.»

3. **Карточка прогресса:**
   - 5 точек-индикаторов (●●●○○) — `progressInLevel` из 5 заполнены
   - Текст: «{referralCount} из {nextMilestone} → +10%» (или «макс. скидка достигнута» если ≥ 25)
   - Текущая скидка большим текстом: «{discount}%» (серый если 0, акцентный если > 0)

4. **Вехи** — 5 строк:
   ```
   5 чел  → 10%   ✓ (зелёный) если referralCount >= 5
   10 чел → 20%   ✓/○
   15 чел → 30%   ○
   20 чел → 40%   ○
   25 чел → 50%   ○
   ```

5. **Ссылка** — поле с `inviteLink` + кнопка «Копировать» (Clipboard.setString)

6. **Кнопка «Поделиться»:**
   ```js
   Share.share({
     message: `Привет! Я в приложении «не один» — здесь найдёшь людей, которым сейчас так же непросто. Вот моя ссылка: ${inviteLink}`,
   })
   ```

### Навигация

Регистрация в `App.js` поверх Main-табов:
```jsx
<Stack.Screen name="Invite" component={InviteScreen} options={{ headerShown: false }} />
```

---

## ProfileScreen

### Кнопка «Пригласить друга»

Добавить строку в ту же секцию меню где находится компонент `<Row icon="lock-closed-outline" label="Сменить пароль" .../>` — сразу после него:
```jsx
<Row icon="person-add-outline" label="Пригласить друга" onPress={() => navigation.navigate('Invite')} />
```

### Счётчик в карточке присутствия

В `loadPresenceStats` добавить запрос:
```js
const { count: invitedCount } = await supabase
  .from('users')
  .select('user_id', { count: 'exact', head: true })
  .eq('referred_by', store.userId)
```

В карточку `presenceStats` добавить четвёртый элемент:
```jsx
<View style={styles.presenceStat}>
  <Text style={styles.presenceNum}>{presenceStats.invitedCount}</Text>
  <Text style={styles.presenceLabel}>приглашено</Text>
</View>
```

---

## Store

Добавить в `store.js`:
```js
store.referralDiscountPct = 0  // заполняется при загрузке профиля
```

В App.js при загрузке профиля (после login/session restore) добавить:
```js
const { count: refCount } = await supabase
  .from('users').select('user_id', { count: 'exact', head: true }).eq('referred_by', data.user.id)
store.referralDiscountPct = Math.min(Math.floor((refCount || 0) / 5) * 10, 50)
```

Это поле будет читать PremiumScreen когда начнётся реализация монетизации.

---

## Что НЕ входит в этот спек

- Применение скидки через RevenueCat promotional offers — в спеке монетизации
- Web landing page для ссылок (Universal Links) — вариант 3, не выбран
- Push-уведомление «твой друг зарегистрировался» — можно добавить позже
- Лидерборд по количеству приглашений — опционально
