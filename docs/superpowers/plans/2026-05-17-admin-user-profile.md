# Admin User Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Создать AdminUserProfileScreen с полным профилем пользователя, таблицей admin_actions для аудит-лога, RPC для удаления чужого аккаунта и точками входа из всех экранов.

**Architecture:** Новый Stack-экран AdminUserProfileScreen принимает `{ userId }` и загружает всё параллельно. BanModal вынесен в отдельный компонент. ChatActionMenu получает новый проп `onAdminProfile`. HomeScreen показывает разный заголовок для type=warning vs type=deletion.

**Tech Stack:** React Native + Expo, Supabase (PostgreSQL, RLS), React Navigation Stack, @expo/vector-icons

---

## Файловая карта

| Файл | Действие |
|------|----------|
| `supabase/migrations/011_admin_profile.sql` | Создать |
| `ustal/components/BanModal.js` | Создать (вынести из AdminScreen) |
| `ustal/screens/AdminUserProfileScreen.js` | Создать |
| `ustal/App.js` | Добавить импорт + Stack.Screen |
| `ustal/screens/AdminScreen.js` | Импорт BanModal, обновить навигацию |
| `ustal/components/ChatActionMenu.js` | Добавить проп onAdminProfile |
| `ustal/screens/ChatScreen.js` | Передать onAdminProfile в ChatActionMenu |
| `ustal/screens/RoomsScreen.js` | То же + avatar taps |
| `ustal/screens/FeedScreen.js` | Author tap → AdminUserProfile для admin |
| `ustal/screens/PostScreen.js` | То же для комментариев |
| `ustal/screens/HomeScreen.js` | Добавить `type` в запрос, динамический заголовок |

---

## Task 1: DB Migration

**Files:**
- Create: `supabase/migrations/011_admin_profile.sql`

- [ ] **Step 1: Создать файл миграции**

```sql
-- supabase/migrations/011_admin_profile.sql

-- Таблица лога модераторских действий
CREATE TABLE IF NOT EXISTS public.admin_actions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
  target_id   UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN ('ban','unban','warning','level_change','delete')),
  details     JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.admin_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_actions_admin_only" ON public.admin_actions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE user_id = auth.uid() AND is_admin = true)
  );

-- Колонка type для moderation_notices
ALTER TABLE public.moderation_notices
  ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'deletion'
    CHECK (type IN ('deletion', 'warning'));

-- RPC для удаления чужого аккаунта (только admin)
CREATE OR REPLACE FUNCTION public.admin_delete_user(target_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users WHERE user_id = auth.uid() AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'not_admin';
  END IF;
  DELETE FROM public.users WHERE user_id = target_id;
  DELETE FROM auth.users WHERE id = target_id;
END;
$$;
```

- [ ] **Step 2: Применить миграцию через MCP**

Выполнить SQL из файла через `mcp__supabase__execute_sql` (три блока по очереди: CREATE TABLE, ALTER TABLE, CREATE FUNCTION).

- [ ] **Step 3: Убедиться что таблица создалась**

```sql
SELECT column_name FROM information_schema.columns WHERE table_name = 'admin_actions';
```

Ожидаемый результат: колонки `id, admin_id, target_id, action_type, details, created_at`.

- [ ] **Step 4: Коммит**

```bash
git add supabase/migrations/011_admin_profile.sql
git commit -m "feat(db): таблица admin_actions, type в moderation_notices, RPC admin_delete_user"
```

---

## Task 2: Вынести BanModal в отдельный компонент

**Files:**
- Create: `ustal/components/BanModal.js`
- Modify: `ustal/screens/AdminScreen.js`

- [ ] **Step 1: Создать `ustal/components/BanModal.js`**

```javascript
import React, { useState } from 'react'
import { Modal, KeyboardAvoidingView, Platform, TouchableOpacity, View, Text, TextInput, StyleSheet } from 'react-native'
import { colors } from '../theme'

export default function BanModal({ visible, username, currentBannedUntil, onClose, onApply }) {
  const isBanned = currentBannedUntil && new Date(currentBannedUntil) > new Date()
  const [days, setDays] = useState('')
  const [reason, setReason] = useState('')

  const handleClose = () => { setDays(''); setReason(''); onClose(); }

  const handleUnban = () => {
    onApply({ bannedUntil: null, reason: '' })
    handleClose()
  }

  const handleBan = () => {
    const d = parseInt(days, 10)
    const isPermanent = !days.trim() || isNaN(d) || d <= 0
    const bannedUntil = isPermanent
      ? '2099-01-01T00:00:00Z'
      : new Date(Date.now() + d * 86400000).toISOString()
    onApply({ bannedUntil, reason: reason.trim() })
    handleClose()
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={handleClose}>
          <TouchableOpacity activeOpacity={1} style={s.card}>
            <Text style={s.title}>
              {isBanned ? `Управление баном @${username}` : `Заблокировать @${username}`}
            </Text>

            {isBanned && (
              <TouchableOpacity style={s.unbanBtn} onPress={handleUnban}>
                <Text style={s.unbanText}>Разбанить сейчас</Text>
              </TouchableOpacity>
            )}

            <Text style={s.label}>Срок (дней, пусто = навсегда)</Text>
            <TextInput
              style={s.input}
              placeholder="Например: 30"
              placeholderTextColor={colors.muted}
              value={days}
              onChangeText={setDays}
              keyboardType="number-pad"
            />

            <Text style={s.label}>Причина</Text>
            <TextInput
              style={[s.input, { height: 72, textAlignVertical: 'top' }]}
              placeholder="Спам, оскорбления, нарушение правил..."
              placeholderTextColor={colors.muted}
              value={reason}
              onChangeText={setReason}
              multiline
            />

            <View style={s.btns}>
              <TouchableOpacity style={s.cancelBtn} onPress={handleClose}>
                <Text style={s.cancelText}>Отмена</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.confirmBtn} onPress={handleBan}>
                <Text style={s.confirmText}>{isBanned ? 'Изменить бан' : 'Заблокировать'}</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: 'white', borderRadius: 20, padding: 20, width: '100%' },
  title: { fontSize: 16, fontWeight: '700', color: '#2C2420', marginBottom: 16 },
  unbanBtn: { backgroundColor: '#e8f5e9', borderRadius: 10, paddingVertical: 10, alignItems: 'center', marginBottom: 16 },
  unbanText: { color: '#5DAA72', fontWeight: '600', fontSize: 14 },
  label: { fontSize: 12, fontWeight: '600', color: '#888', marginBottom: 4, marginTop: 8 },
  input: { backgroundColor: '#FAF7F2', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#2C2420', borderWidth: 1, borderColor: '#E8DFD0', marginBottom: 4 },
  btns: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#F0E8D8', alignItems: 'center' },
  cancelText: { fontSize: 14, color: '#8B7355', fontWeight: '600' },
  confirmBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#fdecea', alignItems: 'center' },
  confirmText: { fontSize: 14, color: '#c0392b', fontWeight: '600' },
})
```

- [ ] **Step 2: Обновить AdminScreen.js — убрать локальный BanModal, импортировать из компонента**

В начале файла заменить:
```javascript
// УДАЛИТЬ весь блок function BanModal(...) { ... } (строки 16–84)
```

Добавить в импорты вверху файла:
```javascript
import BanModal from '../components/BanModal'
```

Также удалить из StyleSheet в AdminScreen.js стили BanModal которые туда были добавлены (modalOverlay, banModal, banModalTitle, unbanBtn, unbanBtnText, banFieldLabel, banInput, banModalBtns, banCancelBtn, banCancelText, banConfirmBtn, banConfirmText) — они теперь живут внутри BanModal.js.

- [ ] **Step 3: Убедиться что AdminScreen компилируется без ошибок**

```bash
cd /Users/user/Zface/ustal && npx expo export --platform ios 2>&1 | head -20
```

Ожидаемый результат: нет ошибок импорта.

- [ ] **Step 4: Коммит**

```bash
git add ustal/components/BanModal.js ustal/screens/AdminScreen.js
git commit -m "refactor(admin): BanModal вынесен в components/BanModal.js"
```

---

## Task 3: Создать AdminUserProfileScreen

**Files:**
- Create: `ustal/screens/AdminUserProfileScreen.js`

- [ ] **Step 1: Создать файл**

```javascript
import React, { useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, Modal, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect } from '@react-navigation/native'
import { supabase } from '../supabase'
import { store } from '../store'
import { colors } from '../theme'
import Avatar from '../components/Avatar'
import BanModal from '../components/BanModal'

const LEVEL_COLORS = { green: '#5DAA72', yellow: '#AA7C00', red: '#c0392b' }
const LEVEL_LABELS = { green: 'Зелёный', yellow: 'Жёлтый', red: 'Красный' }

const ACTION_LABELS = {
  ban: 'Бан',
  unban: 'Разбан',
  warning: 'Предупреждение',
  level_change: 'Смена уровня',
  delete: 'Удаление аккаунта',
}

function formatDate(str) {
  if (!str) return '—'
  return new Date(str).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatAction(action) {
  const base = `${new Date(action.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} — ${ACTION_LABELS[action.action_type] || action.action_type}`
  const d = action.details || {}
  if (action.action_type === 'ban') {
    const until = d.banned_until
    const isPerm = until && until.startsWith('2099')
    const dateStr = isPerm ? 'навсегда' : `до ${new Date(until).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}`
    return `${base} ${dateStr}${d.reason ? ` (${d.reason})` : ''}`
  }
  if (action.action_type === 'warning') return `${base}: «${d.message || ''}»`
  if (action.action_type === 'level_change') return `${base}: ${d.old_level} → ${d.new_level}`
  return base
}

export default function AdminUserProfileScreen({ route, navigation }) {
  const { userId } = route.params
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState(null)
  const [testHistory, setTestHistory] = useState([])
  const [metrics, setMetrics] = useState(null)
  const [actionLog, setActionLog] = useState([])
  const [activity, setActivity] = useState({ posts: 0, messages: 0, comments: 0, reports: 0 })
  const [banTarget, setBanTarget] = useState(null)
  const [showWarning, setShowWarning] = useState(false)
  const [warningText, setWarningText] = useState('')
  const [showLevelModal, setShowLevelModal] = useState(false)

  useFocusEffect(useCallback(() => {
    loadAll()
  }, [userId]))

  async function loadAll() {
    setLoading(true)
    const [
      profileRes,
      testsRes,
      metricsRes,
      actionsRes,
      postsRes,
      msgsRes,
      commentsRes,
      reportsRes,
    ] = await Promise.all([
      supabase.from('users').select('user_id, username, email, level, avatar_url, status, created_at, last_seen, banned_until, ban_reason').eq('user_id', userId).single(),
      supabase.from('test_results').select('level, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(8),
      supabase.from('user_metrics').select('anxiety_score, stress_score, apathy_score, loneliness_score, burnout_score, self_esteem_score, social_anxiety_score, attachment_score').eq('user_id', userId).order('week_start', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('admin_actions').select('*').eq('target_id', userId).order('created_at', { ascending: false }).limit(20),
      supabase.from('feed_posts').select('id', { count: 'exact', head: true }).eq('author_id', userId),
      supabase.from('messages').select('id', { count: 'exact', head: true }).eq('sender_id', userId),
      supabase.from('post_comments').select('id', { count: 'exact', head: true }).eq('author_id', userId),
      supabase.from('reports').select('id', { count: 'exact', head: true }).eq('reported_user_id', userId),
    ])

    setProfile(profileRes.data)
    setTestHistory(testsRes.data || [])
    setMetrics(metricsRes.data || null)
    setActionLog(actionsRes.data || [])
    setActivity({
      posts: postsRes.count || 0,
      messages: msgsRes.count || 0,
      comments: commentsRes.count || 0,
      reports: reportsRes.count || 0,
    })
    setLoading(false)
  }

  async function applyBan(targetUserId, username, { bannedUntil, reason }) {
    await supabase.from('users').update({ banned_until: bannedUntil, ban_reason: reason || null }).eq('user_id', targetUserId)
    await supabase.from('admin_actions').insert({
      admin_id: store.userId,
      target_id: targetUserId,
      action_type: bannedUntil ? 'ban' : 'unban',
      details: bannedUntil ? { banned_until: bannedUntil, reason } : {},
    })
    const msg = !bannedUntil ? `@${username} разбанен` :
      bannedUntil.startsWith('2099') ? `@${username} забанен навсегда` :
      `@${username} забанен до ${new Date(bannedUntil).toLocaleDateString('ru-RU')}`
    Alert.alert('Готово', msg)
    loadAll()
  }

  async function sendWarning() {
    if (!warningText.trim()) return
    await supabase.from('moderation_notices').insert({
      user_id: userId,
      type: 'warning',
      text: warningText.trim(),
      message_preview: warningText.trim().slice(0, 100),
    })
    await supabase.from('admin_actions').insert({
      admin_id: store.userId,
      target_id: userId,
      action_type: 'warning',
      details: { message: warningText.trim() },
    })
    setWarningText('')
    setShowWarning(false)
    Alert.alert('Отправлено', 'Предупреждение доставлено пользователю')
    loadAll()
  }

  async function changeLevel(newLevel) {
    const oldLevel = profile?.level
    await supabase.from('users').update({ level: newLevel }).eq('user_id', userId)
    await supabase.from('admin_actions').insert({
      admin_id: store.userId,
      target_id: userId,
      action_type: 'level_change',
      details: { old_level: oldLevel, new_level: newLevel },
    })
    setShowLevelModal(false)
    Alert.alert('Готово', `Уровень изменён: ${oldLevel} → ${newLevel}`)
    loadAll()
  }

  function confirmDelete() {
    Alert.alert(
      `Удалить аккаунт @${profile?.username}?`,
      'Это действие необратимо. Все данные пользователя будут удалены.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить', style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Подтвердить удаление',
              `Введите подтверждение: аккаунт @${profile?.username} и все его данные будут уничтожены навсегда.`,
              [
                { text: 'Отмена', style: 'cancel' },
                {
                  text: 'Да, удалить', style: 'destructive',
                  onPress: async () => {
                    await supabase.from('admin_actions').insert({
                      admin_id: store.userId,
                      target_id: userId,
                      action_type: 'delete',
                      details: { username: profile?.username },
                    })
                    await supabase.rpc('admin_delete_user', { target_id: userId })
                    navigation.goBack()
                  },
                },
              ]
            )
          },
        },
      ]
    )
  }

  if (loading) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="arrow-back" size={24} color={colors.white} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Профиль пользователя</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={s.center}><ActivityIndicator color={colors.accent} /></View>
      </SafeAreaView>
    )
  }

  if (!profile) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="arrow-back" size={24} color={colors.white} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Профиль пользователя</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={s.center}><Text style={s.muted}>Пользователь не найден</Text></View>
      </SafeAreaView>
    )
  }

  const isBanned = profile.banned_until && new Date(profile.banned_until) > new Date()
  const isPermanentBan = isBanned && profile.banned_until.startsWith('2099')

  const METRIC_LABELS = {
    anxiety_score: 'Тревога',
    stress_score: 'Стресс',
    apathy_score: 'Апатия',
    loneliness_score: 'Одиночество',
    burnout_score: 'Выгорание',
    self_esteem_score: 'Самооценка',
    social_anxiety_score: 'Соц. тревога',
    attachment_score: 'Привязанность',
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Хедер */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="arrow-back" size={24} color={colors.white} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Профиль пользователя</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* 1. Шапка */}
        <View style={s.card}>
          <View style={s.profileRow}>
            <Avatar uri={profile.avatar_url} username={profile.username} level={profile.level} size={56} />
            <View style={s.profileInfo}>
              <Text style={s.username}>@{profile.username}</Text>
              <View style={[s.levelBadge, { backgroundColor: (LEVEL_COLORS[profile.level] || '#888') + '22' }]}>
                <Text style={[s.levelText, { color: LEVEL_COLORS[profile.level] || '#888' }]}>
                  {LEVEL_LABELS[profile.level] || profile.level}
                </Text>
              </View>
            </View>
          </View>
          <View style={s.metaRows}>
            <Text style={s.metaLine}><Text style={s.metaKey}>Email: </Text>{profile.email || '—'}</Text>
            <Text style={s.metaLine}><Text style={s.metaKey}>Зарегистрирован: </Text>{formatDate(profile.created_at)}</Text>
            <Text style={s.metaLine}><Text style={s.metaKey}>Последний визит: </Text>{formatDate(profile.last_seen)}</Text>
          </View>
          {isBanned && (
            <View style={s.banBanner}>
              <Ionicons name="ban-outline" size={16} color="#c0392b" />
              <Text style={s.banBannerText}>
                {isPermanentBan ? 'Забанен навсегда' : `Забанен до ${formatDate(profile.banned_until)}`}
                {profile.ban_reason ? ` · ${profile.ban_reason}` : ''}
              </Text>
            </View>
          )}
        </View>

        {/* 2. Активность */}
        <Text style={s.sectionTitle}>Активность</Text>
        <View style={s.activityRow}>
          {[
            { label: 'Постов', value: activity.posts },
            { label: 'Сообщений', value: activity.messages },
            { label: 'Коммент.', value: activity.comments },
            { label: 'Жалоб', value: activity.reports, danger: activity.reports > 0 },
          ].map(({ label, value, danger }) => (
            <View key={label} style={s.activityCell}>
              <Text style={[s.activityNum, danger && { color: '#c0392b' }]}>{value}</Text>
              <Text style={s.activityLabel}>{label}</Text>
            </View>
          ))}
        </View>

        {/* 3. История уровней */}
        <Text style={s.sectionTitle}>История уровней</Text>
        <View style={s.card}>
          {testHistory.length === 0
            ? <Text style={s.muted}>Тесты не проходились</Text>
            : testHistory.map((t, i) => (
              <View key={i} style={s.historyRow}>
                <Text style={s.historyDate}>{new Date(t.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</Text>
                <Text style={[s.historyLevel, { color: LEVEL_COLORS[t.level] || '#888' }]}>{t.level}</Text>
              </View>
            ))
          }
        </View>

        {/* 4. Психометрика */}
        <Text style={s.sectionTitle}>Психометрика (последняя неделя)</Text>
        <View style={s.card}>
          {!metrics
            ? <Text style={s.muted}>Психотесты не проходились</Text>
            : Object.entries(METRIC_LABELS).map(([key, label]) => (
              metrics[key] != null && (
                <View key={key} style={s.metricRow}>
                  <Text style={s.metricLabel}>{label}</Text>
                  <Text style={s.metricValue}>{metrics[key]}</Text>
                </View>
              )
            ))
          }
        </View>

        {/* 5. История действий */}
        <Text style={s.sectionTitle}>История действий</Text>
        <View style={s.card}>
          {actionLog.length === 0
            ? <Text style={s.muted}>Действий не было</Text>
            : actionLog.map((a) => (
              <Text key={a.id} style={s.actionItem}>{formatAction(a)}</Text>
            ))
          }
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* 6. Sticky панель действий */}
      <View style={s.actions}>
        <TouchableOpacity style={[s.actionBtn, isBanned && s.actionBtnSuccess]} onPress={() => setBanTarget({ userId, username: profile.username, bannedUntil: profile.banned_until })}>
          <Ionicons name={isBanned ? 'lock-open-outline' : 'ban-outline'} size={16} color={isBanned ? '#5DAA72' : '#c0392b'} />
          <Text style={[s.actionBtnText, { color: isBanned ? '#5DAA72' : '#c0392b' }]}>{isBanned ? 'Разбанить' : 'Забанить'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.actionBtn} onPress={() => setShowWarning(true)}>
          <Ionicons name="warning-outline" size={16} color={colors.accent} />
          <Text style={[s.actionBtnText, { color: colors.accent }]}>Предупреждение</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.actionBtn} onPress={() => setShowLevelModal(true)}>
          <Ionicons name="swap-vertical-outline" size={16} color={colors.accent} />
          <Text style={[s.actionBtnText, { color: colors.accent }]}>Уровень</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.actionBtn, s.actionBtnDanger]} onPress={confirmDelete}>
          <Ionicons name="trash-outline" size={16} color="#c0392b" />
          <Text style={[s.actionBtnText, { color: '#c0392b' }]}>Удалить</Text>
        </TouchableOpacity>
      </View>

      {/* BanModal */}
      <BanModal
        visible={!!banTarget}
        username={banTarget?.username || ''}
        currentBannedUntil={banTarget?.bannedUntil}
        onClose={() => setBanTarget(null)}
        onApply={({ bannedUntil, reason }) => {
          applyBan(banTarget.userId, banTarget.username, { bannedUntil, reason })
          setBanTarget(null)
        }}
      />

      {/* Модал предупреждения */}
      <Modal visible={showWarning} transparent animationType="slide" onRequestClose={() => setShowWarning(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setShowWarning(false)}>
            <TouchableOpacity activeOpacity={1} style={s.modalCard}>
              <Text style={s.modalTitle}>Предупреждение для @{profile.username}</Text>
              <TextInput
                style={[s.modalInput, { height: 100, textAlignVertical: 'top' }]}
                placeholder="Текст предупреждения..."
                placeholderTextColor={colors.muted}
                value={warningText}
                onChangeText={setWarningText}
                multiline
                autoFocus
              />
              <TouchableOpacity
                style={[s.modalSendBtn, !warningText.trim() && { opacity: 0.4 }]}
                onPress={sendWarning}
                disabled={!warningText.trim()}
              >
                <Text style={s.modalSendText}>Отправить</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* Модал смены уровня */}
      <Modal visible={showLevelModal} transparent animationType="fade" onRequestClose={() => setShowLevelModal(false)}>
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setShowLevelModal(false)}>
          <TouchableOpacity activeOpacity={1} style={s.modalCard}>
            <Text style={s.modalTitle}>Изменить уровень @{profile.username}</Text>
            {['green', 'yellow', 'red'].map(lvl => (
              <TouchableOpacity
                key={lvl}
                style={[s.levelOption, profile.level === lvl && { backgroundColor: (LEVEL_COLORS[lvl]) + '22' }]}
                onPress={() => changeLevel(lvl)}
              >
                <View style={[s.levelDot, { backgroundColor: LEVEL_COLORS[lvl] }]} />
                <Text style={[s.levelOptionText, { color: LEVEL_COLORS[lvl] }]}>{LEVEL_LABELS[lvl]}</Text>
                {profile.level === lvl && <Ionicons name="checkmark" size={18} color={LEVEL_COLORS[lvl]} style={{ marginLeft: 'auto' }} />}
              </TouchableOpacity>
            ))}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#E8DFD0' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.white },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 16 },
  card: { backgroundColor: 'white', borderRadius: 16, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: '#E8DFD0' },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: colors.muted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6, marginTop: 12 },
  muted: { color: colors.muted, fontSize: 14 },

  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 12 },
  profileInfo: { flex: 1 },
  username: { fontSize: 18, fontWeight: '700', color: colors.white, marginBottom: 6 },
  levelBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  levelText: { fontSize: 12, fontWeight: '600' },
  metaRows: { gap: 4 },
  metaLine: { fontSize: 13, color: colors.muted },
  metaKey: { color: colors.white, fontWeight: '600' },
  banBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fdecea', borderRadius: 10, padding: 10, marginTop: 10 },
  banBannerText: { fontSize: 13, color: '#c0392b', flex: 1 },

  activityRow: { flexDirection: 'row', backgroundColor: 'white', borderRadius: 16, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#E8DFD0' },
  activityCell: { flex: 1, alignItems: 'center' },
  activityNum: { fontSize: 20, fontWeight: '700', color: colors.white },
  activityLabel: { fontSize: 11, color: colors.muted, marginTop: 2 },

  historyRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F0E8D8' },
  historyDate: { fontSize: 13, color: colors.muted },
  historyLevel: { fontSize: 13, fontWeight: '600' },

  metricRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F0E8D8' },
  metricLabel: { fontSize: 14, color: colors.white },
  metricValue: { fontSize: 14, fontWeight: '700', color: colors.white },

  actionItem: { fontSize: 13, color: colors.white, paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#F0E8D8' },

  actions: {
    flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: 'white', borderTopWidth: 1, borderTopColor: '#E8DFD0', gap: 8,
  },
  actionBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 12, backgroundColor: '#F0E8D8', gap: 4 },
  actionBtnSuccess: { backgroundColor: '#e8f5e9' },
  actionBtnDanger: { backgroundColor: '#fdecea' },
  actionBtnText: { fontSize: 11, fontWeight: '600' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 16, fontWeight: '700', color: colors.white, marginBottom: 14 },
  modalInput: { backgroundColor: 'white', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: colors.white, borderWidth: 1, borderColor: '#E8DFD0', marginBottom: 14 },
  modalSendBtn: { backgroundColor: colors.accent, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  modalSendText: { color: 'white', fontWeight: '600', fontSize: 15 },

  levelOption: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 4, borderRadius: 10, marginBottom: 4 },
  levelDot: { width: 12, height: 12, borderRadius: 6 },
  levelOptionText: { fontSize: 15, fontWeight: '600' },
})
```

- [ ] **Step 2: Коммит**

```bash
git add ustal/screens/AdminUserProfileScreen.js
git commit -m "feat(admin): AdminUserProfileScreen — полный профиль пользователя для модератора"
```

---

## Task 4: Зарегистрировать экран в App.js

**Files:**
- Modify: `ustal/App.js`

- [ ] **Step 1: Добавить импорт после строки `import AdminScreen`**

```javascript
import AdminUserProfileScreen from './screens/AdminUserProfileScreen';
```

- [ ] **Step 2: Добавить Stack.Screen после строки с `Admin`**

```jsx
<Stack.Screen name="AdminUserProfile" component={AdminUserProfileScreen} options={{ headerShown: false }} />
```

- [ ] **Step 3: Коммит**

```bash
git add ustal/App.js
git commit -m "feat(nav): зарегистрировать маршрут AdminUserProfile"
```

---

## Task 5: Обновить точки входа в AdminScreen

**Files:**
- Modify: `ustal/screens/AdminScreen.js`

- [ ] **Step 1: В таба «Пользователи» — кнопка «Профиль» открывает AdminUserProfile**

Найти в `UsersTab` (около строки где `navigation.navigate('UserProfile', ...)`):
```javascript
// БЫЛО:
onPress={() => navigation.navigate('UserProfile', { user: { user_id: item.user_id, username: item.username, level: item.level, avatar_url: null, status: '' } })}

// СТАЛО:
onPress={() => navigation.navigate('AdminUserProfile', { userId: item.user_id })}
```

- [ ] **Step 2: В таба «Жалобы» — имя нарушителя становится тапабельным**

Найти в `ReportsTab` рендер имени нарушителя:
```jsx
// БЫЛО:
<Text style={{ color: LEVEL_COLORS[item.reported?.level] || colors.accent }}>
  @{item.reported?.username || '?'}
</Text>

// СТАЛО:
<TouchableOpacity onPress={() => item.reported_user_id && navigation.navigate('AdminUserProfile', { userId: item.reported_user_id })}>
  <Text style={{ color: LEVEL_COLORS[item.reported?.level] || colors.accent }}>
    @{item.reported?.username || '?'}
  </Text>
</TouchableOpacity>
```

Для этого `ReportsTab` должен получить `navigation` как проп. Изменить объявление:
```javascript
// БЫЛО:
function ReportsTab() {

// СТАЛО:
function ReportsTab({ navigation }) {
```

И обновить вызов в `AdminScreen`:
```jsx
// БЫЛО:
{tab === 0 && <ReportsTab />}

// СТАЛО:
{tab === 0 && <ReportsTab navigation={navigation} />}
```

- [ ] **Step 3: Коммит**

```bash
git add ustal/screens/AdminScreen.js
git commit -m "feat(admin): навигация к AdminUserProfile из обоих табов"
```

---

## Task 6: Обновить ChatActionMenu + ChatScreen + RoomsScreen

**Files:**
- Modify: `ustal/components/ChatActionMenu.js`
- Modify: `ustal/screens/ChatScreen.js`
- Modify: `ustal/screens/RoomsScreen.js`

- [ ] **Step 1: Добавить проп `onAdminProfile` в ChatActionMenu**

В `ustal/components/ChatActionMenu.js` изменить сигнатуру и добавить пункт меню:

```javascript
// БЫЛО:
export default function ChatActionMenu({ message, isOwn, onClose, onReply, onEdit, onDelete, onReact, onReport }) {

// СТАЛО:
export default function ChatActionMenu({ message, isOwn, onClose, onReply, onEdit, onDelete, onReact, onReport, onAdminProfile }) {
```

После пункта `onReport`:
```jsx
// ДОБАВИТЬ после строки с onReport:
{onAdminProfile && <Item icon="person-outline" label="Профиль пользователя" onPress={() => { onAdminProfile(); onClose(); }} />}
```

- [ ] **Step 2: Обновить ChatScreen — передать onAdminProfile в ChatActionMenu**

В `ustal/screens/ChatScreen.js` найти `<ChatActionMenu` и добавить проп:
```jsx
<ChatActionMenu
  message={menuMsg}
  isOwn={menuMsg ? menuMsg.sender_id === store.userId : false}
  onClose={() => setMenuMsg(null)}
  onReply={() => startReply(menuMsg)}
  onEdit={() => startEdit(menuMsg)}
  onDelete={() => { deleteMessage(menuMsg); setMenuMsg(null); }}
  onReact={(emoji) => toggleReaction(menuMsg.id, emoji)}
  onReport={() => reportMessage(menuMsg)}
  onAdminProfile={store.isAdmin && menuMsg && menuMsg.sender_id !== store.userId
    ? () => { setMenuMsg(null); navigation.navigate('AdminUserProfile', { userId: menuMsg.sender_id }); }
    : undefined}
/>
```

- [ ] **Step 3: Обновить RoomsScreen — то же самое**

В `ustal/screens/RoomsScreen.js` найти `<ChatActionMenu` и добавить проп аналогично:
```jsx
onAdminProfile={store.isAdmin && menuMsg && menuMsg.sender_id !== store.userId
  ? () => { setMenuMsg(null); navigation.navigate('AdminUserProfile', { userId: menuMsg.sender_id }); }
  : undefined}
```

- [ ] **Step 4: Коммит**

```bash
git add ustal/components/ChatActionMenu.js ustal/screens/ChatScreen.js ustal/screens/RoomsScreen.js
git commit -m "feat(admin): пункт «Профиль пользователя» в меню сообщения для администратора"
```

---

## Task 7: Обновить FeedScreen и PostScreen

**Files:**
- Modify: `ustal/screens/FeedScreen.js`
- Modify: `ustal/screens/PostScreen.js`

- [ ] **Step 1: FeedScreen — author tap → AdminUserProfile для admin**

Найти в `FeedScreen.js` (около строки 287):
```javascript
// БЫЛО:
navigation.navigate('UserProfile', {
  user: { user_id: item.author_id, username: item.author_username, level: levelMap[item.author_id] || item.author_level, avatar_url: null, status: '', labels: [] },
})

// СТАЛО:
if (store.isAdmin) {
  navigation.navigate('AdminUserProfile', { userId: item.author_id })
} else {
  navigation.navigate('UserProfile', {
    user: { user_id: item.author_id, username: item.author_username, level: levelMap[item.author_id] || item.author_level, avatar_url: null, status: '', labels: [] },
  })
}
```

- [ ] **Step 2: PostScreen — добавить навигацию с имени автора комментария**

В `PostScreen.js` найти рендер комментария (строки ~136-158). Обернуть `item.author_username` в `TouchableOpacity`:

```jsx
// БЫЛО (около строки 139):
<Text style={[styles.commentAuthor, { color: cColor }]}>{item.author_username}</Text>

// СТАЛО:
<TouchableOpacity
  onPress={() => {
    if (item.author_id === store.userId) return
    if (store.isAdmin) {
      navigation.navigate('AdminUserProfile', { userId: item.author_id })
    } else {
      navigation.navigate('UserProfile', { user: { user_id: item.author_id, username: item.author_username, level: item.author_level, avatar_url: null, status: '' } })
    }
  }}
>
  <Text style={[styles.commentAuthor, { color: cColor }]}>{item.author_username}</Text>
</TouchableOpacity>
```

Также обернуть автора поста (строка ~158):
```jsx
// БЫЛО:
<Text style={[styles.postAuthor, { color: lvlColor }]}>{post.author_username}</Text>

// СТАЛО:
<TouchableOpacity
  onPress={() => {
    if (!post.author_id || post.author_id === store.userId) return
    if (store.isAdmin) {
      navigation.navigate('AdminUserProfile', { userId: post.author_id })
    } else {
      navigation.navigate('UserProfile', { user: { user_id: post.author_id, username: post.author_username, level: post.author_level, avatar_url: null, status: '' } })
    }
  }}
>
  <Text style={[styles.postAuthor, { color: lvlColor }]}>{post.author_username}</Text>
</TouchableOpacity>
```

- [ ] **Step 3: Коммит**

```bash
git add ustal/screens/FeedScreen.js ustal/screens/PostScreen.js
git commit -m "feat(admin): тап на автора поста/комментария открывает AdminUserProfile для администратора"
```

---

## Task 8: Обновить HomeScreen — динамический заголовок modNotice

**Files:**
- Modify: `ustal/screens/HomeScreen.js`

- [ ] **Step 1: Добавить `type` в запрос moderation_notices**

Найти запрос (около строки 422-429):
```javascript
// БЫЛО:
.select('id, message_preview, created_at')

// СТАЛО:
.select('id, message_preview, created_at, type')
```

- [ ] **Step 2: Обновить заголовок и тело модала**

Найти строки (~1163-1169):
```jsx
// БЫЛО:
<Text style={styles.modTitle}>Сообщение удалено</Text>
<Text style={styles.modBody}>
  Ваше сообщение было удалено за нарушение правил сообщества.
  {modNotice?.message_preview ? `\n\n«${modNotice.message_preview}»` : ''}
</Text>

// СТАЛО:
<Text style={styles.modTitle}>
  {modNotice?.type === 'warning' ? 'Предупреждение от модератора' : 'Сообщение удалено'}
</Text>
<Text style={styles.modBody}>
  {modNotice?.type === 'warning'
    ? (modNotice?.message_preview || 'Пожалуйста, соблюдай правила сообщества.')
    : `Ваше сообщение было удалено за нарушение правил сообщества.${modNotice?.message_preview ? `\n\n«${modNotice.message_preview}»` : ''}`
  }
</Text>
```

- [ ] **Step 3: Коммит**

```bash
git add ustal/screens/HomeScreen.js
git commit -m "feat(home): динамический заголовок модала модерации — различает удаление и предупреждение"
```

---

## Финальная проверка

- [ ] Зайти в приложение как admin
- [ ] Открыть AdminScreen → Пользователи → найти юзера → убедиться что открывается AdminUserProfileScreen
- [ ] Открыть AdminScreen → Жалобы → тапнуть на имя нарушителя → AdminUserProfileScreen
- [ ] Открыть чат → длинный тап на чужое сообщение → видеть пункт «Профиль пользователя»
- [ ] Открыть ленту → тапнуть на имя автора → AdminUserProfileScreen
- [ ] Отправить предупреждение юзеру → на его HomeScreen появляется модал с заголовком «Предупреждение от модератора»
- [ ] Проверить что история действий пишется в admin_actions
