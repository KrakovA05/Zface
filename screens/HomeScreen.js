import { StyleSheet, Text, View, TouchableOpacity, ScrollView } from 'react-native';
import { useMemo } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PHRASES } from '../constants';
import { colors } from '../theme';

export default function HomeScreen({ navigation }) {
  const phrase = useMemo(
    () => PHRASES[Math.floor(Math.random() * PHRASES.length)],
    []
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.greeting}>Привет 👋</Text>
          <Text style={styles.permission}>
            Сегодня ты имеешь право... {phrase}
          </Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('Relax')}
          >
            <Text style={styles.actionIcon}>🎧</Text>
            <Text style={styles.actionText}>Тишина</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('Chat')}
          >
            <Text style={styles.actionIcon}>📝</Text>
            <Text style={styles.actionText}>Пожаловаться</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('Relax')}
          >
            <Text style={styles.actionIcon}>🛌</Text>
            <Text style={styles.actionText}>Перерыв</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.post}>
          <Text style={styles.postText}>
            47% пользователей сегодня тоже не хотят работать 🙃
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 24,
  },
  header: {
    marginBottom: 32,
  },
  greeting: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.white,
    marginBottom: 8,
  },
  permission: {
    fontSize: 16,
    color: colors.accent,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  actionButton: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    width: '30%',
  },
  actionIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  actionText: {
    color: colors.white,
    fontSize: 12,
    textAlign: 'center',
  },
  post: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
  },
  postText: {
    color: colors.white,
    fontSize: 16,
    lineHeight: 24,
  },
});
