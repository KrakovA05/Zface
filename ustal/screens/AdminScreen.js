import React, { useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  TextInput, ActivityIndicator, ScrollView, Modal, KeyboardAvoidingView, Platform
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect } from '@react-navigation/native'
import { supabase } from '../supabase'
import { store } from '../store'
import { colors } from '../theme'
import BanModal from '../components/BanModal'
import { showAlert } from '../utils/alert';

const TABS = ['Жалобы', 'Письма', 'Пользователи', 'Статистика']
const LEVEL_COLORS = { green: '#5DAA72', yellow: '#AA7C00', red: '#c0392b' }

export default function AdminScreen({ navigation }) {
  const [tab, setTab] = useState(0)

  return (
    <View style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="arrow-back" size={24} color={colors.white} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Панель модератора</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Tabs */}
      <View style={s.tabBar}>
        {TABS.map((t, i) => (
          <TouchableOpacity key={t} style={[s.tab, tab === i && s.tabActive]} onPress={() => setTab(i)}>
            <Text style={[s.tabText, tab === i && s.tabTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 0 && <ReportsTab navigation={navigation} />}
      {tab === 1 && <LettersTab />}
      {tab === 2 && <UsersTab navigation={navigation} />}
      {tab === 3 && <StatsTab />}
    </View>
  )
}

// ── REPORTS TAB ──────────────────────────────────────────────────
function ReportsTab({ navigation }) {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending')
  const [banTarget, setBanTarget] = useState(null) // { userId, username, bannedUntil }

  useFocusEffect(useCallback(() => {
    loadReports()
  }, [filter]))

  async function loadReports() {
    setLoading(true)
    let q = supabase
      .from('reports')
      .select('id, reason, created_at, resolved, reporter_id, reported_user_id')
      .order('created_at', { ascending: false })
      .limit(50)
    if (filter === 'pending') q = q.eq('resolved', false)
    const { data } = await q
    // Загружаем никнеймы
    if (data && data.length > 0) {
      const ids = [...new Set([...data.map(r => r.reporter_id), ...data.map(r => r.reported_user_id)])]
      const { data: users } = await supabase.from('users').select('user_id, username, level').in('user_id', ids)
      const userMap = Object.fromEntries((users || []).map(u => [u.user_id, u]))
      setReports(data.map(r => ({
        ...r,
        reporter: userMap[r.reporter_id],
        reported: userMap[r.reported_user_id],
      })))
    } else {
      setReports([])
    }
    setLoading(false)
  }

  async function resolveReport(id) {
    await supabase.from('reports').update({
      resolved: true,
      resolved_at: new Date().toISOString(),
      resolved_by: store.userId,
    }).eq('id', id)
    setReports(prev => prev.filter(r => r.id !== id))
  }

  async function applyBan(userId, username, { bannedUntil, reason }) {
    await supabase.from('users').update({ banned_until: bannedUntil, ban_reason: reason || null }).eq('user_id', userId)
    const { error: fnErr } = await supabase.functions.invoke('ban-notify', { body: { userId, bannedUntil, reason } })
    if (fnErr) console.warn('ban-notify error:', fnErr)
    const msg = !bannedUntil ? `@${username} разбанен` :
      bannedUntil.startsWith('2099') ? `@${username} забанен навсегда` :
      `@${username} забанен до ${new Date(bannedUntil).toLocaleDateString('ru-RU')}`
    showAlert('Готово', msg)
  }

  if (loading) return <View style={s.center}><ActivityIndicator color={colors.accent} /></View>

  return (
    <View style={{ flex: 1 }}>
      <View style={s.filterRow}>
        <TouchableOpacity style={[s.filterBtn, filter === 'pending' && s.filterBtnActive]} onPress={() => setFilter('pending')}>
          <Text style={[s.filterBtnText, filter === 'pending' && s.filterBtnTextActive]}>Новые</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.filterBtn, filter === 'all' && s.filterBtnActive]} onPress={() => setFilter('all')}>
          <Text style={[s.filterBtnText, filter === 'all' && s.filterBtnTextActive]}>Все</Text>
        </TouchableOpacity>
      </View>
      {reports.length === 0
        ? <View style={s.center}><Text style={s.empty}>Новых жалоб нет</Text></View>
        : (
          <FlatList
            data={reports}
            keyExtractor={r => r.id}
            contentContainerStyle={{ padding: 12 }}
            renderItem={({ item }) => (
              <View style={s.reportCard}>
                <View style={s.reportHeader}>
                  <Text style={s.reportUser}>
                    <Text style={s.reportLabel}>Жалоба на: </Text>
                    <TouchableOpacity onPress={() => item.reported_user_id && navigation.navigate('AdminUserProfile', { userId: item.reported_user_id })}>
                      <Text style={{ color: LEVEL_COLORS[item.reported?.level] || colors.accent }}>
                        @{item.reported?.username || '?'}
                      </Text>
                    </TouchableOpacity>
                  </Text>
                  {item.resolved && <View style={s.resolvedBadge}><Text style={s.resolvedText}>решено</Text></View>}
                </View>
                <Text style={s.reportReason}>{item.reason}</Text>
                <Text style={s.reportMeta}>
                  от @{item.reporter?.username || '?'} · {new Date(item.created_at).toLocaleDateString('ru')}
                </Text>
                {!item.resolved && (
                  <View style={s.reportActions}>
                    <TouchableOpacity style={s.actionBtn} onPress={() => resolveReport(item.id)}>
                      <Text style={s.actionBtnText}>Отметить решённой</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.actionBtn, s.actionBtnDanger]} onPress={() => setBanTarget({ userId: item.reported_user_id, username: item.reported?.username, bannedUntil: null })}>
                      <Text style={[s.actionBtnText, { color: '#c0392b' }]}>Заблокировать</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          />
        )
      }
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
    </View>
  )
}

// ── LETTERS TAB ──────────────────────────────────────────────────
function LettersTab() {
  const [letters, setLetters] = useState([])
  const [loading, setLoading] = useState(true)

  useFocusEffect(useCallback(() => {
    loadLetters()
  }, []))

  async function loadLetters() {
    setLoading(true)
    const { data } = await supabase
      .from('support_requests')
      .select('id, category, subject, message, username, user_id, created_at')
      .order('created_at', { ascending: false })
      .limit(100)
    setLetters(data || [])
    setLoading(false)
  }

  if (loading) return <View style={s.center}><ActivityIndicator color={colors.accent} /></View>

  return letters.length === 0
    ? <View style={s.center}><Text style={s.empty}>Писем нет</Text></View>
    : (
      <FlatList
        data={letters}
        keyExtractor={l => l.id}
        contentContainerStyle={{ padding: 12 }}
        renderItem={({ item }) => (
          <View style={s.reportCard}>
            <View style={s.reportHeader}>
              <Text style={[s.reportLabel, { fontWeight: '700' }]}>{item.category}</Text>
              <Text style={s.reportMeta}>{new Date(item.created_at).toLocaleDateString('ru')}</Text>
            </View>
            <Text style={s.reportReason}>{item.subject}</Text>
            <Text style={[s.reportReason, { color: colors.white, marginTop: 4 }]}>{item.message}</Text>
            <Text style={s.reportMeta}>от @{item.username || '?'}</Text>
          </View>
        )}
      />
    )
}

// ── USERS TAB ─────────────────────────────────────────────────────
function UsersTab({ navigation }) {
  const [query, setQuery] = useState('')
  const [allUsers, setAllUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [banTarget, setBanTarget] = useState(null)

  useFocusEffect(useCallback(() => {
    loadAllUsers()
  }, []))

  async function loadAllUsers() {
    setLoading(true)
    const { data } = await supabase
      .from('users')
      .select('user_id, username, level, email, created_at, is_admin, banned_until')
      .order('username', { ascending: true })
    setAllUsers(data || [])
    setLoading(false)
  }

  const users = query.trim()
    ? allUsers.filter(u => u.username.toLowerCase().includes(query.trim().toLowerCase()))
    : allUsers

  function search() { /* фильтрация клиентская через переменную users */ }

  async function toggleAdmin(userId, currentAdmin, username) {
    const newVal = !currentAdmin
    await supabase.from('users').update({ is_admin: newVal }).eq('user_id', userId)
    setAllUsers(prev => prev.map(u => u.user_id === userId ? { ...u, is_admin: newVal } : u))
    showAlert('Готово', `@${username} ${newVal ? 'получил права модератора' : 'лишён прав модератора'}`)
  }

  async function applyBan(userId, username, { bannedUntil, reason }) {
    await supabase.from('users').update({ banned_until: bannedUntil, ban_reason: reason || null }).eq('user_id', userId)
    setAllUsers(prev => prev.map(u => u.user_id === userId ? { ...u, banned_until: bannedUntil } : u))
    const { error: fnErr } = await supabase.functions.invoke('ban-notify', { body: { userId, bannedUntil, reason } })
    if (fnErr) console.warn('ban-notify error:', fnErr)
    const msg = !bannedUntil ? `@${username} разбанен` :
      bannedUntil.startsWith('2099') ? `@${username} забанен навсегда` :
      `@${username} забанен до ${new Date(bannedUntil).toLocaleDateString('ru-RU')}`
    showAlert('Готово', msg)
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={s.searchRow}>
        <TextInput
          style={s.searchInput}
          placeholder="Поиск по никнейму..."
          placeholderTextColor={colors.muted}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={search}
          autoCapitalize="none"
        />
        <TouchableOpacity style={s.searchBtn} onPress={search}>
          <Ionicons name="search" size={20} color="white" />
        </TouchableOpacity>
      </View>
      {loading
        ? <View style={s.center}><ActivityIndicator color={colors.accent} /></View>
        : (
          <FlatList
            data={users}
            keyExtractor={u => u.user_id}
            ListHeaderComponent={<Text style={s.usersCount}>{users.length} пользователей</Text>}
            contentContainerStyle={{ padding: 12 }}
            renderItem={({ item }) => (
              <View style={s.userCard}>
                <View style={s.userInfo}>
                  <View style={[s.levelDot, { backgroundColor: LEVEL_COLORS[item.level] || '#ccc' }]} />
                  <View>
                    <Text style={s.userName}>@{item.username}</Text>
                    <Text style={s.userMeta}>{item.level} · {new Date(item.created_at).toLocaleDateString('ru')}</Text>
                  </View>
                  {item.is_admin && <View style={s.adminBadge}><Text style={s.adminBadgeText}>admin</Text></View>}
                  {item.banned_until && new Date(item.banned_until) > new Date() && (
                    <View style={s.bannedBadge}><Text style={s.bannedBadgeText}>ban</Text></View>
                  )}
                </View>
                <View style={s.userActions}>
                  <TouchableOpacity
                    style={s.actionBtn}
                    onPress={() => navigation.navigate('AdminUserProfile', { userId: item.user_id })}
                  >
                    <Text style={s.actionBtnText}>Профиль</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.actionBtn, item.is_admin && s.actionBtnDanger]}
                    onPress={() => toggleAdmin(item.user_id, item.is_admin, item.username)}
                  >
                    <Text style={[s.actionBtnText, item.is_admin && { color: '#c0392b' }]}>
                      {item.is_admin ? 'Снять admin' : 'Дать admin'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.actionBtn, (item.banned_until && new Date(item.banned_until) > new Date()) ? s.actionBtnSuccess : s.actionBtnDanger]}
                    onPress={() => setBanTarget({ userId: item.user_id, username: item.username, bannedUntil: item.banned_until })}
                  >
                    <Text style={[s.actionBtnText, { color: (item.banned_until && new Date(item.banned_until) > new Date()) ? '#5DAA72' : '#c0392b' }]}>
                      {(item.banned_until && new Date(item.banned_until) > new Date()) ? 'Разбанить' : 'Забанить'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
        )
      }
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
    </View>
  )
}

// ── STATS TAB ─────────────────────────────────────────────────────
function StatsTab() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useFocusEffect(useCallback(() => {
    loadStats()
  }, []))

  async function loadStats() {
    setLoading(true)
    const todayStart = new Date(); todayStart.setHours(0,0,0,0)
    const tomorrow = new Date(todayStart); tomorrow.setDate(tomorrow.getDate() + 1)
    const sevenDays = new Date(Date.now() - 7*24*60*60*1000).toISOString()
    const thirtyDays = new Date(Date.now() - 30*24*60*60*1000).toISOString()

    const [
      green, yellow, red,
      dau, wau, mau,
      new7, new30,
      streakData,
      totalR, pendingR,
      friendsData,
      msgData, checkinData, postData, commentData,
      answerData, testData, letterData, thoughtData,
      fishData, dmData,
      newUsersData, testResultsData,
      eventsData,
      cohortsData,
    ] = await Promise.all([
      supabase.from('users').select('user_id', { count: 'exact', head: true }).eq('level', 'green'),
      supabase.from('users').select('user_id', { count: 'exact', head: true }).eq('level', 'yellow'),
      supabase.from('users').select('user_id', { count: 'exact', head: true }).eq('level', 'red'),
      supabase.from('users').select('user_id', { count: 'exact', head: true })
        .gte('last_seen', todayStart.toISOString()).lt('last_seen', tomorrow.toISOString()),
      supabase.from('users').select('user_id', { count: 'exact', head: true }).gte('last_seen', sevenDays),
      supabase.from('users').select('user_id', { count: 'exact', head: true }).gte('last_seen', thirtyDays),
      supabase.from('users').select('user_id', { count: 'exact', head: true }).gte('created_at', sevenDays),
      supabase.from('users').select('user_id', { count: 'exact', head: true }).gte('created_at', thirtyDays),
      supabase.from('users').select('login_streak'),
      supabase.from('reports').select('id', { count: 'exact', head: true }),
      supabase.from('reports').select('id', { count: 'exact', head: true }).eq('resolved', false),
      supabase.from('friendships').select('requester_id, receiver_id').eq('status', 'accepted'),
      supabase.from('messages').select('sender_id').gte('created_at', sevenDays).not('sender_id', 'is', null),
      supabase.from('mood_checkins').select('user_id').gte('created_at', sevenDays),
      supabase.from('feed_posts').select('author_id').gte('created_at', sevenDays),
      supabase.from('post_comments').select('author_id').gte('created_at', sevenDays),
      supabase.from('daily_answers').select('user_id').gte('created_at', sevenDays),
      supabase.from('test_results').select('user_id').gte('created_at', sevenDays),
      supabase.from('anonymous_letters').select('author_id').gte('created_at', sevenDays),
      supabase.from('anonymous_thoughts').select('user_id').gte('created_at', sevenDays),
      supabase.from('caught_fish').select('user_id').gte('created_at', sevenDays),
      supabase.from('direct_messages').select('sender_id').gte('created_at', sevenDays).not('sender_id', 'is', null),
      supabase.from('users').select('user_id, created_at, last_seen').gte('created_at', thirtyDays),
      supabase.from('test_results').select('user_id').gte('created_at', thirtyDays),
      supabase.from('events')
        .select('event_name, user_id')
        .in('event_name', ['fishing_open','breathing_open','resources_open',
                           'psych_test_start','room_join','friend_added'])
        .gte('created_at', sevenDays),
      supabase.from('retention_cohorts')
        .select('cohort_week, week_offset, cohort_size, retained')
        .order('cohort_week', { ascending: false })
        .limit(50),
    ])

    const streakValues = (streakData.data || []).map(u => u.login_streak || 0)
    const avgStreak = streakValues.length
      ? (streakValues.reduce((a, b) => a + b, 0) / streakValues.length).toFixed(1)
      : 0

    const totalUsers = (green.count||0) + (yellow.count||0) + (red.count||0)
    const usersWithFriends = new Set([
      ...(friendsData.data || []).map(f => f.requester_id),
      ...(friendsData.data || []).map(f => f.receiver_id),
    ]).size
    const friendsPct = totalUsers ? Math.round(usersWithFriends / totalUsers * 100) : 0

    const uniq = (arr, key) => new Set((arr || []).map(r => r[key])).size
    const features = [
      { label: 'Чат', count: uniq(msgData.data, 'sender_id') },
      { label: 'Чекин', count: uniq(checkinData.data, 'user_id') },
      { label: 'Посты', count: uniq(postData.data, 'author_id') },
      { label: 'Комменты', count: uniq(commentData.data, 'author_id') },
      { label: 'Вопрос дня', count: uniq(answerData.data, 'user_id') },
      { label: 'Тест уровня', count: uniq(testData.data, 'user_id') },
      { label: 'Письма', count: uniq(letterData.data, 'author_id') },
      { label: 'Мысли', count: uniq(thoughtData.data, 'user_id') },
      { label: 'Рыбалка', count: uniq(fishData.data, 'user_id') },
      { label: 'DM', count: uniq(dmData.data, 'sender_id') },
    ]

    // Дополняем events-данными (фичи без своих таблиц)
    const eventLabels = {
      fishing_open:     'Рыбалка',
      breathing_open:   'Дыхание',
      resources_open:   'Ресурсы',
      psych_test_start: 'Псих. тест',
      room_join:        'Комнаты',
      friend_added:     'Друзья',
    }
    const eventsMap = {}
    ;(eventsData.data || []).forEach(e => {
      if (!eventsMap[e.event_name]) eventsMap[e.event_name] = new Set()
      eventsMap[e.event_name].add(e.user_id)
    })
    Object.entries(eventLabels).forEach(([name, label]) => {
      const count = eventsMap[name]?.size || 0
      const existing = features.find(f => f.label === label)
      if (existing) {
        existing.count = Math.max(existing.count, count)
      } else {
        features.push({ label, count })
      }
    })
    features.sort((a, b) => b.count - a.count)
    const maxFeature = Math.max(1, ...features.map(f => f.count))

    // Когортная сетка
    const cohortMap = {}
    ;(cohortsData.data || []).forEach(row => {
      const wk = row.cohort_week
      if (!cohortMap[wk]) cohortMap[wk] = { size: 0, w1: null, w2: null, w4: null, w8: null }
      if (row.week_offset === 0) cohortMap[wk].size = row.cohort_size
      else cohortMap[wk][`w${row.week_offset}`] = row.retained
    })
    const cohortRows = Object.entries(cohortMap)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 8)
      .map(([week, data]) => ({ week, ...data }))

    const funnel30 = newUsersData.data || []
    const testedIds = new Set((testResultsData.data || []).map(t => t.user_id))
    const fRegistered = funnel30.length
    const fTested = funnel30.filter(u => testedIds.has(u.user_id)).length
    const ms = (days) => days * 24 * 60 * 60 * 1000
    const fDay2 = funnel30.filter(u => u.last_seen &&
      new Date(u.last_seen) > new Date(new Date(u.created_at).getTime() + ms(1))).length
    const fDay7 = funnel30.filter(u => u.last_seen &&
      new Date(u.last_seen) > new Date(new Date(u.created_at).getTime() + ms(6))).length
    const fDay30 = funnel30.filter(u => u.last_seen &&
      new Date(u.last_seen) > new Date(new Date(u.created_at).getTime() + ms(29))).length

    setStats({
      green: green.count||0, yellow: yellow.count||0, red: red.count||0, totalUsers,
      dau: dau.count||0, wau: wau.count||0, mau: mau.count||0,
      new7: new7.count||0, new30: new30.count||0,
      avgStreak, friendsPct,
      totalReports: totalR.count||0, pendingReports: pendingR.count||0,
      features, maxFeature,
      funnel: { registered: fRegistered, tested: fTested, day2: fDay2, day7: fDay7, day30: fDay30 },
      cohortRows,
    })
    setLoading(false)
  }

  if (loading) return <View style={s.center}><ActivityIndicator color={colors.accent} /></View>
  if (!stats) return null

  const StatRow = ({ label, value, color, hint }) => (
    <View style={s.statRow}>
      <View style={s.statLabelRow}>
        <Text style={s.statLabel}>{label}</Text>
        {hint && (
          <TouchableOpacity
            onPress={() => showAlert(label, hint)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={s.hintBtn}
          >
            <Text style={s.hintText}>?</Text>
          </TouchableOpacity>
        )}
      </View>
      <Text style={[s.statValue, color && { color }]}>{value}</Text>
    </View>
  )

  const FunnelRow = ({ label, value, total }) => {
    const pct = total ? Math.round(value / total * 100) : 0
    return (
      <View style={s.statRow}>
        <Text style={s.statLabel}>{label}</Text>
        <Text style={s.statValue}>
          {value}{' '}
          <Text style={{ color: colors.muted, fontWeight: '400' }}>({pct}%)</Text>
        </Text>
      </View>
    )
  }

  const FeatureBar = ({ label, count, max }) => (
    <View style={s.featureRow}>
      <Text style={s.featureLabel} numberOfLines={1}>{label}</Text>
      <View style={s.featureBarBg}>
        <View style={[s.featureBarFill, { width: `${Math.round(count / max * 100)}%` }]} />
      </View>
      <Text style={s.featureCount}>{count}</Text>
    </View>
  )

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Text style={s.statSection}>Пользователи</Text>
      <View style={s.statCard}>
        <StatRow label="Всего" value={stats.totalUsers} hint="Общее количество зарегистрированных пользователей." />
        <StatRow label="DAU (сегодня)" value={stats.dau} hint="Daily Active Users — пользователи, которые заходили сегодня (last_seen = сегодня)." />
        <StatRow label="WAU (7 дней)" value={stats.wau} hint="Weekly Active Users — пользователи, которые заходили хотя бы раз за последние 7 дней." />
        <StatRow label="MAU (30 дней)" value={stats.mau} hint="Monthly Active Users — пользователи, которые заходили хотя бы раз за последние 30 дней." />
        <StatRow label="Новых за 7 дней" value={stats.new7} hint="Зарегистрировались за последние 7 дней." />
        <StatRow label="Новых за 30 дней" value={stats.new30} hint="Зарегистрировались за последние 30 дней." />
        <StatRow label="С другом (>=1)" value={`${stats.friendsPct}%`} hint="Доля пользователей, у которых есть хотя бы один принятый друг." />
        <StatRow label="Средний стрик" value={stats.avgStreak} hint="Среднее количество дней подряд, в которые пользователи заходили в приложение." />
        <StatRow label="Зелёный" value={stats.green} color="#5DAA72" hint="Пользователи с уровнем «зелёный» — чувствуют себя относительно нормально." />
        <StatRow label="Жёлтый" value={stats.yellow} color="#AA7C00" hint="Пользователи с уровнем «жёлтый» — сейчас непросто." />
        <StatRow label="Красный" value={stats.red} color="#c0392b" hint="Пользователи с уровнем «красный» — сейчас совсем тяжело." />
      </View>

      <Text style={s.statSection}>Активность фич — 7 дней</Text>
      <View style={s.statCard}>
        {stats.features.map(f => (
          <FeatureBar key={f.label} label={f.label} count={f.count} max={stats.maxFeature} />
        ))}
      </View>

      <Text style={s.statSection}>Воронка онбординга — 30 дней</Text>
      <View style={s.statCard}>
        <FunnelRow label="Зарегистрировались" value={stats.funnel.registered} total={stats.funnel.registered} />
        <FunnelRow label="Прошли тест" value={stats.funnel.tested} total={stats.funnel.registered} />
        <FunnelRow label="Вернулись день 2" value={stats.funnel.day2} total={stats.funnel.registered} />
        <FunnelRow label="Вернулись день 7" value={stats.funnel.day7} total={stats.funnel.registered} />
        <FunnelRow label="Вернулись день 30" value={stats.funnel.day30} total={stats.funnel.registered} />
      </View>

      <Text style={s.statSection}>Когорты удержания</Text>
      <View style={s.statCard}>
        <View style={s.cohortHeader}>
          <Text style={[s.cohortCell, s.cohortLabelCell]}>Неделя</Text>
          {['W1','W2','W4','W8'].map(w => (
            <Text key={w} style={[s.cohortCell, s.cohortPctCell]}>{w}</Text>
          ))}
        </View>
        {stats.cohortRows.map(row => (
          <View key={row.week} style={s.cohortRow}>
            <Text style={[s.cohortCell, s.cohortLabelCell]}>
              {new Date(row.week).toLocaleDateString('ru', { day: 'numeric', month: 'short' })}
              {' '}({row.size})
            </Text>
            {[row.w1, row.w2, row.w4, row.w8].map((retained, i) => {
              const pct = retained != null && row.size ? Math.round(retained / row.size * 100) : null
              const color = pct == null ? colors.muted : pct >= 50 ? '#5DAA72' : pct >= 30 ? '#AA7C00' : '#c0392b'
              return (
                <Text key={i} style={[s.cohortCell, s.cohortPctCell, { color }]}>
                  {pct != null ? `${pct}%` : '—'}
                </Text>
              )
            })}
          </View>
        ))}
        {stats.cohortRows.length === 0 && (
          <Text style={[s.statLabel, { padding: 8, color: colors.muted }]}>
            Данных пока нет — появятся в следующий понедельник
          </Text>
        )}
      </View>

      <Text style={s.statSection}>Модерация</Text>
      <View style={s.statCard}>
        <StatRow label="Всего жалоб" value={stats.totalReports} hint="Общее количество жалоб на пользователей за всё время." />
        <StatRow label="Необработанных" value={stats.pendingReports}
          color={stats.pendingReports > 0 ? '#c0392b' : colors.white} />
      </View>
    </ScrollView>
  )
}

// ── STYLES ────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#E8DFD0' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.white },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E8DFD0' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.accent },
  tabText: { fontSize: 14, color: colors.muted },
  tabTextActive: { color: colors.accent, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { color: colors.muted, fontSize: 15 },
  filterRow: { flexDirection: 'row', gap: 8, padding: 12 },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: '#E8DFD0' },
  filterBtnActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  filterBtnText: { fontSize: 13, color: colors.muted },
  filterBtnTextActive: { color: 'white' },
  reportCard: { backgroundColor: 'white', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#E8DFD0' },
  reportHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  reportUser: { fontSize: 14, color: colors.white },
  reportLabel: { color: colors.muted },
  reportReason: { fontSize: 13, color: colors.white, marginBottom: 4 },
  reportMeta: { fontSize: 11, color: colors.muted, marginBottom: 10 },
  reportActions: { flexDirection: 'row', gap: 8 },
  resolvedBadge: { backgroundColor: '#5DAA7222', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  resolvedText: { fontSize: 11, color: '#5DAA72', fontWeight: '600' },
  actionBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, backgroundColor: '#F0E8D8', alignItems: 'center' },
  actionBtnDanger: { backgroundColor: '#fdecea' },
  actionBtnText: { fontSize: 12, color: colors.accent, fontWeight: '600' },
  searchRow: { flexDirection: 'row', padding: 12, gap: 8 },
  searchInput: { flex: 1, backgroundColor: 'white', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: colors.white, borderWidth: 1, borderColor: '#E8DFD0' },
  searchBtn: { backgroundColor: colors.accent, borderRadius: 12, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  userCard: { backgroundColor: 'white', borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#E8DFD0' },
  userInfo: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  levelDot: { width: 10, height: 10, borderRadius: 5 },
  userName: { fontSize: 15, fontWeight: '600', color: colors.white },
  userMeta: { fontSize: 12, color: colors.muted },
  adminBadge: { backgroundColor: '#8B735522', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginLeft: 'auto' },
  adminBadgeText: { fontSize: 11, color: colors.accent, fontWeight: '700' },
  bannedBadge: { backgroundColor: '#c0392b22', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginLeft: 4 },
  bannedBadgeText: { fontSize: 11, color: '#c0392b', fontWeight: '700' },
  actionBtnSuccess: { backgroundColor: '#e8f5e9' },
  userActions: { flexDirection: 'row', gap: 8 },
  usersCount: { fontSize: 12, color: colors.muted, marginBottom: 8 },
  statSection: { fontSize: 12, fontWeight: '700', color: colors.muted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8, marginTop: 12 },
  statCard: { backgroundColor: 'white', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#E8DFD0' },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F0E8D8' },
  statLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statLabel: { fontSize: 14, color: colors.white },
  statValue: { fontSize: 14, fontWeight: '700', color: colors.white },
  hintBtn: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#E8DFD0', alignItems: 'center', justifyContent: 'center' },
  hintText: { fontSize: 10, fontWeight: '700', color: colors.muted, lineHeight: 14 },
  featureRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F0E8D8', gap: 8,
  },
  featureLabel: { fontSize: 12, color: colors.white, width: 90 },
  featureBarBg: { flex: 1, height: 6, backgroundColor: '#F0E8D8', borderRadius: 3 },
  featureBarFill: { height: 6, backgroundColor: colors.accent, borderRadius: 3 },
  featureCount: { fontSize: 12, fontWeight: '700', color: colors.white, width: 24, textAlign: 'right' },
  cohortHeader: { flexDirection: 'row', paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#F0E8D8' },
  cohortRow: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F0E8D8' },
  cohortCell: { fontSize: 12, color: colors.white },
  cohortLabelCell: { flex: 2 },
  cohortPctCell: { flex: 1, textAlign: 'center', fontWeight: '600' },
})
