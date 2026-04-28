import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotifications() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#7c3aed',
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;

  try {
    const token = (await Notifications.getExpoPushTokenAsync()).data;
    return token;
  } catch {
    return null;
  }
}

const QUEST_HOURS = [8, 11, 14, 17, 20];

const QUEST_MESSAGES = {
  green: [
    { title: 'Доброе утро', body: 'Как ты сегодня? Зайди, напиши мысль.' },
    { title: 'Выдели минуту', body: 'Подыши немного. Это займёт 4 минуты.' },
    { title: 'Середина дня', body: 'Закинь удочку. Просто так.' },
    { title: 'Как дела?', body: 'Зайди, посмотри что пишут другие.' },
    { title: 'Вечер', body: 'Напиши мысль дня. Никто не осудит.' },
  ],
  yellow: [
    { title: 'Доброе утро', body: 'Начни день тихо. Зайди подышать.' },
    { title: 'Тихая минута', body: 'Выдели 4 минуты. Подыши вместе с нами.' },
    { title: 'Как ты?', body: 'Можно просто посидеть. Мы здесь.' },
    { title: 'Загляни', body: 'Закинь удочку. Медитативно и без давления.' },
    { title: 'Вечер', body: 'Напиши мысль дня. Тебя услышат.' },
  ],
  red: [
    { title: 'Доброе утро', body: 'Не нужно ничего делать. Просто загляни.' },
    { title: 'Ты не один', body: 'Выдели минуту. Подыши вместе с нами.' },
    { title: 'Тихий час', body: 'Можно просто посидеть рядом. Рыбалка ждёт.' },
    { title: 'Загляни', body: 'Здесь есть люди с таким же уровнем.' },
    { title: 'Тихий вечер', body: 'Один короткий вдох. Больше ничего не нужно.' },
  ],
};

export async function scheduleQuestNotifications(level) {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;

    await Notifications.cancelAllScheduledNotificationsAsync();

    const messages = QUEST_MESSAGES[level] || QUEST_MESSAGES.green;
    for (let i = 0; i < QUEST_HOURS.length; i++) {
      await Notifications.scheduleNotificationAsync({
        content: { title: messages[i].title, body: messages[i].body, sound: true },
        trigger: { hour: QUEST_HOURS[i], minute: 0, repeats: true },
      });
    }
  } catch {}
}

export async function sendPushNotification(token, title, body) {
  if (!token) return;
  try {
    await fetch('https://exp.host/--/exponent-push-token/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: token, title, body, sound: 'default' }),
    });
  } catch {}
}
