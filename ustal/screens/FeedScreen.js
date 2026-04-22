import { StyleSheet, Text, View, FlatList, TouchableOpacity, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, Alert, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { useState, useCallback, useRef, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../supabase';
import { store } from '../store';
import { LEVEL_COLORS, LEVEL_DATA } from '../constants';
import { colors } from '../theme';
import Avatar from '../components/Avatar';

const PAGE_SIZE = 20;

export default function FeedScreen({ navigation }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);
  const [filter, setFilter] = useState('all');
  const [avatarMap, setAvatarMap] = useState({});
  const cursorRef = useRef(null);
  const fetchedAuthors = useRef(new Set());
  const inputRef = useRef(null);

  const level = store.level || 'green';

  const fetchAuthorAvatars = async (newPosts) => {
    const toFetch = [...new Set(newPosts.map(p => p.author_id))]
      .filter(id => id && !fetchedAuthors.current.has(id));
    if (!toFetch.length) return;
    toFetch.forEach(id => fetchedAuthors.current.add(id));
    const { data } = await supabase
      .from('users')
      .select('user_id, avatar_url')
      .in('user_id', toFetch);
    if (data) {
      const entries = {};
      data.forEach(u => { entries[u.user_id] = u.avatar_url; });
      setAvatarMap(prev => ({ ...prev, ...entries }));
    }
  };

  const loadPosts = useCallback(async (reset = true) => {
    if (reset) {
      setLoading(true);
      cursorRef.current = null;
    } else {
      setLoadingMore(true);
    }

    let query = supabase
      .from('feed_posts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);

    if (filter === 'mine') {
      query = query.contains('target_levels', [level]);
    }
    if (!reset && cursorRef.current) {
      query = query.lt('created_at', cursorRef.current);
    }

    const { data, error } = await query;
    if (error) {
      Alert.alert('Ошибка', 'Не удалось загрузить ленту');
    }
    const newPosts = data || [];
    if (reset) {
      setPosts(newPosts);
    } else {
      setPosts(prev => [...prev, ...newPosts]);
    }
    fetchAuthorAvatars(newPosts);
    setHasMore(newPosts.length === PAGE_SIZE);
    if (newPosts.length > 0) cursorRef.current = newPosts[newPosts.length - 1].created_at;

    if (reset) setLoading(false);
    else setLoadingMore(false);
  }, [filter]);

  useFocusEffect(useCallback(() => {
    loadPosts(true);
    inputRef.current?.blur();
    return () => { Keyboard.dismiss(); };
  }, [loadPosts]));

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
      await loadPosts(true);
      // сбрасываем кэш аватаров чтобы новый пост подхватил аватар
      fetchedAuthors.current.delete(store.userId);
    }
    setPosting(false);
  };

  const openAuthorProfile = (item) => {
    if (item.author_id === store.userId) return;
    navigation.navigate('UserProfile', {
      user: {
        user_id: item.author_id,
        username: item.author_username,
        level: item.author_level,
        avatar_url: null,
        status: '',
        labels: [],
      },
    });
  };

  const renderPost = ({ item }) => {
    const lvlColor = LEVEL_COLORS[item.author_level] || colors.accent;
    const date = new Date(item.created_at).toLocaleDateString('ru-RU', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    });
    const isOwn = item.author_id === store.userId;

    return (
      <View style={styles.card}>
        <TouchableOpacity
          style={styles.cardHeader}
          onPress={() => openAuthorProfile(item)}
          disabled={isOwn}
        >
          <Avatar
            uri={item.author_id === store.userId ? store.avatarUrl : (avatarMap[item.author_id] || null)}
            username={item.author_username}
            level={item.author_level}
            size={36}
          />
          <View style={styles.cardMeta}>
            <Text style={[styles.username, { color: lvlColor }]}>{item.author_username}</Text>
            <Text style={styles.date}>{date}</Text>
          </View>
          <View style={[styles.levelBadge, { borderColor: lvlColor }]}>
            <Text style={[styles.levelBadgeText, { color: lvlColor }]}>
              {LEVEL_DATA[item.author_level]?.emoji || '•'}
            </Text>
          </View>
        </TouchableOpacity>
        <Text style={styles.postText}>{item.text}</Text>
      </View>
    );
  };

  const renderFooter = () => {
    if (loadingMore) return <ActivityIndicator color={colors.accent} style={{ marginVertical: 16 }} />;
    if (!hasMore || posts.length === 0) return null;
    return (
      <TouchableOpacity style={styles.loadMoreBtn} onPress={() => loadPosts(false)}>
        <Text style={styles.loadMoreText}>Загрузить ещё</Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
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
        </TouchableWithoutFeedback>

        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ flex: 1 }} />
        ) : (
          <FlatList
            data={posts}
            keyExtractor={item => item.id.toString()}
            renderItem={renderPost}
            contentContainerStyle={styles.list}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <Text style={styles.empty}>Постов пока нет. Будь первым!</Text>
            }
            ListFooterComponent={renderFooter}
          />
        )}

        <View style={styles.inputRow}>
          <TextInput
            ref={inputRef}
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
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20, backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
  },
  filterBtnActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  filterText: { color: colors.muted, fontSize: 14 },
  filterTextActive: { color: '#fff', fontWeight: '600' },
  list: { paddingHorizontal: 16, paddingBottom: 16 },
  card: {
    backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 12,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 10 },
  cardMeta: { flex: 1 },
  username: { fontWeight: '600', fontSize: 14 },
  date: { color: colors.muted, fontSize: 12, marginTop: 1 },
  levelBadge: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  levelBadgeText: { fontSize: 11, fontWeight: '600' },
  postText: { color: colors.white, fontSize: 15, lineHeight: 22 },
  empty: { color: colors.muted, textAlign: 'center', marginTop: 60, fontSize: 16 },
  loadMoreBtn: {
    alignItems: 'center', paddingVertical: 14,
    borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    marginHorizontal: 16, marginBottom: 8,
  },
  loadMoreText: { color: colors.muted, fontSize: 14 },
  inputRow: {
    flexDirection: 'row', padding: 12, gap: 10,
    borderTopWidth: 1, borderTopColor: colors.border,
    backgroundColor: colors.background,
    paddingBottom: 76,
  },
  input: {
    flex: 1, backgroundColor: colors.card,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10,
    color: colors.white, fontSize: 15, maxHeight: 100,
  },
  sendBtn: {
    backgroundColor: colors.accent, borderRadius: 12,
    width: 44, alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
});
