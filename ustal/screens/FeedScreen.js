import { StyleSheet, Text, View, FlatList, TouchableOpacity, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useState, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../supabase';
import { store } from '../store';
import { LEVEL_COLORS, LEVEL_DATA } from '../constants';
import { colors } from '../theme';

export default function FeedScreen() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);
  const [filter, setFilter] = useState('all');

  const level = store.level || 'green';

  const loadPosts = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('feed_posts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (filter === 'mine') {
      query = query.contains('target_levels', [level]);
    }

    const { data } = await query;
    setPosts(data || []);
    setLoading(false);
  }, [filter]);

  useFocusEffect(useCallback(() => { loadPosts(); }, [loadPosts]));

  const post = async () => {
    if (!text.trim()) return;
    setPosting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const targetLevels = filter === 'mine'
        ? [level]
        : ['green', 'yellow', 'red'];

      await supabase.from('feed_posts').insert({
        author_id: user.id,
        author_username: store.username || 'Аноним',
        author_level: level,
        text: text.trim(),
        target_levels: targetLevels,
      });
      setText('');
      await loadPosts();
    }
    setPosting(false);
  };

  const renderPost = ({ item }) => {
    const lvlColor = LEVEL_COLORS[item.author_level] || colors.accent;
    const lvlEmoji = LEVEL_DATA[item.author_level]?.emoji || '•';
    const date = new Date(item.created_at).toLocaleDateString('ru-RU', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    });

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.avatar, { backgroundColor: lvlColor }]}>
            <Text style={styles.avatarText}>{lvlEmoji}</Text>
          </View>
          <View style={styles.cardMeta}>
            <Text style={styles.username}>{item.author_username}</Text>
            <Text style={styles.date}>{date}</Text>
          </View>
          <View style={[styles.levelBadge, { borderColor: lvlColor }]}>
            <Text style={[styles.levelBadgeText, { color: lvlColor }]}>
              {item.author_level}
            </Text>
          </View>
        </View>
        <Text style={styles.postText}>{item.text}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <View style={styles.header}>
          <Text style={styles.title}>📰 Лента</Text>
          <View style={styles.filters}>
            <TouchableOpacity
              style={[styles.filterBtn, filter === 'all' && styles.filterBtnActive]}
              onPress={() => setFilter('all')}
            >
              <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>Все</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterBtn, filter === 'mine' && styles.filterBtnActive]}
              onPress={() => setFilter('mine')}
            >
              <Text style={[styles.filterText, filter === 'mine' && styles.filterTextActive]}>
                Мой уровень
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ flex: 1 }} />
        ) : (
          <FlatList
            data={posts}
            keyExtractor={item => item.id.toString()}
            renderItem={renderPost}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <Text style={styles.empty}>Постов пока нет. Будь первым!</Text>
            }
          />
        )}

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Поделись мыслью..."
            placeholderTextColor={colors.muted}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={280}
          />
          <TouchableOpacity
            style={[styles.sendBtn, !text.trim() && styles.sendBtnDisabled]}
            onPress={post}
            disabled={!text.trim() || posting}
          >
            {posting
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.sendText}>→</Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  title: { fontSize: 24, fontWeight: 'bold', color: colors.white, marginBottom: 12 },
  filters: { flexDirection: 'row', gap: 8 },
  filterBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterBtnActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  filterText: { color: colors.muted, fontSize: 14 },
  filterTextActive: { color: '#fff', fontWeight: '600' },
  list: { paddingHorizontal: 16, paddingBottom: 16 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 18 },
  cardMeta: { flex: 1 },
  username: { color: colors.white, fontWeight: '600', fontSize: 14 },
  date: { color: colors.muted, fontSize: 12, marginTop: 1 },
  levelBadge: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  levelBadgeText: { fontSize: 11, fontWeight: '600' },
  postText: { color: colors.white, fontSize: 15, lineHeight: 22 },
  empty: { color: colors.muted, textAlign: 'center', marginTop: 60, fontSize: 16 },
  inputRow: {
    flexDirection: 'row',
    padding: 12,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  input: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: colors.white,
    fontSize: 15,
    maxHeight: 100,
  },
  sendBtn: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
});
