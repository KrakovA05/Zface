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
              `Аккаунт @${profile?.username} и все его данные будут уничтожены навсегда.`,
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
