import AsyncStorage from '@react-native-async-storage/async-storage';
import { store } from '../store';

const key = (channelId) => `${store.userId || 'anon'}_lastRead_${channelId}`;

export const markRead = async (channelId) => {
  try {
    await AsyncStorage.setItem(key(channelId), new Date().toISOString());
  } catch (_) {}
};

export const getLastRead = async (channelId) => {
  try {
    return await AsyncStorage.getItem(key(channelId));
  } catch (_) {
    return null;
  }
};
