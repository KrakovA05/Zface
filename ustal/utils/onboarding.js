import AsyncStorage from '@react-native-async-storage/async-storage';

export async function hasSeenHint(key) {
  try {
    return !!(await AsyncStorage.getItem(`onboard_${key}`));
  } catch {
    return true;
  }
}

export async function markHintSeen(key) {
  try {
    await AsyncStorage.setItem(`onboard_${key}`, '1');
  } catch {}
}
