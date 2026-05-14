import {
  StyleSheet, Text, View, FlatList,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../supabase';
import { colors } from '../theme';

const TYPE_META = {
  like:            { icon: 'heart',                       color: '#E57373' },
  comment:         { icon: 'chatbubble-outline',          color: colors.accent },
  friend_request:  { icon: 'person-add-outline',          color: '#4CAF50' },
  friend_accepted: { icon: 'people-outline',              color: '#4CAF50' },
  letter:          { icon: 'mail-outline',                color: colors.accent },
  letter_opened:   { icon: 'mail-open-outline',           color: '#AA7C00' },
  letter_reply:    { icon: 'return-down-forward-outline', color: colors.accent },
  reaction:        { icon: 'heart-circle-outline',        color: '#E57373' },
  help:            { icon: 'hand-left-outline',           color: '#AA7C00' },
};

function formatTime(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  <  1) return 'только что';
  if (mins  < 60) return `${mins} мин`;
  if (hours < 24) return `${hours} ч`;
  if (days  <  7) return `${days} д`;
  return new Date(dateStr).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

export default function NotificationsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [items,   setItems]   = useState([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    load();
  }, []));

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(60);

    setItems(data || []);
    setLoading(false);

    // Отмечаем все прочитанными
    if (data?.some(n => !n.read)) {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('read', false);
    }
  };

  const handleTap = async (notif) => {
    switch (notif.type) {
      case 'like':
      case 'comment': {
        if (notif.data?.post_id) {
          const { data: post } = await supabase
            .from('feed_posts').select('*').eq('id', notif.data.post_id).maybeSingle();
          if (post) navigation.navigate('Post', { post });
        }
        break;
      }
      case 'friend_request':
      case 'friend_accepted': {
        if (notif.data?.user_id)
          navigation.navigate('UserProfile', { userId: notif.data.user_id });
        break;
      }
      // входящее письмо → открываем вкладку «Входящие»
      case 'letter':
        navigation.navigate('Letter', { tab: 'inbox' });
        break;
      // письмо открыли / ответ пришёл → вкладка «Написать» где видны «Мои письма»
      case 'letter_opened':
      case 'letter_reply':
        navigation.navigate('Letter', { tab: 'write' });
        break;
      case 'reaction':
        navigation.navigate('Thoughts');
        break;
      // кто-то сказал «ты помог» → переходим в профиль где виден счётчик
      case 'help':
        navigation.navigate('Main', { screen: 'Profile' });
        break;
      default:
        break;
    }
  };

  const renderItem = ({ item }) => {
    const meta = TYPE_META[item.type] || { icon: 'notifications-outline', color: colors.muted };
    return (
      <TouchableOpacity
        style={[styles.card, !item.read && styles.cardUnread]}
        onPress={() => handleTap(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.iconWrap, { backgroundColor: meta.color + '18' }]}>
          <Ionicons name={meta.icon} size={20} color={meta.color} />
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.title}>{item.title}</Text>
          {item.body ? <Text style={styles.body} numberOfLines={2}>{item.body}</Text> : null}
          <Text style={styles.time}>{formatTime(item.created_at)}</Text>
        </View>
        {!item.read && <View style={styles.dot} />}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.wrap, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Уведомления</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="notifications-off-outline" size={40} color={colors.muted} />
              <Text style={styles.emptyText}>Пока ничего нет</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 10, gap: 4,
  },
  backBtn:     { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.white },

  list: { paddingHorizontal: 16, paddingBottom: 32, paddingTop: 8, gap: 8 },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.card, borderRadius: 16, padding: 14,
    shadowColor: '#8B7B6B', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 6, elevation: 2,
  },
  cardUnread: { borderLeftWidth: 3, borderLeftColor: colors.accent },

  iconWrap: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  textWrap: { flex: 1, gap: 2 },
  title:    { fontSize: 14, fontWeight: '600', color: colors.white },
  body:     { fontSize: 13, color: colors.muted, lineHeight: 18 },
  time:     { fontSize: 11, color: colors.muted, marginTop: 2 },

  dot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: colors.accent, flexShrink: 0,
  },

  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15, color: colors.muted },
});
