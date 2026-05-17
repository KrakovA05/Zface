import {
  StyleSheet, Text, View, TouchableOpacity, ScrollView,
  Linking, LayoutAnimation, Platform, UIManager, ActivityIndicator,
} from 'react-native';
import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../supabase';
import { colors } from '../theme';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

const TOPIC_META = {
  anxiety:        { label: 'Тревога',               icon: 'pulse-outline',        color: '#E8A838' },
  depression:     { label: 'Апатия и депрессия',     icon: 'cloud-outline',        color: '#7B9BD5' },
  burnout:        { label: 'Выгорание',              icon: 'flame-outline',        color: '#E07060' },
  loneliness:     { label: 'Одиночество',            icon: 'person-outline',       color: '#9B7BD5' },
  self_esteem:    { label: 'Самооценка',             icon: 'star-outline',         color: '#60B8A0' },
  stress:         { label: 'Стресс',                 icon: 'thunderstorm-outline', color: '#D57B60' },
  attachment:     { label: 'Отношения',              icon: 'heart-outline',        color: '#D56080' },
  social_anxiety: { label: 'Социальная тревожность', icon: 'people-outline',       color: '#80A0D5' },
};

export default function ResourcesScreen() {
  const [loading, setLoading] = useState(true);
  const [recommended, setRecommended] = useState([]);
  const [byTopic, setByTopic] = useState({});
  const [openTopics, setOpenTopics] = useState({});

  useFocusEffect(useCallback(() => {
    loadResources();
  }, []));

  const loadResources = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();

    const { data: resources } = await supabase.from('resources').select('*').limit(500);
    if (!resources) { setLoading(false); return; }

    let userMetrics = null;
    let currentFocus = null;
    if (user) {
      const { data: m } = await supabase
        .from('user_metrics')
        .select('anxiety_score,stress_score,apathy_score,loneliness_score,burnout_score,self_esteem_score,social_anxiety_score,attachment_score')
        .eq('user_id', user.id)
        .order('week_start', { ascending: false })
        .limit(1)
        .maybeSingle();
      userMetrics = m;

      const { data: focusData } = await supabase
        .from('users')
        .select('current_focus')
        .eq('user_id', user.id)
        .maybeSingle();
      currentFocus = focusData?.current_focus || null;

    }

    const dimMap = userMetrics ? {
      anxiety:        userMetrics.anxiety_score,
      stress:         userMetrics.stress_score,
      apathy:         userMetrics.apathy_score,
      loneliness:     userMetrics.loneliness_score,
      burnout:        userMetrics.burnout_score,
      self_esteem:    userMetrics.self_esteem_score,
      social_anxiety: userMetrics.social_anxiety_score,
      attachment:     userMetrics.attachment_score,
    } : {};

    const applyFocusBoost = !!currentFocus;
    const scored = resources.map(r => {
      let score = 0;
      if (userMetrics && r.dimension_weights) {
        for (const [dim, weight] of Object.entries(r.dimension_weights)) {
          const boost = applyFocusBoost && dim === currentFocus ? 1.3 : 1;
          score += (dimMap[dim] ?? 50) * weight * boost;
        }
      }
      return { ...r, _score: score };
    });

    const top5 = [...scored].sort((a, b) => b._score - a._score).slice(0, 5);
    setRecommended(top5);

    const grouped = {};
    for (const r of scored) {
      if (!grouped[r.topic]) grouped[r.topic] = [];
      grouped[r.topic].push(r);
    }
    setByTopic(grouped);
    setLoading(false);
  };

  const toggleTopic = (topicId) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenTopics(prev => ({ ...prev, [topicId]: !prev[topicId] }));
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color={colors.accent} />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>Материалы</Text>

      {recommended.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Для тебя сейчас</Text>
          {recommended.map(item => <ResourceItem key={item.id} item={item} />)}
        </View>
      )}

      <Text style={styles.sectionTitle}>Другие темы</Text>
      {Object.entries(byTopic).map(([topicId, items]) => {
        const meta = TOPIC_META[topicId] || { label: topicId, icon: 'book-outline', color: colors.accent };
        const isOpen = openTopics[topicId];
        return (
          <View key={topicId} style={styles.topicBlock}>
            <TouchableOpacity style={styles.topicHeader} onPress={() => toggleTopic(topicId)} activeOpacity={0.7}>
              <Ionicons name={meta.icon} size={20} color={meta.color} />
              <Text style={styles.topicLabel}>{meta.label}</Text>
              <Text style={styles.topicCount}>{items.length}</Text>
              <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.muted} />
            </TouchableOpacity>
            {isOpen && items.map(item => <ResourceItem key={item.id} item={item} />)}
          </View>
        );
      })}
    </ScrollView>
  );
}

function ResourceItem({ item }) {
  return (
    <TouchableOpacity style={styles.item} onPress={() => { const u = item.url; if (u && (u.startsWith('https://') || u.startsWith('http://'))) Linking.openURL(u); }} activeOpacity={0.7}>
      <Ionicons
        name={item.type === 'video' ? 'play-circle-outline' : 'document-text-outline'}
        size={18} color={colors.accent} style={{ marginRight: 10 }}
      />
      <Text style={styles.itemTitle}>{item.title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 48 },
  header: { fontSize: 26, fontWeight: '700', color: colors.white, marginBottom: 24 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: colors.white, marginBottom: 12 },
  topicBlock: { backgroundColor: colors.card, borderRadius: 16, marginBottom: 12, overflow: 'hidden' },
  topicHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 10 },
  topicLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.white },
  topicCount: { fontSize: 12, color: colors.muted, marginRight: 4 },
  item: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  itemTitle: { flex: 1, fontSize: 14, color: colors.white, lineHeight: 20 },
});
