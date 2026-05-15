# AI-слой и чат с @один — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить персонализированный AI-слой по всему приложению и отдельный экран чата с @один как новый таб в навигации.

**Architecture:** Бесплатный AI-слой реализуется на клиенте (ранжирование ленты, адаптивный вопрос дня, навигационные подсказки) без новых Edge Functions кроме ai-chat. Чат — новый таб в навигации + Edge Function ai-chat + две новые таблицы в БД. Паттерн детекция — расширение существующего ai-feed-generator.

**Tech Stack:** React Native / Expo, Supabase (PostgreSQL + Edge Functions), Gemini 2.5 Flash, AsyncStorage (для хранения dismiss-дат подсказок).

---

## Карта файлов

| Файл | Действие | Ответственность |
|------|----------|-----------------|
| `ustal/App.js` | Modify | CustomTabBar: спецрендер @один таба; MainTabs: убрать Friends, добавить AiChat |
| `ustal/screens/ProfileScreen.js` | Modify | Добавить кнопку «Друзья» в шапку экрана |
| `ustal/screens/AiChatScreen.js` | Create | Экран чата с @один |
| `ustal/screens/FeedScreen.js` | Modify | Клиентское ранжирование постов по уровню |
| `ustal/screens/HomeScreen.js` | Modify | Адаптивный вопрос дня + навигационная подсказка |
| `ustal/constants.js` | Modify | Добавить DAILY_QUESTIONS_RED, DAILY_QUESTIONS_STABLE |
| `supabase/migrations/008_ai_chat_tables.sql` | Create | Таблицы ai_chat_sessions, ai_chat_messages, колонка ai_chat_enabled |
| `supabase/functions/ai-chat/index.ts` | Create | Edge Function: приём сообщения → Gemini → ответ |
| `supabase/functions/ai-feed-generator/index.ts` | Modify | Детекция паттерна ухудшения у группы пользователей |

---

## Task 1: Навигация — убрать Friends из таба, добавить @один

**Files:**
- Modify: `ustal/App.js:49-55` (TAB_ICONS), `ustal/App.js:57-106` (CustomTabBar), `ustal/App.js:243-249` (MainTabs)

- [ ] **Step 1.1: Обновить TAB_ICONS — убрать Friends**

В `ustal/App.js` найти объект `TAB_ICONS` (строки 49-55) и заменить:

```js
const TAB_ICONS = {
  Home:     { focused: 'home',        blur: 'home-outline' },
  Feed:     { focused: 'newspaper',   blur: 'newspaper-outline' },
  Messages: { focused: 'chatbubbles', blur: 'chatbubbles-outline' },
  Profile:  { focused: 'person',      blur: 'person-outline' },
};
```

- [ ] **Step 1.2: Добавить спецрендер @один таба в CustomTabBar**

В `ustal/App.js` найти функцию `CustomTabBar`. Внутри `.map()` перед `return (` добавить ветку для AiChat:

```js
// Спецрендер для таба @один
if (route.name === 'AiChat') {
  return (
    <TouchableOpacity
      key={route.key}
      onPress={onPress}
      style={tabStyles.tab}
      activeOpacity={0.7}
    >
      <View style={tabStyles.iconWrap}>
        <View style={[tabStyles.aiTabIcon, focused && tabStyles.aiTabIconFocused]}>
          <Text style={tabStyles.aiTabStar}>✦</Text>
        </View>
        <View style={tabStyles.aiTabBadge}>
          <Text style={tabStyles.aiTabBadgeText}>AI</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}
```

- [ ] **Step 1.3: Добавить стили для @один иконки в tabStyles**

После объекта `tabStyles` (StyleSheet.create) добавить новые ключи внутрь него:

```js
aiTabIcon: {
  width: 36,
  height: 36,
  backgroundColor: '#c9a96e',
  borderRadius: 11,
  alignItems: 'center',
  justifyContent: 'center',
},
aiTabIconFocused: {
  shadowColor: '#c9a96e',
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.4,
  shadowRadius: 6,
  elevation: 4,
},
aiTabStar: {
  color: '#FFFFFF',
  fontSize: 17,
  fontWeight: '700',
},
aiTabBadge: {
  position: 'absolute',
  top: -5,
  right: -6,
  backgroundColor: '#7B61FF',
  borderRadius: 5,
  paddingHorizontal: 4,
  paddingVertical: 1,
},
aiTabBadgeText: {
  color: '#FFFFFF',
  fontSize: 7,
  fontWeight: '700',
  letterSpacing: 0.3,
},
```

- [ ] **Step 1.4: Заменить Friends на AiChat в MainTabs**

В функции `MainTabs` (строки 243-249) заменить строку с Friends:

```js
// Было:
<Tab.Screen name="Friends" component={FriendsScreen} options={{ tabBarBadge: friendBadge }} />

// Стало:
<Tab.Screen name="AiChat" component={AiChatScreen} />
```

Убрать весь блок с `friendBadge` state и запрос дружб из `refreshBadges` — или оставить friendBadge но перенести его в ProfileScreen. Проще: убрать `friendBadge` состояние и запрос к `friendships` из `refreshBadges`.

Полный заменённый `refreshBadges`:
```js
const refreshBadges = useCallback(async () => {
  if (!store.userId) return;

  const { data: dms } = await supabase
    .from('direct_messages')
    .select('conversation_id, sender_id, created_at')
    .neq('sender_id', store.userId)
    .order('created_at', { ascending: false })
    .limit(100);

  const convIds = [...new Set(
    (dms || [])
      .filter(m => m.conversation_id.includes(store.userId))
      .map(m => m.conversation_id)
  )];

  let unreadChats = 0;

  for (const cid of convIds) {
    const lastRead = await getLastRead(`dm_${cid}`);
    const hasUnread = (dms || []).some(m =>
      m.conversation_id === cid &&
      (!lastRead || new Date(m.created_at) > new Date(lastRead))
    );
    if (hasUnread) unreadChats++;
  }

  const checkGroupChat = async (level, key, excludeField, excludeValue) => {
    const lastRead = await getLastRead(key);
    let query = supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('level', level)
      .neq(excludeField, excludeValue);
    if (lastRead) query = query.gt('created_at', lastRead);
    const { count } = await query;
    return (count || 0) > 0;
  };

  const globalUnread = await checkGroupChat('global', 'global', 'sender_id', store.userId);
  if (globalUnread) unreadChats++;

  const userLevel = store.level;
  if (userLevel) {
    const roomUnread = await checkGroupChat(userLevel, `room_${userLevel}`, 'sender_id', store.userId);
    if (roomUnread) unreadChats++;
  }

  setMsgBadge(unreadChats || null);
}, []);
```

- [ ] **Step 1.5: Убрать состояние friendBadge и объявление setFriendBadge**

В `MainTabs` убрать строку:
```js
const [friendBadge, setFriendBadge] = useState(null);
```

- [ ] **Step 1.6: Добавить import AiChatScreen в App.js**

В секцию импортов добавить:
```js
import AiChatScreen from './screens/AiChatScreen';
```

- [ ] **Step 1.7: Добавить кнопку «Друзья» в ProfileScreen**

В `ustal/screens/ProfileScreen.js` найти компонент `ProfileScreen` и добавить кнопку в шапку. Текущая шапка формируется через ScrollView. Добавить в самое начало ScrollView (перед аватаром) строку с кнопками уведомлений и друзей:

Найти первый `<View style={styles.header}>` или аналогичный компонент шапки профиля и добавить кнопку. Если такого нет — добавить строку кнопок сразу после открытия ScrollView:

```js
{/* Шапка с кнопками */}
<View style={styles.topBar}>
  <TouchableOpacity
    style={styles.topBarBtn}
    onPress={() => navigation.navigate('Friends')}
    activeOpacity={0.7}
  >
    <Ionicons name="people-outline" size={22} color={colors.accent} />
    {!!friendBadge && (
      <View style={styles.topBarBadge}>
        <Text style={styles.topBarBadgeText}>{friendBadge}</Text>
      </View>
    )}
  </TouchableOpacity>
</View>
```

В начале `ProfileScreen` добавить state для friendBadge:
```js
const [friendBadge, setFriendBadge] = useState(null);
```

Загружать в `useFocusEffect`:
```js
const { count: reqCount } = await supabase
  .from('friendships')
  .select('*', { count: 'exact', head: true })
  .eq('receiver_id', store.userId)
  .eq('status', 'pending');
setFriendBadge(reqCount || null);
```

Добавить стили:
```js
topBar: {
  flexDirection: 'row',
  justifyContent: 'flex-end',
  paddingHorizontal: 20,
  paddingTop: 16,
  paddingBottom: 4,
},
topBarBtn: {
  position: 'relative',
  padding: 6,
},
topBarBadge: {
  position: 'absolute',
  top: 2,
  right: 2,
  backgroundColor: '#e74c3c',
  borderRadius: 7,
  minWidth: 14,
  height: 14,
  alignItems: 'center',
  justifyContent: 'center',
  paddingHorizontal: 2,
},
topBarBadgeText: {
  color: '#fff',
  fontSize: 8,
  fontWeight: 'bold',
},
```

- [ ] **Step 1.8: Проверить что Friends экран доступен через Stack навигацию**

В `ustal/App.js` в основном Stack.Navigator убедиться, что `FriendsScreen` зарегистрирована как stack-экран (не таб). Если её там нет — добавить:

```js
<Stack.Screen name="Friends" component={FriendsScreen} options={{ headerShown: false }} />
```

- [ ] **Step 1.9: Добавить import FriendsScreen в Stack если нужно, запустить и проверить**

```bash
cd ustal && npm start
```

Проверить:
- Таб Friends исчез из нижней навигации
- На 4-й позиции появился таб @один с золотой иконкой ✦ и фиолетовым AI-стикером
- Нажатие на таб @один открывает (пока пустой) AiChatScreen
- В ProfileScreen есть кнопка «Друзья» → открывает FriendsScreen

- [ ] **Step 1.10: Commit**

```bash
git add ustal/App.js ustal/screens/ProfileScreen.js ustal/screens/AiChatScreen.js
git commit -m "feat(навигация): убрать Friends из таба, добавить @один с AI-стикером, Друзья → в Профиль"
```

---

## Task 2: БД — миграция таблиц для чата

**Files:**
- Create: `supabase/migrations/008_ai_chat_tables.sql`

- [ ] **Step 2.1: Создать файл миграции**

Создать `supabase/migrations/008_ai_chat_tables.sql`:

```sql
-- Сессии чата с @один (для памяти между сессиями)
CREATE TABLE IF NOT EXISTS ai_chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
  summary TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ
);

-- История сообщений чата
CREATE TABLE IF NOT EXISTS ai_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
  session_id UUID REFERENCES ai_chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Флаг доступа к чату (для будущей монетизации, сейчас всем true)
ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_chat_enabled BOOLEAN DEFAULT true;

-- Индексы для быстрой загрузки истории
CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_session ON ai_chat_messages(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_user ON ai_chat_sessions(user_id, started_at DESC);

-- RLS: каждый видит только свои данные
ALTER TABLE ai_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users see own sessions" ON ai_chat_sessions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "users see own messages" ON ai_chat_messages
  FOR ALL USING (auth.uid() = user_id);
```

- [ ] **Step 2.2: Применить миграцию через MCP**

Выполнить SQL из файла через `mcp__supabase__apply_migration` или `mcp__supabase__execute_sql`.

- [ ] **Step 2.3: Проверить таблицы через list_tables**

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE 'ai_chat%';
```

Ожидаемый результат: `ai_chat_messages`, `ai_chat_sessions`.

- [ ] **Step 2.4: Commit**

```bash
git add supabase/migrations/008_ai_chat_tables.sql
git commit -m "feat(бд): таблицы ai_chat_sessions и ai_chat_messages, колонка ai_chat_enabled"
```

---

## Task 3: AiChatScreen — экран чата с @один

**Files:**
- Create: `ustal/screens/AiChatScreen.js`

- [ ] **Step 3.1: Создать AiChatScreen.js**

Создать `ustal/screens/AiChatScreen.js`:

```js
import {
  StyleSheet, Text, View, FlatList, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform,
  ActivityIndicator, SafeAreaView, Linking,
} from 'react-native';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../supabase';
import { store } from '../store';
import { colors } from '../theme';

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001';
const CRISIS_HOTLINE = '8-800-2000-122';

const CRISIS_WORDS = [
  'суицид', 'суицида', 'суициде',
  'не хочу жить', 'хочу умереть', 'покончить',
  'конец жизни', 'убить себя', 'убью себя',
  'нет смысла жить', 'незачем жить',
];

function hasCrisisWord(text) {
  const lower = text.toLowerCase();
  return CRISIS_WORDS.some(w => lower.includes(w));
}

function MessageBubble({ item }) {
  const isUser = item.role === 'user';
  return (
    <View style={[styles.bubbleWrap, isUser ? styles.bubbleWrapUser : styles.bubbleWrapAi]}>
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAi]}>
        <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>{item.text}</Text>
      </View>
    </View>
  );
}

function CrisisCard({ onDismiss }) {
  return (
    <View style={styles.crisisCard}>
      <Text style={styles.crisisTitle}>Я здесь рядом.</Text>
      <Text style={styles.crisisBody}>
        Если сейчас очень тяжело — есть люди, которые выслушают:
      </Text>
      <TouchableOpacity
        style={styles.crisisHotline}
        onPress={() => Linking.openURL(`tel:${CRISIS_HOTLINE.replace(/-/g, '')}`)}
        activeOpacity={0.75}
      >
        <Ionicons name="call-outline" size={16} color="#FFFFFF" />
        <Text style={styles.crisisHotlineText}>{CRISIS_HOTLINE}</Text>
        <Text style={styles.crisisHotlineSub}>бесплатно, круглосуточно</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onDismiss} activeOpacity={0.6} style={styles.crisisDismiss}>
        <Text style={styles.crisisDismissText}>продолжить разговор</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function AiChatScreen() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [showCrisis, setShowCrisis] = useState(false);
  const flatListRef = useRef(null);

  // Загружаем или создаём сессию при открытии экрана
  useEffect(() => {
    initSession();
  }, []);

  const initSession = async () => {
    if (!store.userId) return;

    // Ищем последнюю незакрытую сессию (ended_at IS NULL)
    const { data: existing } = await supabase
      .from('ai_chat_sessions')
      .select('id')
      .eq('user_id', store.userId)
      .is('ended_at', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let sid;
    if (existing) {
      sid = existing.id;
    } else {
      const { data: newSession } = await supabase
        .from('ai_chat_sessions')
        .insert({ user_id: store.userId })
        .select('id')
        .single();
      sid = newSession?.id;
    }

    if (!sid) return;
    setSessionId(sid);

    // Загружаем последние 20 сообщений сессии
    const { data: msgs } = await supabase
      .from('ai_chat_messages')
      .select('id, role, text, created_at')
      .eq('session_id', sid)
      .order('created_at', { ascending: true })
      .limit(20);

    setMessages(msgs || []);
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || sending || !sessionId) return;

    setInput('');
    setSending(true);

    // Оптимистично добавляем сообщение пользователя
    const userMsg = { id: `tmp_${Date.now()}`, role: 'user', text, created_at: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/ai-chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ message: text, session_id: sessionId }),
        }
      );

      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Ошибка');

      if (json.crisis) setShowCrisis(true);

      const aiMsg = { id: `ai_${Date.now()}`, role: 'assistant', text: json.reply, created_at: new Date().toISOString() };
      setMessages(prev => [...prev, aiMsg]);
    } catch {
      // Убираем оптимистичное сообщение при ошибке
      setMessages(prev => prev.filter(m => m.id !== userMsg.id));
      setInput(text);
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  return (
    <SafeAreaView style={styles.container}>
      {/* Шапка */}
      <View style={styles.header}>
        <View style={styles.headerAvatar}>
          <Text style={styles.headerAvatarIcon}>✦</Text>
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.headerName}>@один</Text>
          <Text style={styles.headerSub}>я здесь каждый день</Text>
        </View>
      </View>

      {/* Дисклеймер */}
      <View style={styles.disclaimer}>
        <Text style={styles.disclaimerText}>
          @один — не психолог и не заменяет специалиста
        </Text>
      </View>

      {/* Список сообщений */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <MessageBubble item={item} />}
        contentContainerStyle={styles.messageList}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>напиши что-нибудь — @один ответит</Text>
          </View>
        }
      />

      {/* Кризисная карточка */}
      {showCrisis && <CrisisCard onDismiss={() => setShowCrisis(false)} />}

      {/* Поле ввода */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={90}
      >
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="напиши что-нибудь..."
            placeholderTextColor={colors.muted}
            multiline
            maxLength={500}
            onSubmitEditing={sendMessage}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={!input.trim() || sending}
            activeOpacity={0.7}
          >
            {sending
              ? <ActivityIndicator size="small" color="#FFFFFF" />
              : <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  headerAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#c9a96e',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerAvatarIcon: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
  headerInfo: { flex: 1 },
  headerName: { fontSize: 16, fontWeight: '700', color: colors.white },
  headerSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  disclaimer: {
    backgroundColor: '#FFF8EE',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0E8D8',
  },
  disclaimerText: { fontSize: 11, color: '#A08060', textAlign: 'center' },
  messageList: { padding: 16, paddingBottom: 8, flexGrow: 1 },
  emptyWrap: { flex: 1, alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 14, color: colors.muted, textAlign: 'center' },
  bubbleWrap: { marginBottom: 10 },
  bubbleWrapUser: { alignItems: 'flex-end' },
  bubbleWrapAi: { alignItems: 'flex-start' },
  bubble: {
    maxWidth: '82%',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 18,
  },
  bubbleUser: {
    backgroundColor: '#c9a96e',
    borderBottomRightRadius: 4,
  },
  bubbleAi: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: 4,
  },
  bubbleText: { fontSize: 14, color: colors.white, lineHeight: 20 },
  bubbleTextUser: { color: '#FFFFFF' },
  crisisCard: {
    position: 'absolute',
    bottom: 80,
    left: 16,
    right: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E0D0C0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  crisisTitle: { fontSize: 16, fontWeight: '700', color: colors.white, marginBottom: 8 },
  crisisBody: { fontSize: 13, color: colors.muted, marginBottom: 14, lineHeight: 19 },
  crisisHotline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#c9a96e',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  crisisHotlineText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', flex: 1 },
  crisisHotlineSub: { fontSize: 11, color: 'rgba(255,255,255,0.8)' },
  crisisDismiss: { alignItems: 'center', paddingVertical: 6 },
  crisisDismissText: { fontSize: 13, color: colors.muted },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.white,
    maxHeight: 100,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#c9a96e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
});
```

- [ ] **Step 3.2: Запустить и проверить базовый UI чата**

```bash
cd ustal && npm start
```

Проверить:
- Таб @один открывает экран с шапкой (@один, «я здесь каждый день»)
- Дисклеймер виден под шапкой
- Поле ввода и кнопка отправки присутствуют
- Отправка пока вернёт ошибку (Edge Function ещё не создана) — это ожидаемо

- [ ] **Step 3.3: Commit**

```bash
git add ustal/screens/AiChatScreen.js
git commit -m "feat(чат): AiChatScreen — экран чата с @один, кризисная карточка, UI"
```

---

## Task 4: Edge Function ai-chat

**Files:**
- Create: `supabase/functions/ai-chat/index.ts`

- [ ] **Step 4.1: Создать директорию и файл функции**

Создать `supabase/functions/ai-chat/index.ts`:

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

const SYSTEM_PROMPT = `Ты — @один, голос приложения для людей, которым бывает плохо.
Ты не психолог, не терапевт, не советчик. Ты — живой человек рядом, который умеет слушать.
Правила:
- Без советов и рекомендаций
- Без "всё будет хорошо" и позитивных заверений
- Без терапевтического языка и клише
- Без эмодзи и восклицательных знаков
- Максимум 3-4 предложения
- Только русский язык
- Говори от первого лица, тепло, без лишних слов
- Если человеку очень плохо — просто будь рядом словами, не пытайся решить проблему`;

const CRISIS_WORDS = [
  'суицид', 'не хочу жить', 'хочу умереть', 'покончить',
  'конец жизни', 'убить себя', 'убью себя',
  'нет смысла жить', 'незачем жить',
];

function detectCrisis(text: string): boolean {
  const lower = text.toLowerCase();
  return CRISIS_WORDS.some(w => lower.includes(w));
}

const CRISIS_REPLY = `Слышу тебя. Это звучит очень тяжело — и я рад, что ты написал.
Если сейчас совсем невыносимо, есть люди, которые выслушают: линия психологической помощи 8-800-2000-122, бесплатно и круглосуточно.
Я здесь.`;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, content-type',
      },
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No auth');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const geminiKey = Deno.env.get('GEMINI_API_KEY')!;

    // Верифицируем JWT и получаем user_id
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) throw new Error('Unauthorized');

    const userId = user.id;
    const { message, session_id } = await req.json();

    if (!message?.trim()) throw new Error('Empty message');

    const supabase = createClient(supabaseUrl, serviceKey);

    // 1. Загружаем профиль пользователя (уровень)
    const { data: profile } = await supabase
      .from('users')
      .select('level')
      .eq('user_id', userId)
      .single();

    const userLevel = profile?.level || 'yellow';

    // 2. Загружаем саммари предыдущей сессии (если текущая не первая)
    let previousSummary = '';
    if (session_id) {
      const { data: prevSession } = await supabase
        .from('ai_chat_sessions')
        .select('summary')
        .eq('user_id', userId)
        .not('id', 'eq', session_id)
        .not('summary', 'is', null)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      previousSummary = prevSession?.summary || '';
    }

    // 3. Загружаем последние 20 сообщений текущей сессии
    let history: { role: string; text: string }[] = [];
    if (session_id) {
      const { data: msgs } = await supabase
        .from('ai_chat_messages')
        .select('role, text')
        .eq('session_id', session_id)
        .order('created_at', { ascending: true })
        .limit(20);
      history = msgs || [];
    }

    // 4. Сохраняем сообщение пользователя
    if (session_id) {
      await supabase.from('ai_chat_messages').insert({
        user_id: userId,
        session_id,
        role: 'user',
        text: message,
      });
    }

    // 5. Проверка кризисных слов
    const isCrisis = detectCrisis(message);

    let reply = '';

    if (isCrisis) {
      reply = CRISIS_REPLY;
    } else {
      // 6. Формируем промпт для Gemini
      const historyText = history
        .map(m => `${m.role === 'user' ? 'Пользователь' : '@один'}: ${m.text}`)
        .join('\n');

      const contextParts: string[] = [];
      if (previousSummary) contextParts.push(`Предыдущий разговор: ${previousSummary}`);
      if (historyText) contextParts.push(`Текущий разговор:\n${historyText}`);
      contextParts.push(`Текущее состояние пользователя: уровень ${userLevel}`);

      const fullPrompt = `${SYSTEM_PROMPT}

${contextParts.join('\n\n')}

Пользователь: ${message}
@один:`;

      const geminiRes = await fetch(`${GEMINI_URL}?key=${geminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: fullPrompt }] }],
          generationConfig: { maxOutputTokens: 200, temperature: 0.8 },
        }),
      });

      if (!geminiRes.ok) throw new Error(`Gemini ${geminiRes.status}`);
      const geminiData = await geminiRes.json();
      reply = geminiData.candidates[0].content.parts[0].text.trim();
    }

    // 7. Сохраняем ответ @один
    if (session_id) {
      await supabase.from('ai_chat_messages').insert({
        user_id: userId,
        session_id,
        role: 'assistant',
        text: reply,
      });
    }

    return new Response(
      JSON.stringify({ ok: true, reply, ...(isCrisis ? { crisis: true } : {}) }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
});
```

- [ ] **Step 4.2: Задеплоить функцию через MCP**

```
mcp__supabase__deploy_edge_function(name: "ai-chat", files: [...])
```

- [ ] **Step 4.3: Убедиться что GEMINI_API_KEY доступен в Edge Functions**

Проверить через Supabase Dashboard → Edge Functions → Settings → Secrets что `GEMINI_API_KEY` есть. Если нет — добавить через Dashboard.

- [ ] **Step 4.4: Проверить чат end-to-end**

```bash
cd ustal && npm start
```

Открыть таб @один, написать сообщение, проверить:
- Сообщение появляется в FlatList
- @один отвечает через 1-3 секунды
- В таблице `ai_chat_messages` в Supabase Dashboard появились записи

Написать кризисное слово («не хочу жить») — проверить что появляется кризисная карточка с номером телефона.

- [ ] **Step 4.5: Реализовать генерацию саммари при закрытии экрана**

В `AiChatScreen.js` добавить `useEffect` cleanup для генерации саммари:

```js
useEffect(() => {
  return () => {
    // Генерируем саммари при уходе с экрана
    if (sessionId && messages.length > 2) {
      generateSessionSummary(sessionId, messages);
    }
  };
}, [sessionId, messages]);

async function generateSessionSummary(sid, msgs) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    await fetch(
      `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/ai-chat`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ session_id: sid, action: 'summarize' }),
      }
    );
  } catch {
    // тихо, саммари не критично
  }
}
```

В Edge Function добавить ветку для `action: 'summarize'`:

```typescript
// В начале обработки, после парсинга body:
if (body.action === 'summarize' && session_id) {
  // Загружаем все сообщения сессии
  const { data: allMsgs } = await supabase
    .from('ai_chat_messages')
    .select('role, text')
    .eq('session_id', session_id)
    .order('created_at', { ascending: true });

  if (allMsgs && allMsgs.length > 2) {
    const transcript = allMsgs
      .map(m => `${m.role === 'user' ? 'Пользователь' : '@один'}: ${m.text}`)
      .join('\n');

    const summaryPrompt = `Сделай краткое саммари этого разговора (2-3 предложения) для контекста следующей беседы. Только факты о состоянии и темах, без оценок:\n\n${transcript}`;

    const geminiRes = await fetch(`${GEMINI_URL}?key=${geminiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: summaryPrompt }] }],
        generationConfig: { maxOutputTokens: 150 },
      }),
    });

    if (geminiRes.ok) {
      const data = await geminiRes.json();
      const summary = data.candidates[0].content.parts[0].text.trim();
      await supabase.from('ai_chat_sessions')
        .update({ summary, ended_at: new Date().toISOString() })
        .eq('id', session_id);
    }
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}
```

- [ ] **Step 4.6: Задеплоить обновлённую функцию**

```
mcp__supabase__deploy_edge_function(name: "ai-chat")
```

- [ ] **Step 4.7: Commit**

```bash
git add supabase/functions/ai-chat/index.ts ustal/screens/AiChatScreen.js
git commit -m "feat(чат): Edge Function ai-chat — Gemini, кризис-детекция, саммари сессий"
```

---

## Task 5: Умная лента — ранжирование постов в FeedScreen

**Files:**
- Modify: `ustal/screens/FeedScreen.js:107-128` (loadPosts)

- [ ] **Step 5.1: Добавить функцию скоринга поста**

В `ustal/screens/FeedScreen.js` добавить перед `loadPosts` функцию скоринга:

```js
const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001';

function scorePost(post, userLevel) {
  let score = 0;

  // Посты @один — всегда высокий приоритет
  if (post.author_id === SYSTEM_USER_ID) {
    score += 10;
    // Статьи со ссылкой — ещё выше для персонализации
    if (post.link_url) score += 2;
  }

  // Пост нацелен на уровень пользователя
  const targets = post.target_levels || [];
  if (targets.length === 0 || targets.includes(userLevel)) {
    score += 3;
  }

  // Red-пользователь видит валидационные посты выше
  if (userLevel === 'red' && targets.includes('red')) {
    score += 2;
  }

  // Green-пользователь видит вопросы к диалогу выше
  if (userLevel === 'green' && targets.includes('green')) {
    score += 1;
  }

  // Свежесть: посты за последние 24ч получают бонус
  const ageHours = (Date.now() - new Date(post.created_at)) / 3600000;
  if (ageHours < 24) score += 1;

  return score;
}
```

- [ ] **Step 5.2: Применить ранжирование в loadPosts**

В функции `loadPosts` после `const newPosts = data || [];` добавить:

```js
// Ранжирование: сортируем по score, сохраняя свежесть для одинаковых score
const userLvl = store.level || 'yellow';
if (reset) {
  newPosts.sort((a, b) => scorePost(b, userLvl) - scorePost(a, userLvl));
}
```

Условие `if (reset)` важно — при подгрузке следующей страницы (loadMore) не перемешиваем.

- [ ] **Step 5.3: Запустить и проверить**

```bash
cd ustal && npm start
```

Открыть ленту при уровне `red` — посты от @один должны быть в начале. Убедиться что пагинация (pull-to-refresh и scroll to load more) работает корректно.

- [ ] **Step 5.4: Commit**

```bash
git add ustal/screens/FeedScreen.js
git commit -m "feat(лента): клиентское ранжирование постов по уровню пользователя"
```

---

## Task 6: Адаптивный вопрос дня в HomeScreen

**Files:**
- Modify: `ustal/constants.js` (добавить пулы вопросов)
- Modify: `ustal/screens/HomeScreen.js:57-62` (заменить getTodayQuestion)

- [ ] **Step 6.1: Добавить пулы вопросов по состоянию в constants.js**

В `ustal/constants.js` после `export const DAILY_QUESTIONS` добавить:

```js
// Вопросы для периодов ухудшения (уровень падает 3+ дня)
export const DAILY_QUESTIONS_RED = [
  'Что сейчас самое тяжёлое?',
  'Есть ли кто-то, кому можно написать прямо сейчас?',
  'Что помогло бы тебе прямо сейчас — даже самая маленькая вещь?',
  'Ты сегодня ел(а)? Пил(а) воду?',
  'Что ты делал(а) вчера — это помогло или нет?',
  'Есть ли что-то, что раньше помогало, когда было плохо?',
  'Что сейчас невыносимо, а что — просто тяжело?',
  'Есть ли одна маленькая вещь, которую можно сделать сегодня для себя?',
];

// Вопросы для периодов улучшения (уровень растёт)
export const DAILY_QUESTIONS_GREEN = [
  'Что изменилось за последние дни?',
  'Что помогло стать немного лучше?',
  'Есть ли что-то, что хочется сохранить из этого периода?',
  'Что бы ты сказал(а) себе неделю назад?',
  'Чем ты гордишься прямо сейчас — даже немного?',
];
```

- [ ] **Step 6.2: Заменить getTodayQuestion на адаптивную версию в HomeScreen**

В `ustal/screens/HomeScreen.js` найти функцию `getTodayQuestion` (строки 57-62) и заменить на:

```js
import {
  DAILY_QUESTIONS,
  DAILY_QUESTIONS_RED,
  DAILY_QUESTIONS_GREEN,
  // остальные импорты...
} from '../constants';

function getAdaptiveQuestion(recentHistory) {
  // recentHistory — массив последних 7 test_results, сортированных по дате (новые первые)
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const dayIdx = Math.floor((now - start) / 86400000);

  if (!recentHistory || recentHistory.length < 3) {
    return DAILY_QUESTIONS[dayIdx % DAILY_QUESTIONS.length];
  }

  // Берём последние 3 результата для определения тренда
  const levelOrder = { green: 2, yellow: 1, red: 0 };
  const recent = recentHistory.slice(0, 3);
  const scores = recent.map(r => levelOrder[r.level] ?? 1);

  // Если все 3 ухудшились (убывающий порядок)
  const isWorsening = scores[0] < scores[1] && scores[1] <= scores[2];
  // Если все 3 улучшились (возрастающий порядок)
  const isImproving = scores[0] > scores[1] && scores[1] >= scores[2];

  if (isWorsening) {
    return DAILY_QUESTIONS_RED[dayIdx % DAILY_QUESTIONS_RED.length];
  }
  if (isImproving) {
    return DAILY_QUESTIONS_GREEN[dayIdx % DAILY_QUESTIONS_GREEN.length];
  }
  return DAILY_QUESTIONS[dayIdx % DAILY_QUESTIONS.length];
}
```

- [ ] **Step 6.3: Передать recentHistory в getAdaptiveQuestion**

В `HomeScreen` уже загружается `history` (последние 5 результатов). Найти место где используется `getTodayQuestion()` и заменить на `getAdaptiveQuestion(history)`.

Поиск использования: `CTRL+F` → `getTodayQuestion()` в HomeScreen.js. Заменить на:
```js
const question = getAdaptiveQuestion(history);
```

Убедиться что `question` используется там, где раньше был прямой вызов `getTodayQuestion()`.

- [ ] **Step 6.4: Запустить и проверить**

```bash
cd ustal && npm start
```

Вопрос дня отображается. При отсутствии истории — берётся из стандартного пула. Функция не ломает другую логику HomeScreen.

- [ ] **Step 6.5: Commit**

```bash
git add ustal/constants.js ustal/screens/HomeScreen.js
git commit -m "feat(вопрос-дня): адаптивный выбор вопроса по тренду уровня за 3 дня"
```

---

## Task 7: Навигационные подсказки @один в HomeScreen

**Files:**
- Modify: `ustal/screens/HomeScreen.js`

Подсказка — dismissible карточка, показывается не чаще 1 раза в день, только при открытии HomeScreen. Используем AsyncStorage для хранения даты последнего показа.

- [ ] **Step 7.1: Добавить import AsyncStorage в HomeScreen**

```js
import AsyncStorage from '@react-native-async-storage/async-storage';
```

Проверить что пакет установлен (он используется в других местах проекта — `getLastRead` использует его):
```bash
grep -r 'AsyncStorage' ustal/screens/ | head -5
```

Если не установлен: `npx expo install @react-native-async-storage/async-storage --npm`

- [ ] **Step 7.2: Добавить state и логику подсказки в HomeScreen**

В начало `HomeScreen` добавить state:
```js
const [navHint, setNavHint] = useState(null); // { text: string } или null
```

Добавить функцию проверки подсказки. Вызывать после загрузки истории:

```js
const checkNavHint = async (recentHistory) => {
  // Проверяем, показывали ли сегодня
  const todayStr = getTodayDate();
  const lastShown = await AsyncStorage.getItem('nav_hint_last_shown');
  if (lastShown === todayStr) return; // уже показали сегодня

  // Триггер 1: 3+ дня ухудшение уровня
  if (recentHistory && recentHistory.length >= 3) {
    const levelOrder = { green: 2, yellow: 1, red: 0 };
    const scores = recentHistory.slice(0, 3).map(r => levelOrder[r.level] ?? 1);
    const isWorsening = scores[0] < scores[1] && scores[1] <= scores[2];

    if (isWorsening) {
      setNavHint({ text: 'несколько дней подряд нелегко. в ленте есть посты для таких моментов' });
      await AsyncStorage.setItem('nav_hint_last_shown', todayStr);
      return;
    }
  }

  // Триггер 2: проверяем последний визит на BreathingScreen
  const lastBreathing = await AsyncStorage.getItem('last_breathing_visit');
  if (lastBreathing) {
    const daysSince = (Date.now() - new Date(lastBreathing)) / 86400000;
    if (daysSince >= 3) {
      setNavHint({ text: 'ты уже 3 дня не заходил на дыхание — может быть сейчас?' });
      await AsyncStorage.setItem('nav_hint_last_shown', todayStr);
      return;
    }
  }
};
```

- [ ] **Step 7.3: Добавить карточку подсказки в JSX HomeScreen**

Вставить карточку перед или после вопроса дня (в ScrollView, в начале контента):

```js
{!!navHint && (
  <View style={hintStyles.card}>
    <View style={hintStyles.avatarWrap}>
      <Text style={hintStyles.avatarIcon}>✦</Text>
    </View>
    <Text style={hintStyles.text}>{navHint.text}</Text>
    <TouchableOpacity onPress={() => setNavHint(null)} activeOpacity={0.6} style={hintStyles.dismiss}>
      <Ionicons name="close" size={14} color={colors.muted} />
    </TouchableOpacity>
  </View>
)}
```

Добавить стили:
```js
const hintStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FDF6EE',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E8D4B0',
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 14,
    gap: 10,
  },
  avatarWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#c9a96e',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarIcon: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  text: { flex: 1, fontSize: 13, color: colors.white, lineHeight: 18 },
  dismiss: { padding: 4, flexShrink: 0 },
});
```

- [ ] **Step 7.4: Записывать визит на BreathingScreen**

В `ustal/screens/BreathingScreen.js` добавить запись в AsyncStorage при открытии:

```js
import AsyncStorage from '@react-native-async-storage/async-storage';

// В useEffect или useFocusEffect при монтировании:
useEffect(() => {
  AsyncStorage.setItem('last_breathing_visit', new Date().toISOString()).catch(() => {});
}, []);
```

- [ ] **Step 7.5: Вызвать checkNavHint после загрузки истории в HomeScreen**

Найти место в `useFocusEffect` где загружается история и добавить вызов:

```js
// После загрузки history (test_results):
checkNavHint(historyData);
```

- [ ] **Step 7.6: Запустить и проверить**

```bash
cd ustal && npm start
```

При наличии 3+ ухудшений в истории — карточка появляется при открытии Home. Кнопка × скрывает её. Повторный заход на Home в тот же день — карточка не показывается.

- [ ] **Step 7.7: Commit**

```bash
git add ustal/screens/HomeScreen.js ustal/screens/BreathingScreen.js
git commit -m "feat(подсказки): навигационная карточка @один в HomeScreen, триггеры по динамике и дыханию"
```

---

## Task 8: Детекция паттернов ухудшения в ai-feed-generator

**Files:**
- Modify: `supabase/functions/ai-feed-generator/index.ts`

- [ ] **Step 8.1: Добавить функцию детекции паттернов**

В `supabase/functions/ai-feed-generator/index.ts` добавить функцию после `generateResourcePosts`:

```typescript
async function detectWorseningGroup(supabase: ReturnType<typeof createClient>): Promise<string | null> {
  // Получаем test_results за последние 4 дня для всех пользователей
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 4);

  const { data: results } = await supabase
    .from('test_results')
    .select('user_id, level, created_at')
    .gte('created_at', cutoff.toISOString())
    .order('created_at', { ascending: true });

  if (!results || results.length === 0) return null;

  // Группируем по user_id
  const byUser: Record<string, { level: string; created_at: string }[]> = {};
  for (const r of results) {
    if (!byUser[r.user_id]) byUser[r.user_id] = [];
    byUser[r.user_id].push(r);
  }

  const levelOrder: Record<string, number> = { green: 2, yellow: 1, red: 0 };
  let worseningCount = 0;

  for (const uid of Object.keys(byUser)) {
    const userResults = byUser[uid].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    if (userResults.length < 3) continue;

    // Проверяем последние 3 результата: каждый хуже предыдущего
    const last3 = userResults.slice(-3);
    const scores = last3.map(r => levelOrder[r.level] ?? 1);
    const isWorsening = scores[0] > scores[1] && scores[1] >= scores[2];
    if (isWorsening) worseningCount++;
  }

  // Если ≥ 3 пользователей с ухудшением — генерируем специальный пост
  return worseningCount >= 3 ? `${worseningCount}` : null;
}
```

- [ ] **Step 8.2: Вызвать детекцию в serve() до генерации обычных постов**

В основной `Deno.serve(async () => { ... })` добавить в начало (после получения apiKey):

```typescript
// Детекция паттернов ухудшения
const worseningGroup = await detectWorseningGroup(supabase);
if (worseningGroup) {
  const supportPrompt = `Напиши 1 очень короткий пост для людей, у которых несколько дней подряд ухудшается состояние.
Тон: тепло, без советов, без позитива. Признание что это тяжело — и всё.
Формат: JSON-объект {"text": "..."}`;

  try {
    const raw = await callGemini(supportPrompt, apiKey);
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);
    if (parsed.text) {
      await supabase.from('feed_posts').insert({
        author_id: SYSTEM_USER_ID,
        author_username: '@один',
        author_level: 'red',
        text: parsed.text,
        target_levels: ['red', 'yellow'],
        likes: 0,
        link_url: null,
        link_title: null,
      });
    }
  } catch {
    // Не критично — продолжаем без паттерн-поста
  }
}
```

- [ ] **Step 8.3: Задеплоить обновлённый ai-feed-generator**

```
mcp__supabase__deploy_edge_function(name: "ai-feed-generator")
```

- [ ] **Step 8.4: Проверить функцию вручную**

Вызвать функцию через MCP или curl с `invoke: ai-feed-generator`. Проверить в логах Supabase что детекция паттернов запустилась (даже если пользователей с ухудшением нет — не должно быть ошибок).

- [ ] **Step 8.5: Commit**

```bash
git add supabase/functions/ai-feed-generator/index.ts
git commit -m "feat(паттерны): детекция ухудшения у группы пользователей → спец-пост в ленту"
```

---

## Финальная проверка

- [ ] **Навигация:** 5 табов (Главная, Лента, Чаты, @один, Профиль). Friends открывается из Профиля.
- [ ] **Чат:** Открывается, @один отвечает, история сохраняется в БД.
- [ ] **Кризис:** Слово «не хочу жить» → карточка с номером 8-800-2000-122.
- [ ] **Дисклеймер:** «@один не психолог» виден всегда в шапке чата.
- [ ] **Лента:** Посты @один в начале, red-посты выше для red-пользователя.
- [ ] **Вопрос дня:** При 3 днях ухудшения — вопрос из красного пула.
- [ ] **Подсказка:** Появляется не чаще раза в день, закрывается на ×.
- [ ] **Паттерны:** ai-feed-generator не падает при наличии/отсутствии ухудшений.

---

## Spec Coverage Check

| Требование из спека | Таск |
|---------------------|------|
| Friends → в Профиль, @один → 4-й таб | Task 1 |
| Иконка ✦ #c9a96e, AI-стикер #7B61FF | Task 1.3 |
| Таблицы ai_chat_sessions, ai_chat_messages, ai_chat_enabled | Task 2 |
| AiChatScreen: шапка, дисклеймер, история, ввод | Task 3 |
| @один знает уровень и психометрику | Task 4 (загружает level из users) |
| Контекст: последние 20 сообщений | Task 4.1 (limit 20) |
| Память: саммари предыдущей сессии | Task 4.5 |
| Кризисная защита → карточка + телефон | Task 3 (UI), Task 4 (логика) |
| Edge Function ai-chat | Task 4 |
| Умная лента (ранжирование) | Task 5 |
| Адаптивный вопрос дня | Task 6 |
| Навигационные подсказки | Task 7 |
| Детекция паттернов → пост в ленту | Task 8 |
| Монетизация: поле ai_chat_enabled готово | Task 2 |
