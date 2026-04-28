import {
  StyleSheet, Text, View, FlatList, TextInput,
  TouchableOpacity, ActivityIndicator, Keyboard, Platform,
} from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../supabase';
import { store } from '../store';
import { LEVEL_COLORS } from '../constants';
import { colors } from '../theme';

const REACTIONS = [
  { type: 'understand', label: 'я понимаю', icon: 'heart-outline' },
  { type: 'same',       label: 'я тоже',    icon: 'people-outline' },
  { type: 'hold_on',   label: 'держись',   icon: 'hand-left-outline' },
];

function getTodayDate() {
  const d = new Date();
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
}

function groupReactions(list) {
  const g = { understand: 0, same: 0, hold_on: 0 };
  (list || []).forEach(r => { if (g[r.reaction_type] !== undefined) g[r.reaction_type]++; });
  return g;
}

export default function ThoughtsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [myThought, setMyThought] = useState(null);
  const [myReactions, setMyReactions] = useState({ understand: 0, same: 0, hold_on: 0 });
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [others, setOthers] = useState([]);
  const [myReacted, setMyReacted] = useState({});
  const [kbHeight, setKbHeight] = useState(0);

  useEffect(() => {
    const showEv = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEv = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEv, e => setKbHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener(hideEv, () => setKbHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  useFocusEffect(useCallback(() => {
    load();
  }, []));

  const load = async () => {
    setLoading(true);
    const today = getTodayDate();
    const level = store.level || 'green';

    const { data: mine } = await supabase
      .from('anonymous_thoughts')
      .select('*')
      .eq('user_id', store.userId)
      .eq('thought_date', today)
      .maybeSingle();

    setMyThought(mine || null);

    if (mine) {
      const { data: rxs } = await supabase
        .from('thought_reactions')
        .select('reaction_type')
        .eq('thought_id', mine.id);
      setMyReactions(groupReactions(rxs));
    }

    const { data: othersData } = await supabase
      .from('anonymous_thoughts')
      .select('id, text, level')
      .eq('thought_date', today)
      .eq('level', level)
      .neq('user_id', store.userId)
      .order('created_at', { ascending: false });

    setOthers(othersData || []);

    if (othersData?.length) {
      const ids = othersData.map(t => t.id);
      const { data: myRxs } = await supabase
        .from('thought_reactions')
        .select('thought_id, reaction_type')
        .eq('user_id', store.userId)
        .in('thought_id', ids);
      const reacted = {};
      (myRxs || []).forEach(r => { reacted[r.thought_id] = r.reaction_type; });
      setMyReacted(reacted);
    }

    setLoading(false);
  };

  const submit = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setSubmitting(true);
    Keyboard.dismiss();
    const { data, error } = await supabase
      .from('anonymous_thoughts')
      .insert({ user_id: store.userId, text: trimmed, level: store.level || 'green', thought_date: getTodayDate() })
      .select().single();
    if (!error && data) {
      setMyThought(data);
      setMyReactions({ understand: 0, same: 0, hold_on: 0 });
      setText('');
    }
    setSubmitting(false);
  };

  const react = async (thoughtId, type) => {
    const prev = myReacted[thoughtId];
    if (prev === type) {
      setMyReacted(r => { const n = { ...r }; delete n[thoughtId]; return n; });
      await supabase.from('thought_reactions').delete()
        .eq('thought_id', thoughtId).eq('user_id', store.userId);
    } else {
      setMyReacted(r => ({ ...r, [thoughtId]: type }));
      await supabase.from('thought_reactions')
        .upsert({ thought_id: thoughtId, user_id: store.userId, reaction_type: type }, { onConflict: 'thought_id,user_id' });
    }
  };

  const lvlColor = LEVEL_COLORS[store.level] || colors.accent;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.title}>Мысли</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={others}
          keyExtractor={item => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: kbHeight + insets.bottom + 16 }]}
          ListHeaderComponent={
            <View>
              <View style={[styles.myCard, { borderLeftColor: lvlColor }]}>
                <Text style={styles.myCardLabel}>Твоя мысль сегодня</Text>
                {myThought ? (
                  <View>
                    <Text style={styles.myThoughtText}>«{myThought.text}»</Text>
                    <View style={styles.myReactions}>
                      {REACTIONS.map(r => (
                        <View key={r.type} style={styles.myReactionItem}>
                          <Ionicons name={r.icon} size={14} color={colors.muted} />
                          <Text style={styles.myReactionLabel}>{r.label}</Text>
                          <Text style={[styles.myReactionCount, myReactions[r.type] > 0 && { color: lvlColor }]}>
                            {myReactions[r.type]}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : (
                  <View style={styles.inputWrap}>
                    <TextInput
                      style={styles.input}
                      placeholder="Что у тебя сейчас на душе..."
                      placeholderTextColor={colors.muted}
                      value={text}
                      onChangeText={setText}
                      maxLength={280}
                      multiline
                    />
                    <TouchableOpacity
                      style={[styles.submitBtn, { backgroundColor: lvlColor }, !text.trim() && styles.submitBtnOff]}
                      onPress={submit}
                      disabled={!text.trim() || submitting}
                    >
                      {submitting
                        ? <ActivityIndicator color="#fff" size="small" />
                        : <Ionicons name="arrow-up" size={18} color="#fff" />
                      }
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {others.length > 0 && (
                <Text style={styles.sectionLabel}>Сегодня думают люди рядом</Text>
              )}
            </View>
          }
          renderItem={({ item }) => {
            const reacted = myReacted[item.id];
            const itemColor = LEVEL_COLORS[item.level] || colors.accent;
            return (
              <View style={styles.thoughtCard}>
                <Text style={styles.thoughtText}>{item.text}</Text>
                <View style={styles.reactRow}>
                  {REACTIONS.map(r => {
                    const active = reacted === r.type;
                    return (
                      <TouchableOpacity
                        key={r.type}
                        style={[styles.reactBtn, active && { backgroundColor: itemColor + '22', borderColor: itemColor }]}
                        onPress={() => react(item.id, r.type)}
                      >
                        <Ionicons name={r.icon} size={13} color={active ? itemColor : colors.muted} />
                        <Text style={[styles.reactBtnText, active && { color: itemColor }]}>{r.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            myThought ? (
              <View style={styles.empty}>
                <Ionicons name="moon-outline" size={32} color={colors.muted} style={{ marginBottom: 10 }} />
                <Text style={styles.emptyText}>Пока никто не поделился мыслью сегодня</Text>
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
  backBtn: { padding: 2 },
  title: { fontSize: 20, fontWeight: 'bold', color: colors.white },

  list: { padding: 16, gap: 12 },

  myCard: {
    backgroundColor: colors.card, borderRadius: 16,
    padding: 16, borderLeftWidth: 3, marginBottom: 8,
  },
  myCardLabel: { fontSize: 11, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 10 },
  myThoughtText: { fontSize: 15, color: colors.white, fontStyle: 'italic', lineHeight: 22, marginBottom: 14 },
  myReactions: { flexDirection: 'row', gap: 12 },
  myReactionItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  myReactionLabel: { fontSize: 12, color: colors.muted },
  myReactionCount: { fontSize: 13, fontWeight: '700', color: colors.muted, marginLeft: 2 },

  inputWrap: { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  input: {
    flex: 1, backgroundColor: colors.background, borderRadius: 12,
    padding: 12, color: colors.white, fontSize: 15, maxHeight: 100,
  },
  submitBtn: {
    width: 42, height: 42, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  submitBtnOff: { opacity: 0.4 },

  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: colors.muted,
    textTransform: 'uppercase', letterSpacing: 0.7,
    marginTop: 8, marginBottom: 12,
  },

  thoughtCard: {
    backgroundColor: colors.card, borderRadius: 16, padding: 16, gap: 12,
  },
  thoughtText: { fontSize: 15, color: colors.white, lineHeight: 22 },
  reactRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  reactBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6,
  },
  reactBtnText: { fontSize: 12, color: colors.muted, fontWeight: '500' },

  empty: { alignItems: 'center', marginTop: 32 },
  emptyText: { color: colors.muted, fontSize: 14, textAlign: 'center' },
});
