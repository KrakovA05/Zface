import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../supabase';
import { store } from '../store';
import { colors, shared } from '../theme';
import { PSYCH_TESTS } from '../utils/psychTests';

export default function PsychTestScreen({ route, navigation }) {
  const { testId, onComplete } = route.params;
  const test = PSYCH_TESTS[testId];

  if (!test) {
    return (
      <View style={styles.container}>
        <Text style={[styles.doneTitle, { marginTop: 80 }]}>Тест не найден</Text>
        <TouchableOpacity style={[shared.button, { marginTop: 32 }]} onPress={() => navigation.goBack()}>
          <Text style={shared.buttonText}>Назад</Text>
        </TouchableOpacity>
      </View>
    );
  }
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const scaleOptions = [];
  for (let v = test.scale.min; v <= test.scale.max; v++) scaleOptions.push(v);

  const handleAnswer = async (value) => {
    const newAnswers = [...answers, value];
    setAnswers(newAnswers);

    if (current + 1 < test.questions.length) {
      setCurrent(current + 1);
      return;
    }

    setSaving(true);
    const rawScore = computeRaw(test, newAnswers);
    const normalizedScore = test.normalize(rawScore);

    const userId = store.userId || (await supabase.auth.getUser())?.data?.user?.id;
    if (!userId) {
      setSaving(false);
      Alert.alert('Ошибка', 'Сессия истекла. Войди снова.');
      return;
    }
    const { error } = await supabase.from('psych_test_results').insert({
      user_id: userId,
      test_id: test.id,
      dimension: test.dimension,
      raw_score: Math.round(rawScore),
      normalized_score: normalizedScore,
      answers: newAnswers,
    });
    if (error) {
      setSaving(false);
      Alert.alert('Ошибка', 'Не удалось сохранить результат. Попробуй ещё раз.');
      return;
    }
    setSaving(false);
    await AsyncStorage.setItem('profile_updated', 'true');
    setDone(true);
  };

  if (done) {
    return (
      <View style={styles.container}>
        <Text style={styles.doneTitle}>Готово</Text>
        <Text style={styles.doneSub}>Ответы сохранены. Спасибо.</Text>
        <TouchableOpacity
          style={[shared.button, { marginTop: 32 }]}
          onPress={() => { if (onComplete) onComplete(); navigation.goBack(); }}
        >
          <Text style={shared.buttonText}>Продолжить</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (saving) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.accent} />
        <Text style={[styles.doneSub, { marginTop: 12 }]}>Сохраняем результат…</Text>
      </View>
    );
  }

  const q = test.questions[current];
  const progress = (current + 1) / test.questions.length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity
        style={styles.backBtn}
        onPress={() => navigation.goBack()}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="close" size={22} color={colors.muted} />
      </TouchableOpacity>
      <Text style={styles.testTitle}>{test.title}</Text>
      <Text style={styles.testSubtitle}>{test.subtitle}</Text>

      {current === 0 && (
        <Text style={styles.intro}>{test.intro}</Text>
      )}

      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>
      <Text style={styles.progressText}>{current + 1} / {test.questions.length}</Text>

      <Text style={styles.question}>{q}</Text>

      <View style={styles.scaleRow}>
        <Text style={[styles.scaleLabel, { textAlign: 'left' }]}>{test.scale.labels[0]}</Text>
        <Text style={[styles.scaleLabel, { textAlign: 'right' }]}>{test.scale.labels[1]}</Text>
      </View>
      <View style={styles.optionsRow}>
        {scaleOptions.map(v => (
          <TouchableOpacity
            key={v}
            style={styles.optionBtn}
            onPress={() => handleAnswer(v)}
            activeOpacity={0.7}
          >
            <Text style={styles.optionText}>{v}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

function computeRaw(test, answers) {
  if (test.scoring === 'mean') {
    return answers.reduce((s, v) => s + v, 0) / answers.length;
  }
  const maxVal = test.scale.max;
  const minVal = test.scale.min;
  if (test.scoring === 'sum_with_reverse') {
    return answers.reduce((s, v, i) => {
      const val = test.reverseItems?.includes(i + 1) ? (maxVal + minVal - v) : v;
      return s + val;
    }, 0);
  }
  if (test.reverseAll) {
    return answers.reduce((s, v) => s + (maxVal + minVal - v), 0);
  }
  return answers.reduce((s, v) => s + v, 0);
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 24, paddingBottom: 48 },
  backBtn: { alignSelf: 'flex-end', marginBottom: 8, padding: 4 },
  testTitle: { fontSize: 22, fontWeight: '700', color: colors.white, marginBottom: 4 },
  testSubtitle: { fontSize: 14, color: colors.muted, marginBottom: 16 },
  intro: { fontSize: 15, color: colors.white, opacity: 0.75, marginBottom: 20, lineHeight: 22 },
  progressBar: { height: 4, backgroundColor: colors.border, borderRadius: 2, marginBottom: 8 },
  progressFill: { height: 4, backgroundColor: colors.accent, borderRadius: 2 },
  progressText: { fontSize: 12, color: colors.muted, marginBottom: 24, textAlign: 'right' },
  question: { fontSize: 17, color: colors.white, lineHeight: 26, marginBottom: 32, fontWeight: '500' },
  scaleRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  scaleLabel: { fontSize: 11, color: colors.muted, maxWidth: 100 },
  optionsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  optionBtn: {
    flex: 1, aspectRatio: 1, backgroundColor: colors.card,
    borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  optionText: { fontSize: 16, fontWeight: '600', color: colors.white },
  doneTitle: { fontSize: 26, fontWeight: '700', color: colors.white, textAlign: 'center', marginTop: 80 },
  doneSub: { fontSize: 16, color: colors.muted, textAlign: 'center', marginTop: 12 },
});
