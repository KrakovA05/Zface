import {
  StyleSheet, Text, View, FlatList, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../supabase';
import { store } from '../store';
import { LEVEL_COLORS, LEVEL_DATA } from '../constants';
import { colors } from '../theme';
import Avatar from '../components/Avatar';

function formatDate(str) {
  return new Date(str).toLocaleDateString('ru-RU', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

function formatTime(str) {
  return new Date(str).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

export default function PostScreen({ route, navigation }) {
  const { post } = route.params;
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);

  const lvlColor = LEVEL_COLORS[post.author_level] || colors.accent;

  const loadComments = async () => {
    const { data } = await supabase
      .from('post_comments')
      .select('*')
      .eq('post_id', post.id)
      .order('created_at', { ascending: true });
    setComments(data || []);
    setLoading(false);
  };

  useEffect(() => { loadComments(); }, []);

  const sendComment = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setSending(true);
    const { error } = await supabase.from('post_comments').insert({
      post_id: post.id,
      author_id: store.userId,
      author_username: store.username,
      author_level: store.level || 'green',
      text: trimmed,
    });
    if (error) {
      Alert.alert('Ошибка', 'Не удалось отправить комментарий');
    } else {
      setText('');
      await loadComments();
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
    setSending(false);
  };

  const deleteComment = (comment) => {
    if (comment.author_id !== store.userId) return;
    Alert.alert('Удалить комментарий?', '', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить', style: 'destructive',
        onPress: async () => {
          await supabase.from('post_comments').delete().eq('id', comment.id);
          setComments(prev => prev.filter(c => c.id !== comment.id));
        },
      },
    ]);
  };

  const renderComment = ({ item }) => {
    const cColor = LEVEL_COLORS[item.author_level] || colors.accent;
    const isOwn = item.author_id === store.userId;
    return (
      <TouchableOpacity
        style={styles.comment}
        onLongPress={() => deleteComment(item)}
        activeOpacity={isOwn ? 0.7 : 1}
      >
        <Avatar uri={null} username={item.author_username} level={item.author_level} size={28} />
        <View style={styles.commentBody}>
          <View style={styles.commentHeader}>
            <Text style={[styles.commentAuthor, { color: cColor }]}>{item.author_username}</Text>
            <Text style={styles.commentTime}>{formatTime(item.created_at)}</Text>
          </View>
          <Text style={styles.commentText}>{item.text}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const ListHeader = () => (
    <View style={styles.postCard}>
      <View style={styles.postHeader}>
        <Avatar uri={null} username={post.author_username} level={post.author_level} size={36} />
        <View style={styles.postMeta}>
          <Text style={[styles.postAuthor, { color: lvlColor }]}>{post.author_username}</Text>
          <Text style={styles.postDate}>{formatDate(post.created_at)}</Text>
        </View>
        <View style={[styles.levelBadge, { borderColor: lvlColor }]}>
          <Text style={[styles.levelBadgeText, { color: lvlColor }]}>
            {LEVEL_DATA[post.author_level]?.emoji || '•'}
          </Text>
        </View>
      </View>
      <Text style={styles.postText}>{post.text}</Text>
      <View style={styles.divider} />
      <Text style={styles.commentsLabel}>
        {comments.length > 0 ? `${comments.length} комментариев` : 'Будь первым'}
      </Text>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Пост</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ flex: 1 }} />
      ) : (
        <FlatList
          ref={listRef}
          data={comments}
          keyExtractor={item => item.id}
          renderItem={renderComment}
          ListHeaderComponent={ListHeader}
          contentContainerStyle={styles.list}
          ListEmptyComponent={null}
        />
      )}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Напиши комментарий..."
          placeholderTextColor={colors.muted}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
          onPress={sendComment}
          disabled={!text.trim() || sending}
        >
          {sending
            ? <ActivityIndicator color="#fff" size="small" />
            : <Ionicons name="arrow-up" size={20} color="#fff" />
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  backBtn: { width: 40, padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: '600', color: colors.white },

  list: { paddingBottom: 16 },

  postCard: {
    backgroundColor: colors.card,
    marginHorizontal: 16, marginTop: 8, marginBottom: 8,
    borderRadius: 16, padding: 16,
  },
  postHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 10 },
  postMeta: { flex: 1 },
  postAuthor: { fontWeight: '600', fontSize: 15 },
  postDate: { color: colors.muted, fontSize: 12, marginTop: 1 },
  levelBadge: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  levelBadgeText: { fontSize: 11, fontWeight: '600' },
  postText: { color: colors.white, fontSize: 15, lineHeight: 22, marginBottom: 16 },
  divider: { height: 1, backgroundColor: colors.border, marginBottom: 12 },
  commentsLabel: { fontSize: 12, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6 },

  comment: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    paddingHorizontal: 16, paddingVertical: 10,
  },
  commentBody: { flex: 1, backgroundColor: colors.card, borderRadius: 12, padding: 10 },
  commentHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  commentAuthor: { fontSize: 13, fontWeight: '600' },
  commentTime: { fontSize: 11, color: colors.muted },
  commentText: { color: colors.white, fontSize: 14, lineHeight: 20 },

  inputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingBottom: 16, paddingTop: 8,
    borderTopWidth: 1, borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  input: {
    flex: 1, backgroundColor: colors.card,
    borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10,
    color: colors.white, fontSize: 15, maxHeight: 100,
    borderWidth: 1, borderColor: colors.border,
  },
  sendBtn: {
    backgroundColor: colors.accent, borderRadius: 22,
    width: 44, height: 44, alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
});
