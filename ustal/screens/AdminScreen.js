import React, { useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  TextInput, Alert, ActivityIndicator, ScrollView
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect } from '@react-navigation/native'
import { supabase } from '../supabase'
import { store } from '../store'
import { colors } from '../theme'

const TABS = ['Жалобы', 'Пользователи', 'Статистика']
const LEVEL_COLORS = { green: '#5DAA72', yellow: '#AA7C00', red: '#c0392b' }

export default function AdminScreen({ navigation }) {
  const [tab, setTab] = useState(0)

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
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

      {tab === 0 && <ReportsTab />}
      {tab === 1 && <UsersTab navigation={navigation} />}
      {tab === 2 && <StatsTab />}
    </SafeAreaView>
  )
}

// ── REPORTS TAB ──────────────────────────────────────────────────
function ReportsTab() {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending') // 'pending' | 'all'

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

  async function banUser(userId, username) {
    Alert.alert(
      `Заблокировать @${username}?`,
      'Это установит уровень "red" пользователю. Полный бан требует ручного удаления из БД.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Заблокировать', style: 'destructive',
          onPress: async () => {
            await supabase.from('users').update({ level: 'red' }).eq('user_id', userId)
            Alert.alert('Готово', `@${username} переведён в red`)
          }
        }
      ]
    )
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
                    <Text style={{ color: LEVEL_COLORS[item.reported?.level] || colors.accent }}>
                      @{item.reported?.username || '?'}
                    </Text>
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
                    <TouchableOpacity style={[s.actionBtn, s.actionBtnDanger]} onPress={() => banUser(item.reported_user_id, item.reported?.username)}>
                      <Text style={[s.actionBtnText, { color: '#c0392b' }]}>Понизить уровень</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          />
        )
      }
    </View>
  )
}

// ── USERS TAB ─────────────────────────────────────────────────────
function UsersTab({ navigation }) {
  const [query, setQuery] = useState('')
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)

  async function search() {
    if (!query.trim()) return
    setLoading(true)
    const { data } = await supabase
      .from('users')
      .select('user_id, username, level, email, created_at, is_admin')
      .ilike('username', `%${query.trim()}%`)
      .limit(20)
    setUsers(data || [])
    setLoading(false)
  }

  async function toggleAdmin(userId, currentAdmin, username) {
    const newVal = !currentAdmin
    await supabase.from('users').update({ is_admin: newVal }).eq('user_id', userId)
    setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, is_admin: newVal } : u))
    Alert.alert('Готово', `@${username} ${newVal ? 'получил права модератора' : 'лишён прав модератора'}`)
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
                </View>
                <View style={s.userActions}>
                  <TouchableOpacity
                    style={s.actionBtn}
                    onPress={() => navigation.navigate('UserProfile', { user: { user_id: item.user_id, username: item.username, level: item.level, avatar_url: null, status: '' } })}
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
                </View>
              </View>
            )}
          />
        )
      }
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
    const [green, yellow, red, totalR, pendingR, posts] = await Promise.all([
      supabase.from('users').select('user_id', { count: 'exact', head: true }).eq('level', 'green'),
      supabase.from('users').select('user_id', { count: 'exact', head: true }).eq('level', 'yellow'),
      supabase.from('users').select('user_id', { count: 'exact', head: true }).eq('level', 'red'),
      supabase.from('reports').select('id', { count: 'exact', head: true }),
      supabase.from('reports').select('id', { count: 'exact', head: true }).eq('resolved', false),
      supabase.from('feed_posts').select('id', { count: 'exact', head: true }),
    ])
    setStats({
      green: green.count || 0,
      yellow: yellow.count || 0,
      red: red.count || 0,
      totalUsers: (green.count || 0) + (yellow.count || 0) + (red.count || 0),
      totalReports: totalR.count || 0,
      pendingReports: pendingR.count || 0,
      totalPosts: posts.count || 0,
    })
    setLoading(false)
  }

  if (loading) return <View style={s.center}><ActivityIndicator color={colors.accent} /></View>
  if (!stats) return null

  const StatRow = ({ label, value, color }) => (
    <View style={s.statRow}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={[s.statValue, color && { color }]}>{value}</Text>
    </View>
  )

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Text style={s.statSection}>Пользователи</Text>
      <View style={s.statCard}>
        <StatRow label="Всего" value={stats.totalUsers} />
        <StatRow label="Зелёный" value={stats.green} color="#5DAA72" />
        <StatRow label="Жёлтый" value={stats.yellow} color="#AA7C00" />
        <StatRow label="Красный" value={stats.red} color="#c0392b" />
      </View>
      <Text style={s.statSection}>Модерация</Text>
      <View style={s.statCard}>
        <StatRow label="Всего жалоб" value={stats.totalReports} />
        <StatRow label="Необработанных" value={stats.pendingReports} color={stats.pendingReports > 0 ? '#c0392b' : colors.white} />
      </View>
      <Text style={s.statSection}>Контент</Text>
      <View style={s.statCard}>
        <StatRow label="Постов в ленте" value={stats.totalPosts} />
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
  userActions: { flexDirection: 'row', gap: 8 },
  statSection: { fontSize: 12, fontWeight: '700', color: colors.muted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8, marginTop: 12 },
  statCard: { backgroundColor: 'white', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#E8DFD0' },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F0E8D8' },
  statLabel: { fontSize: 14, color: colors.white },
  statValue: { fontSize: 14, fontWeight: '700', color: colors.white },
})
