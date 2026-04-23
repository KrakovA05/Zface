import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { store } from '../store';
import { LEVEL_DATA, LEVEL_COLORS, TEST_PACKS } from '../constants';
import { colors, shared } from '../theme';

function isSameDay(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
}

function timeUntilMidnight() {
  const now = new Date();
  const midnight = new Date();
  midnight.setHours(24, 0, 0, 0);
  const diff = midnight - now;
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return `${h} ч ${m} мин`;
}

export default function TestScreen({ navigation }) {
  const [current, setCurrent] = useState(0);
  const [pessimisticCount, setPessimisticCount] = useState(0);
  const [finished, setFinished] = useState(false);
  const [level, setLevel] = useState(null);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(true);
  const [alreadyDone, setAlreadyDone] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [pack, setPack] = useState(null); // { title, questions }
  const [packId, setPackId] = useState(0);

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('test_results')
          .select('level, created_at, pack_id')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (data && isSameDay(data.created_at)) {
          setAlreadyDone(true);
          setLastResult(data);
        } else {
          // Следующий пакет: (последний + 1) % кол-во пакетов
          const lastPackId = data?.pack_id ?? -1;
          const nextPackId = (lastPackId + 1) % TEST_PACKS.length;
          setPackId(nextPackId);
          setPack(TEST_PACKS[nextPackId]);
        }
      }
      setChecking(false);
    };
    check();
  }, []);

  const saveResult = async (lvl, score) => {
    store.level = lvl;
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await Promise.all([
        supabase.from('users').update({ level: lvl }).eq('user_id', user.id),
        supabase.from('test_results').insert({ user_id: user.id, level: lvl, score, pack_id: packId }),
      ]);
    }
  };

  const answer = async (isPessimistic) => {
    if (finished || saving || !pack) return;
    const newCount = pessimisticCount + (isPessimistic ? 1 : 0);
    setPessimisticCount(newCount);

    if (current + 1 >= pack.questions.length) {
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

  if (checking) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (alreadyDone && lastResult) {
    const lvlData = LEVEL_DATA[lastResult.level];
    const lvlColor = LEVEL_COLORS[lastResult.level];
    return (
      <View style={styles.container}>
        <Text style={styles.blockedEmoji}>🕐</Text>
        <Text style={styles.blockedTitle}>Тест уже пройден сегодня</Text>
        <View style={[styles.blockedCard, { borderColor: lvlColor }]}>
          <Text style={styles.blockedCardLabel}>Результат сегодня</Text>
          <Text style={[styles.blockedCardLevel, { color: lvlColor }]}>
            {lvlData.emoji} {lvlData.label}
          </Text>
        </View>
        <Text style={styles.blockedHint}>
          Следующий тест через{'\n'}
          <Text style={{ color: colors.accent, fontWeight: 'bold' }}>
            {timeUntilMidnight()}
          </Text>
        </Text>
        <TouchableOpacity
          style={[shared.button, { backgroundColor: lvlColor, marginTop: 8 }]}
          onPress={() => navigation.replace('Recommendations', { level: lastResult.level })}
        >
          <Text style={shared.buttonText}>Смотреть рекомендации →</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.navigate('Main')}
        >
          <Text style={styles.backBtnText}>На главную</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (finished && level) {
    const lvlData = LEVEL_DATA[level];
    return (
      <View style={styles.container}>
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
      </View>
    );
  }

  if (!pack) return null;

  const q = pack.questions[current];

  return (
    <View style={styles.container}>
      <Text style={styles.packTitle}>{pack.title}</Text>
      <Text style={styles.progress}>{current + 1} / {pack.questions.length}</Text>
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${((current + 1) / pack.questions.length) * 100}%` }]} />
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 24,
    justifyContent: 'center',
  },
  packTitle: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    textAlign: 'center',
    marginBottom: 6,
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
  blockedEmoji: {
    fontSize: 64,
    textAlign: 'center',
    marginBottom: 16,
  },
  blockedTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.white,
    textAlign: 'center',
    marginBottom: 24,
  },
  blockedCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: 24,
    width: '100%',
  },
  blockedCardLabel: {
    fontSize: 13,
    color: colors.muted,
    marginBottom: 6,
  },
  blockedCardLevel: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  blockedHint: {
    fontSize: 16,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 24,
  },
  backBtn: {
    marginTop: 12,
    padding: 12,
  },
  backBtnText: {
    color: colors.muted,
    fontSize: 15,
    textAlign: 'center',
  },
});
