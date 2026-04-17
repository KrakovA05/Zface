import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  FlatList, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { useState, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';
import { store } from '../store';
import { LEVEL_COLORS } from '../constants';
import { colors } from '../theme';
import { getConversationId } from '../utils';
import { markRead } from '../utils/unread';
import Avatar from '../components/Avatar';

export default function DirectMessageScreen({ route, navigation }) {
  const { friend } = route.params;
  const conversationId = getConversationId(store.userId, friend.userId);

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');

  useEffect(() => {
    markRead(`dm_${conversationId}`);
    fetchMessages();

    const subscription = supabase
      .channel(`dm_${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'direct_messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, payload => {
        setMessages(prev => [payload.new, ...prev]);
      })
      .subscribe();

    return () => { subscription.unsubscribe(); };
  }, []);

  const fetchMessages = async () => {
    const { data, error } = await supabase
      .from('direct_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) {
      Alert.alert('Ошибка', 'Не удалось загрузить сообщения');
      return;
    }
    if (data) setMessages(data);
  };

  const sendMessage = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;

    // Проверяем что пользователь не заблокирован
    const { data: block } = await supabase
      .from('blocks')
      .select('id')
      .eq('blocker_id', store.userId)
      .eq('blocked_id', friend.userId)
      .maybeSingle();
    if (block) {
      Alert.alert('Недоступно', 'Вы заблокировали этого пользователя');
      return;
    }

    setText('');
    const { error } = await supabase.from('direct_messages').insert({
      conversation_id: conversationId,
      sender_id: store.userId,
      sender_username: store.username,
      text: trimmed,
    });
    if (error) {
      setText(trimmed);
      Alert.alert('Ошибка', 'Не удалось отправить сообщение');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Avatar uri={friend.avatarUrl} username={friend.username} level={friend.level} size={34} />
          <Text style={[styles.headerName, { color: LEVEL_COLORS[friend.level] || colors.accent }]}>
            {friend.username}
          </Text>
        </View>
        <View style={styles.backButton} />
      </View>

      {/* Chat + Input */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={10}
      >
        <FlatList
          style={styles.flex}
          data={messages}
          inverted
          keyExtractor={item => String(item.id)}
          contentContainerStyle={styles.messageList}
          renderItem={({ item }) => {
            const isOwn = item.sender_id === store.userId;
            return (
              <View style={[styles.bubbleWrap, isOwn ? styles.bubbleWrapOwn : styles.bubbleWrapOther]}>
                <Avatar
                  uri={isOwn ? store.avatarUrl : friend.avatarUrl}
                  username={isOwn ? store.username : friend.username}
                  level={isOwn ? store.level : friend.level}
                  size={30}
                />
                <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther]}>
                  <Text style={styles.bubbleText}>{item.text}</Text>
                </View>
              </View>
            );
          }}
        />
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Написать..."
            placeholderTextColor={colors.muted}
            value={text}
            onChangeText={setText}
            maxLength={500}
          />
          <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
            <Text style={styles.sendText}>→</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 40,
  },
  backText: {
    color: colors.white,
    fontSize: 24,
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  headerName: {
    fontSize: 18,
    fontWeight: 'bold',
  },

  // Messages
  messageList: {
    padding: 16,
    paddingBottom: 8,
  },
  bubbleWrap: {
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  bubbleWrapOwn: {
    flexDirection: 'row-reverse',
  },
  bubbleWrapOther: {
    flexDirection: 'row',
  },
  bubble: {
    maxWidth: '75%',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  bubbleOwn: {
    backgroundColor: colors.accent,
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: colors.card,
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    color: colors.white,
    fontSize: 15,
    lineHeight: 21,
  },

  // Input
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    color: colors.white,
    fontSize: 15,
  },
  sendButton: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendText: {
    color: colors.white,
    fontSize: 20,
  },
});
