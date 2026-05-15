import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native';
import { colors } from '../theme';

export default function AiChatScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerAvatar}>
          <Text style={styles.headerAvatarIcon}>✦</Text>
        </View>
        <View>
          <Text style={styles.headerName}>@один</Text>
          <Text style={styles.headerSub}>я здесь каждый день</Text>
        </View>
      </View>
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>чат скоро появится здесь</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E8DFD0',
    backgroundColor: '#FFFFFF',
    gap: 12,
  },
  headerAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#c9a96e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarIcon: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
  headerName: { fontSize: 16, fontWeight: '700', color: '#2C2420' },
  headerSub: { fontSize: 12, color: '#999', marginTop: 2 },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  placeholderText: { fontSize: 14, color: '#999' },
});
