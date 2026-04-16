import {
  StyleSheet, Text, View, FlatList, TouchableOpacity,
  TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useState, useRef, useEffect, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../supabase';
import { store } from '../store';
import { LEVEL_COLORS } from '../constants';
import { colors } from '../theme';
import { markRead } from '../utils/unread';
import Avatar from '../components/Avatar';

const TABLES = [
  { id: 'main',    label: '🍸 Общий бар',       desc: 'Для всех',                seats: 20 },
  { id: 'quiet',   label: '🕯 Тихий уголок',     desc: 'Спокойные разговоры',     seats: 6  },
  { id: 'music',   label: '🎵 Музыкальный стол', desc: 'Обсуждаем музыку',         seats: 8  },
  { id: 'random',  label: '🎲 Случайные темы',   desc: 'Говорим обо всём',         seats: 10 },
];

const DRINKS = ['🍸', '🍺', '🥂', '🍵', '☕', '🥤', '🍹', '🧃'];

export default function BarScreen({ route }) {
  const [table, setTable] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [visitors, setVisitors] = useState({});
  const [myDrink] = useState(DRINKS[Math.floor(Math.random() * DRINKS.length)]);
  const flatRef = useRef(null);
  const channelRef = useRef(null);

  useFocusEffect(useCallback(() => {
    const loadVisitors = async () => {
      const counts = {};
      for (const t of TABLES) {
        const { count } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('level', `bar_${t.id}`)
          .gte('created_at', new Date(Date.now() - 3600000).toISOString());
        counts[t.id] = count || 0;
      }
      setVisitors(counts);
    };
    loadVisitors();
  }, []));

  // Если открыли через route.params — сразу входим при маунте
  useEffect(() => {
    if (route?.params?.openTable) enterTable(route.params.openTable);
  }, []);

  const enterTable = async (tableId) => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    setMessages([]);
    setTable(tableId);
    await markRead(`bar_${tableId}`);

    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('level', `bar_${tableId}`)
      .order('created_at', { ascending: false })
      .limit(60);
    setMessages((data || []).reverse());

    const channel = supabase
      .channel(`bar_${tableId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `level=eq.bar_${tableId}`,
      }, (payload) => {
        setMessages(prev => [...prev, payload.new]);
        setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
      })
      .subscribe();
    channelRef.current = channel;
  };

  useEffect(() => {
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, []);

  const send = async () => {
    if (!text.trim() || !table) return;
    setSending(true);
    await supabase.from('messages').insert({
      username: store.username || 'Гость',
      text: text.trim(),
      level: `bar_${table}`,
    });
    setText('');
    setSending(false);
  };

  if (!table) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.lobbyContent}>
          <Text style={styles.title}>🍸 Онлайн-бар</Text>
          <Text style={styles.subtitle}>Виртуальное место где можно просто побыть</Text>

          <View style={styles.atmosphere}>
            <Text style={styles.atmosphereText}>🕯 Мягкий свет. Тихая музыка. Твой напиток ждёт {myDrink}</Text>
          </View>

          {TABLES.map(t => (
            <TouchableOpacity
              key={t.id}
              style={styles.tableCard}
              onPress={() => enterTable(t.id)}
            >
              <View style={styles.tableInfo}>
                <Text style={styles.tableLabel}>{t.label}</Text>
                <Text style={styles.tableDesc}>{t.desc}</Text>
              </View>
              <View style={styles.tableRight}>
                <Text style={styles.tableActivity}>
                  {visitors[t.id] > 0 ? '🟢' : '⚫'}
                </Text>
                <Text style={styles.tableCount}>
                  {visitors[t.id] > 0 ? `${visitors[t.id]} сообщ.` : 'тихо'}
                </Text>
              </View>
            </TouchableOpacity>
          ))}

          <View style={styles.tip}>
            <Text style={styles.tipText}>
              💡 Бар работает на базе общего чата. Уровень не важен — здесь все равны.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const tableData = TABLES.find(t => t.id === table);

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <View style={styles.tableHeader}>
          <TouchableOpacity onPress={() => setTable(null)} style={styles.backBtn}>
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>
          <View>
            <Text style={styles.tableHeaderLabel}>{tableData.label}</Text>
            <Text style={styles.tableHeaderDesc}>{tableData.desc}</Text>
          </View>
          <Text style={styles.headerDrink}>{myDrink}</Text>
        </View>

        <FlatList
          ref={flatRef}
          data={messages}
          keyExtractor={item => item.id?.toString()}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => {
            const isMe = item.username === store.username;
            return (
              <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
                <Avatar
                  uri={isMe ? store.avatarUrl : null}
                  username={item.username}
                  level={isMe ? store.level : null}
                  size={30}
                />
                <View style={[styles.msgBubble, isMe ? styles.msgBubbleMe : styles.msgBubbleOther]}>
                  {!isMe && <Text style={[styles.msgUsername, { color: colors.accent }]}>{item.username}</Text>}
                  <Text style={styles.msgText}>{item.text}</Text>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyBar}>
              <Text style={styles.emptyBarEmoji}>🕯</Text>
              <Text style={styles.emptyBarText}>Здесь пока тихо.{'\n'}Начни разговор первым.</Text>
            </View>
          }
        />

        <View style={styles.inputRow}>
          <Text style={styles.drinkIcon}>{myDrink}</Text>
          <TextInput
            style={styles.input}
            placeholder="Что скажешь..."
            placeholderTextColor={colors.muted}
            value={text}
            onChangeText={setText}
            onSubmitEditing={send}
            returnKeyType="send"
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendBtn, !text.trim() && styles.sendBtnDisabled]}
            onPress={send}
            disabled={!text.trim() || sending}
          >
            {sending
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
  lobbyContent: { padding: 24, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: 'bold', color: colors.white, marginBottom: 8 },
  subtitle: { fontSize: 15, color: colors.muted, marginBottom: 20 },
  atmosphere: {
    backgroundColor: '#1a1020',
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#3a2040',
  },
  atmosphereText: { color: '#c0a0d0', fontSize: 14, lineHeight: 20 },
  tableCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
  },
  tableInfo: { flex: 1 },
  tableLabel: { fontSize: 16, fontWeight: 'bold', color: colors.white, marginBottom: 4 },
  tableDesc: { fontSize: 13, color: colors.muted },
  tableRight: { alignItems: 'center', minWidth: 60 },
  tableActivity: { fontSize: 14 },
  tableCount: { fontSize: 11, color: colors.muted, marginTop: 2 },
  tip: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
  },
  tipText: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#3a2040',
    gap: 12,
    backgroundColor: '#130d1a',
  },
  backBtn: { padding: 4 },
  backText: { color: colors.white, fontSize: 22 },
  tableHeaderLabel: { fontSize: 16, fontWeight: 'bold', color: colors.white },
  tableHeaderDesc: { fontSize: 12, color: colors.muted },
  headerDrink: { fontSize: 24, marginLeft: 'auto' },
  messagesList: { padding: 16, paddingBottom: 8 },
  msgRow: { flexDirection: 'row', marginBottom: 12, alignItems: 'flex-end', gap: 8 },
  msgRowMe: { flexDirection: 'row-reverse' },
  msgAvatar: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  msgAvatarText: { color: colors.accent, fontWeight: 'bold', fontSize: 13 },
  msgBubble: { maxWidth: '75%', borderRadius: 16, padding: 12 },
  msgBubbleOther: { backgroundColor: '#1a1020', borderBottomLeftRadius: 4 },
  msgBubbleMe: { backgroundColor: '#2a1535', borderBottomRightRadius: 4 },
  msgUsername: { fontSize: 11, fontWeight: '600', marginBottom: 4 },
  msgText: { color: colors.white, fontSize: 15, lineHeight: 21 },
  emptyBar: { alignItems: 'center', marginTop: 60, gap: 12 },
  emptyBarEmoji: { fontSize: 40 },
  emptyBarText: { color: colors.muted, fontSize: 15, textAlign: 'center', lineHeight: 22 },
  inputRow: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#3a2040',
    backgroundColor: '#130d1a',
    alignItems: 'center',
  },
  drinkIcon: { fontSize: 22 },
  input: {
    flex: 1,
    backgroundColor: '#1a1020',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.white,
    fontSize: 15,
  },
  sendBtn: { backgroundColor: '#6a2a8a', borderRadius: 12, width: 44, alignItems: 'center', justifyContent: 'center', height: 44 },
  sendBtnDisabled: { opacity: 0.4 },
  sendText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
});
