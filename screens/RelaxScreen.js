import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import { colors } from '../theme';

const SOUNDS = [
  { name: '🌧 Дождь', url: 'https://assets.mixkit.co/active_storage/sfx/2515/2515-preview.mp3' },
  { name: '🌊 Волны', url: 'https://assets.mixkit.co/active_storage/sfx/2516/2516-preview.mp3' },
  { name: '🌿 Природа', url: 'https://assets.mixkit.co/active_storage/sfx/2517/2517-preview.mp3' },
];

const TIMER_SECONDS = 300;

export default function RelaxScreen() {
  const [playing, setPlaying] = useState(null);
  const [seconds, setSeconds] = useState(TIMER_SECONDS);
  const soundRef = useRef(null);

  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.stopAsync().then(() => soundRef.current.unloadAsync());
        soundRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!playing) return;

    const interval = setInterval(() => {
      setSeconds(s => {
        if (s <= 1) {
          clearInterval(interval);
          stopSound();
          return TIMER_SECONDS;
        }
        return s - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [playing]);

  const stopSound = async () => {
    if (soundRef.current) {
      await soundRef.current.stopAsync();
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }
    setPlaying(null);
    setSeconds(TIMER_SECONDS);
  };

  const playSound = async (item) => {
    if (playing === item.name) {
      await stopSound();
      return;
    }
    await stopSound();
    const { sound } = await Audio.Sound.createAsync(
      { uri: item.url },
      { shouldPlay: true, isLooping: true }
    );
    soundRef.current = sound;
    setPlaying(item.name);
    setSeconds(TIMER_SECONDS);
  };

  const formatTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>🎧 Релакс</Text>
      <Text style={styles.subtitle}>Выбери звук и выдохни</Text>

      {SOUNDS.map(item => (
        <TouchableOpacity
          key={item.name}
          style={[styles.soundButton, playing === item.name && styles.soundButtonActive]}
          onPress={() => playSound(item)}
        >
          <Text style={styles.soundText}>{item.name}</Text>
          {playing === item.name && <Text style={styles.playingText}>играет ■</Text>}
        </TouchableOpacity>
      ))}

      {playing && (
        <View style={styles.timer}>
          <Text style={styles.timerText}>{formatTime(seconds)}</Text>
          <Text style={styles.timerLabel}>до тишины</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.white,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.accent,
    marginBottom: 32,
  },
  soundButton: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  soundButtonActive: {
    borderWidth: 1,
    borderColor: colors.accent,
  },
  soundText: {
    color: colors.white,
    fontSize: 18,
  },
  playingText: {
    color: colors.accent,
    fontSize: 14,
  },
  timer: {
    marginTop: 32,
    alignItems: 'center',
  },
  timerText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: colors.white,
  },
  timerLabel: {
    color: colors.muted,
    fontSize: 14,
    marginTop: 4,
  },
});
