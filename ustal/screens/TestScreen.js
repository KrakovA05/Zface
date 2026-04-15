import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabase';
import { store } from '../store';
import { LEVEL_DATA } from '../constants';
import { colors, shared } from '../theme';

const QUESTIONS = [
  {
    question: 'Как ты обычно просыпаешься утром?',
    answers: [
      { text: 'С трудом, не хочу вставать', pessimistic: true },
      { text: 'Нормально, встаю когда надо', pessimistic: false },
    ],
  },
  {
    question: 'Когда что-то идёт не по плану, ты думаешь...',
    answers: [
      { text: 'Ну и ладно, бывает', pessimistic: false },
      { text: 'Всё как всегда, ничего не работает', pessimistic: true },
    ],
  },
  {
    question: 'Как ты относишься к своей работе или учёбе?',
    answers: [
      { text: 'Терплю, но особого смысла не вижу', pessimistic: true },
      { text: 'Есть моменты которые мне нравятся', pessimistic: false },
    ],
  },
  {
    question: 'Когда тебе предлагают помощь, ты...',
    answers: [
      { text: 'Принимаю, это приятно', pessimistic: false },
      { text: 'Отказываюсь, всё равно не поможет', pessimistic: true },
    ],
  },
  {
    question: 'Как часто ты чувствуешь усталость без причины?',
    answers: [
      { text: 'Почти каждый день', pessimistic: true },
      { text: 'Иногда, но это нормально', pessimistic: false },
    ],
  },
  {
    question: 'Что ты думаешь о будущем?',
    answers: [
      { text: 'Там будет лучше чем сейчас', pessimistic: false },
      { text: 'Вряд ли что-то изменится', pessimistic: true },
    ],
  },
  {
    question: 'Как ты проводишь свободное время?',
    answers: [
      { text: 'Лежу и ничего не хочу делать', pessimistic: true },
      { text: 'Нахожу что-то интересное', pessimistic: false },
    ],
  },
  {
    question: 'Когда ты видишь счастливых людей, ты думаешь...',
    answers: [
      { text: 'Рад за них', pessimistic: false },
      { text: 'Интересно, долго ли это продлится', pessimistic: true },
    ],
  },
  {
    question: 'Как ты относишься к общению с людьми?',
    answers: [
      { text: 'Чаще хочется побыть одному', pessimistic: true },
      { text: 'Люблю общаться когда есть настроение', pessimistic: false },
    ],
  },
  {
    question: 'Как ты оцениваешь свою жизнь прямо сейчас?',
    answers: [
      { text: 'Могло быть лучше, но жить можно', pessimistic: false },
      { text: 'Честно — всё достало', pessimistic: true },
    ],
  },
];

export default function TestScreen({ navigation }) {
  const [current, setCurrent] = useState(0);
  const [pessimisticCount, setPessimisticCount] = useState(0);
  const [finished, setFinished] = useState(false);
  const [level, setLevel] = useState(null);
  const [saving, setSaving] = useState(false);

  const saveResult = async (lvl, score) => {
    store.level = lvl;
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await Promise.all([
        supabase.from('users').update({ level: lvl }).eq('user_id', user.id),
        supabase.from('test_results').insert({ user_id: user.id, level: lvl, score }),
      ]);
    }
  };

  const answer = async (isPessimistic) => {
    const newCount = pessimisticCount + (isPessimistic ? 1 : 0);
    setPessimisticCount(newCount);

    if (current + 1 >= QUESTIONS.length) {
      let lvl;
      if (newCount <= 3) lvl = 'green';
      else if (newCount <= 7) lvl = 'yellow';
      else lvl = 'red';

      setLevel(lvl);
      setFinished(true);
      setSaving(true);
      await saveResult(lvl, newCount);
      setSaving(false);
    } else {
      setCurrent(current + 1);
    }
  };

  if (finished && level) {
    const lvlData = LEVEL_DATA[level];
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.resultEmoji}>{lvlData.emoji}</Text>
        <Text style={[styles.resultLevel, { color: lvlData.color }]}>{lvlData.label}</Text>
        <Text style={styles.resultText}>{lvlData.text}</Text>
        {saving ? (
          <ActivityIndicator color={lvlData.color} style={styles.saving} />
        ) : (
          <TouchableOpacity
            style={[shared.button, { backgroundColor: lvlData.color }]}
            onPress={() => navigation.replace('Recommendations', { level })}
          >
            <Text style={shared.buttonText}>Смотреть рекомендации →</Text>
          </TouchableOpacity>
        )}
      </SafeAreaView>
    );
  }

  const q = QUESTIONS[current];

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.progress}>{current + 1} / {QUESTIONS.length}</Text>
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${((current + 1) / QUESTIONS.length) * 100}%` }]} />
      </View>

      <Text style={styles.question}>{q.question}</Text>

      {q.answers.map((a, i) => (
        <TouchableOpacity
          key={i}
          style={styles.answerButton}
          onPress={() => answer(a.pessimistic)}
        >
          <Text style={styles.answerText}>{a.text}</Text>
        </TouchableOpacity>
      ))}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 24,
    justifyContent: 'center',
  },
  progress: {
    color: colors.muted,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.card,
    borderRadius: 2,
    marginBottom: 48,
  },
  progressFill: {
    height: 4,
    backgroundColor: colors.accent,
    borderRadius: 2,
  },
  question: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.white,
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 30,
  },
  answerButton: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
  },
  answerText: {
    color: colors.white,
    fontSize: 16,
    textAlign: 'center',
  },
  resultEmoji: {
    fontSize: 80,
    textAlign: 'center',
    marginBottom: 24,
  },
  resultLevel: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
  },
  resultText: {
    fontSize: 16,
    color: colors.white,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 40,
  },
  saving: {
    marginTop: 8,
  },
});
