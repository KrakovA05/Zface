import { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { supabase } from '../supabase';
import { store } from '../store';
import { colors, shared } from '../theme';
import { PSYCH_TESTS } from '../utils/psychTests';
import { computeLiveProfile } from '../utils/computeLiveProfile';
import { showAlert } from '../utils/alert';

const ASSESSMENT_TEST_IDS = ['gad7', 'pss4', 'aes_short', 'ucla3', 'mini_spin', 'ecr_short'];
const ASSESSMENT_TESTS = ASSESSMENT_TEST_IDS.map(id => PSYCH_TESTS[id]);
const TOTAL_QUESTIONS = ASSESSMENT_TESTS.reduce((s, t) => s + t.questions.length, 0);

const TEST_OFFSETS = ASSESSMENT_TESTS.reduce((acc, t, i) => {
  acc.push(i === 0 ? 0 : acc[i - 1] + ASSESSMENT_TESTS[i - 1].questions.length);
  return acc;
}, []);

function computeRaw(test, answers) {
  if (test.scoring === 'mean') return answers.reduce((s, v) => s + v, 0) / answers.length;
  const maxVal = test.scale.max;
  const minVal = test.scale.min;
  if (test.scoring === 'sum_with_reverse') {
    return answers.reduce((s, v, i) => {
      const val = test.reverseItems?.includes(i + 1) ? (maxVal + minVal - v) : v;
      return s + val;
    }, 0);
  }
  if (test.reverseAll) return answers.reduce((s, v) => s + (maxVal + minVal - v), 0);
  return answers.reduce((s, v) => s + v, 0);
}

export default function InitialAssessmentScreen({ navigation }) {
  const [testIndex, setTestIndex]   = useState(0);
  const [qIndex, setQIndex]         = useState(0);
  const [allAnswers, setAllAnswers] = useState({});
  const [showIntro, setShowIntro]   = useState(true);
  const [saving, setSaving]         = useState(false);
  const submittingRef               = useRef(false);

  const test     = ASSESSMENT_TESTS[testIndex];
  const globalQ  = TEST_OFFSETS[testIndex] + qIndex + 1;
  const progress = globalQ / TOTAL_QUESTIONS;

  const scaleOptions = [];
  for (let v = test.scale.min; v <= test.scale.max; v++) scaleOptions.push(v);

  const handleAnswer = async (value) => {
    if (saving || submittingRef.current) return;

    const testAnswers   = [...(allAnswers[test.id] || []), value];
    const newAllAnswers = { ...allAnswers, [test.id]: testAnswers };
    setAllAnswers(newAllAnswers);

    const lastQ    = qIndex + 1 >= test.questions.length;
    const lastTest = testIndex + 1 >= ASSESSMENT_TESTS.length;

    if (!lastQ) { setQIndex(qIndex + 1); return; }

    if (!lastTest) {
      setTestIndex(testIndex + 1);
      setQIndex(0);
      setShowIntro(true);
      return;
    }

    submittingRef.current = true;
    setSaving(true);

    const userId = store.userId || (await supabase.auth.getUser())?.data?.user?.id;
    if (!userId) {
      submittingRef.current = false;
      setSaving(false);
      showAlert('Ошибка', 'Сессия истекла. Войди снова.');
      return;
    }

    const inserts = ASSESSMENT_TESTS.map(t => {
      const ans = newAllAnswers[t.id] || [];
      const raw = computeRaw(t, ans);
      return {
        user_id:          userId,
        test_id:          t.id,
        dimension:        t.dimension,
        raw_score:        Math.round(raw),
        normalized_score: t.normalize(raw),
        answers:          ans,
      };
    });

    const { error } = await supabase.from('psych_test_results').insert(inserts);
    if (error) {
      submittingRef.current = false;
      setSaving(false);
      showAlert('Ошибка', 'Не удалось сохранить результат. Попробуй ещё раз.');
      return;
    }

    await computeLiveProfile(userId, { updateLevel: true, saveMetrics: true });
    await supabase.from('users').update({ initial_assessment_done: true }).eq('user_id', userId);

    navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
  };

  if (saving) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={colors.accent} size="large" />
        <Text style={styles.savingText}>Определяем твой уровень…</Text>
      </View>
    );
  }

  if (showIntro) {
    const progressPct = (TEST_OFFSETS[testIndex] / TOTAL_QUESTIONS) * 100;
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
          </View>
          <Text style={styles.progressHint}>{TEST_OFFSETS[testIndex]} из {TOTAL_QUESTIONS}</Text>
          <Text style={styles.sectionLabel}>{test.title}</Text>
          <Text style={styles.introText}>{test.intro}</Text>
          <View style={styles.scaleHintRow}>
            <Text style={styles.scaleHintLabel}>{test.scale.labels[0]}</Text>
            <Text style={styles.scaleHintArrow}>→</Text>
            <Text style={styles.scaleHintLabel}>{test.scale.labels[1]}</Text>
          </View>
          <TouchableOpacity
            style={[shared.button, { marginTop: 32 }]}
            onPress={() => setShowIntro(false)}
            activeOpacity={0.8}
          >
            <Text style={shared.buttonText}>Начать</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
        <View style={styles.progressRow}>
          <Text style={styles.honestHint}>Твои ответы видишь только ты</Text>
          <Text style={styles.progressText}>{globalQ} / {TOTAL_QUESTIONS}</Text>
        </View>
        <Text style={styles.question}>{test.questions[qIndex]}</Text>
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: colors.background },
  center:         { alignItems: 'center', justifyContent: 'center' },
  content:        { flex: 1, padding: 24, paddingTop: 48 },
  progressBar:    { height: 4, backgroundColor: colors.border, borderRadius: 2, marginBottom: 8 },
  progressFill:   { height: 4, backgroundColor: colors.accent, borderRadius: 2 },
  progressRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  progressHint:   { fontSize: 11, color: colors.muted, marginBottom: 24 },
  honestHint:     { fontSize: 11, color: colors.muted, opacity: 0.7 },
  progressText:   { fontSize: 12, color: colors.muted },
  sectionLabel:   { fontSize: 22, fontWeight: '700', color: colors.white, marginBottom: 12 },
  introText:      { fontSize: 15, color: colors.white, opacity: 0.75, lineHeight: 22, marginBottom: 20 },
  scaleHintRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  scaleHintLabel: { fontSize: 13, color: colors.muted },
  scaleHintArrow: { fontSize: 13, color: colors.muted },
  question:       { fontSize: 17, fontWeight: '500', color: colors.white, lineHeight: 26, marginBottom: 32 },
  scaleRow:       { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  scaleLabel:     { fontSize: 11, color: colors.muted, maxWidth: 100 },
  optionsRow:     { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  optionBtn: {
    flex: 1, aspectRatio: 1, backgroundColor: colors.card,
    borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  optionText:  { fontSize: 16, fontWeight: '600', color: colors.white },
  savingText:  { fontSize: 16, color: colors.muted, marginTop: 16 },
});
