import {
  StyleSheet, Text, View, FlatList, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, Keyboard, TouchableWithoutFeedback, Image, Platform,
} from 'react-native';
import { useState, useCallback, useRef, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../supabase';
import { store } from '../store';
import { LEVEL_COLORS, LEVEL_DATA } from '../constants';
import { colors } from '../theme';
import Avatar from '../components/Avatar';

const PAGE_SIZE = 20;
const SUPABASE_URL = 'https://yincycmdsdluueqsxtwn.supabase.co';

function isVideo(url) {
  return url && (url.includes('.mp4') || url.includes('.mov'));
}

export default function FeedScreen({ navigation }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);
  const [filter, setFilter] = useState('all');
  const [avatarMap, setAvatarMap] = useState({});
  const [commentCounts, setCommentCounts] = useState({});
  const [mediaUri, setMediaUri] = useState(null);
  const [mediaType, setMediaType] = useState(null);
  const cursorRef = useRef(null);
  const fetchedAuthors = useRef(new Set());
  const inputRef = useRef(null);

  const insets = useSafeAreaInsets();
  const level = store.level || 'green';
  const [kbHeight, setKbHeight] = useState(0);

  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      e => setKbHeight(e.endCoordinates.height)
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKbHeight(0)
    );
    return () => { show.remove(); hide.remove(); };
  }, []);

  const fetchCommentCounts = async (newPosts) => {
    if (!newPosts.length) return;
    const ids = newPosts.map(p => p.id);
    const { data } = await supabase
      .from('post_comments')
      .select('post_id')
      .in('post_id', ids);
    if (data) {
      const counts = {};
      data.forEach(row => { counts[row.post_id] = (counts[row.post_id] || 0) + 1; });
      setCommentCounts(prev => ({ ...prev, ...counts }));
    }
  };

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
    if (error) Alert.alert('Ошибка', 'Не удалось загрузить ленту');
    const newPosts = data || [];
    if (reset) setPosts(newPosts);
    else setPosts(prev => [...prev, ...newPosts]);
    fetchAuthorAvatars(newPosts);
    fetchCommentCounts(newPosts);
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

  const pickMedia = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Нужен доступ к галерее');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.7,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      setMediaUri(asset.uri);
      setMediaType(asset.type === 'video' ? 'video' : 'image');
    }
  };

  const uploadMedia = async () => {
    if (!mediaUri) return null;
    const ext = mediaType === 'video' ? 'mp4' : 'jpg';
    const path = `${store.userId}/${Date.now()}.${ext}`;
    const response = await fetch(mediaUri);
    const blob = await response.blob();
    const { error } = await supabase.storage
      .from('post-media')
      .upload(path, blob, { contentType: mediaType === 'video' ? 'video/mp4' : 'image/jpeg' });
    if (error) { Alert.alert('Ошибка загрузки', error.message); return null; }
    return `${SUPABASE_URL}/storage/v1/object/public/post-media/${path}`;
  };

  const post = async () => {
    if (!text.trim() && !mediaUri) return;
    setPosting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const mediaUrl = await uploadMedia();
      const targetLevels = filter === 'mine' ? [level] : ['green', 'yellow', 'red'];
      await supabase.from('feed_posts').insert({
        author_id: user.id,
        author_username: store.username || 'Аноним',
        author_level: level,
        text: text.trim(),
        target_levels: targetLevels,
        media_url: mediaUrl,
      });
      setText('');
      setMediaUri(null);
      setMediaType(null);
      fetchedAuthors.current.delete(store.userId);
      await loadPosts(true);
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

        {!!item.text && <Text style={styles.postText}>{item.text}</Text>}

        {item.media_url && !isVideo(item.media_url) && (
          <TouchableOpacity onPress={() => navigation.navigate('Post', { post: item })} activeOpacity={0.95}>
            <Image source={{ uri: item.media_url }} style={styles.postImage} resizeMode="cover" />
          </TouchableOpacity>
        )}
        {item.media_url && isVideo(item.media_url) && (
          <TouchableOpacity style={styles.videoThumb} onPress={() => navigation.navigate('Post', { post: item })} activeOpacity={0.8}>
            <Ionicons name="play-circle" size={48} color={colors.accent} />
            <Text style={styles.videoLabel}>Смотреть видео</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.commentBtn}
          onPress={() => navigation.navigate('Post', { post: item })}
          activeOpacity={0.7}
        >
          <Ionicons name="chatbubble-outline" size={14} color={colors.muted} />
          <Text style={styles.commentBtnText}>
            {commentCounts[item.id] ? `${commentCounts[item.id]} комментариев` : 'Комментировать'}
          </Text>
        </TouchableOpacity>
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

  const barTop = Math.max(insets.bottom, 12) + 60 + 8 + 6;
  const inputBottom = kbHeight > 0 ? kbHeight : barTop;
  const hasContent = text.trim() || mediaUri;

  return (
    <View style={styles.safeArea}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Лента</Text>
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
              <Text style={[styles.filterText, filter === 'mine' && styles.filterTextActive]}>Мой уровень</Text>
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
          contentContainerStyle={[styles.list, { paddingBottom: inputBottom + 16 }]}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={<Text style={styles.empty}>Постов пока нет. Будь первым!</Text>}
          ListFooterComponent={renderFooter}
        />
      )}

      <View style={[styles.inputBackground, { height: inputBottom }]} />
      <View style={[styles.inputWrap, { bottom: inputBottom }]}>
        {mediaUri && (
          <View style={styles.mediaPreviewWrap}>
            {mediaType === 'image'
              ? <Image source={{ uri: mediaUri }} style={styles.mediaPreview} resizeMode="cover" />
              : <View style={styles.videoPreview}>
                  <Ionicons name="videocam" size={24} color={colors.accent} />
                  <Text style={styles.videoPreviewText}>Видео выбрано</Text>
                </View>
            }
            <TouchableOpacity style={styles.removeMedia} onPress={() => { setMediaUri(null); setMediaType(null); }}>
              <Ionicons name="close-circle" size={22} color={colors.muted} />
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.inputRow}>
          <TouchableOpacity style={styles.mediaBtn} onPress={pickMedia}>
            <Ionicons name="image-outline" size={22} color={colors.muted} />
          </TouchableOpacity>
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
            style={[styles.sendBtn, !hasContent && styles.sendBtnDisabled]}
            onPress={post}
            disabled={!hasContent || posting}
          >
            {posting
              ? <ActivityIndicator color="#fff" size="small" />
              : <Ionicons name="arrow-up" size={20} color="#fff" />
            }
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
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
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 10 },
  cardMeta: { flex: 1 },
  username: { fontWeight: '600', fontSize: 14 },
  date: { color: colors.muted, fontSize: 12, marginTop: 1 },
  levelBadge: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  levelBadgeText: { fontSize: 11, fontWeight: '600' },
  postText: { color: colors.white, fontSize: 15, lineHeight: 22, marginBottom: 10 },
  postImage: { width: '100%', height: 200, borderRadius: 10, marginBottom: 10 },
  videoThumb: {
    backgroundColor: colors.border, borderRadius: 10, height: 120,
    alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 10,
  },
  videoLabel: { color: colors.muted, fontSize: 13 },
  commentBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border },
  commentBtnText: { color: colors.muted, fontSize: 13 },

  empty: { color: colors.muted, textAlign: 'center', marginTop: 60, fontSize: 16 },
  loadMoreBtn: {
    alignItems: 'center', paddingVertical: 14,
    borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    marginHorizontal: 16, marginBottom: 8,
  },
  loadMoreText: { color: colors.muted, fontSize: 14 },

  inputBackground: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.background },
  inputWrap: {
    position: 'absolute', left: 0, right: 0,
    borderTopWidth: 1, borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  mediaPreviewWrap: { paddingHorizontal: 12, paddingTop: 8 },
  mediaPreview: { width: 80, height: 80, borderRadius: 10 },
  videoPreview: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.card, borderRadius: 10, padding: 10, alignSelf: 'flex-start',
  },
  videoPreviewText: { color: colors.white, fontSize: 13 },
  removeMedia: { position: 'absolute', top: 2, right: 2 },
  inputRow: {
    flexDirection: 'row', padding: 12, gap: 10, alignItems: 'center',
  },
  mediaBtn: { padding: 4 },
  input: {
    flex: 1, backgroundColor: colors.card,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10,
    color: colors.white, fontSize: 15, maxHeight: 100,
    borderWidth: 1, borderColor: colors.border,
  },
  sendBtn: {
    backgroundColor: colors.accent, borderRadius: 12,
    width: 44, alignItems: 'center', justifyContent: 'center', minHeight: 44,
  },
  sendBtnDisabled: { opacity: 0.4 },
});
