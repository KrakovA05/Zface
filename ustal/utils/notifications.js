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

const NIGHT_MESSAGES = {
  green:  { title: 'Не спишь?', body: 'Ночная комната открыта. Там свои.' },
  yellow: { title: 'Не спится?', body: 'Зайди в ночную комнату. Там тихо.' },
  red:    { title: 'Ночь бывает тяжёлой', body: 'Мы здесь. Ночная комната открыта.' },
};

const WEEKEND_MESSAGES = {
  green:  { title: 'Пятница', body: 'Как провёл неделю? Зайди, расскажи.' },
  yellow: { title: 'Пятница вечером', body: 'Самое время зайти к своим.' },
  red:    { title: 'Неделя позади', body: 'Ты справился. Зайди если хочется просто побыть.' },
};

const RETURN_MESSAGES = {
  green:  { title: 'Привет', body: 'Давно не видели тебя. Как ты?' },
  yellow: { title: 'Мы здесь', body: 'Несколько дней не заходил. Всё нормально?' },
  red:    { title: 'Ты не один', body: 'Мы заметили что тебя не было. Зайди, если нужно.' },
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

    // Ночная комната — 23:00 каждую ночь
    const night = NIGHT_MESSAGES[level] || NIGHT_MESSAGES.green;
    await Notifications.scheduleNotificationAsync({
      content: { title: night.title, body: night.body, sound: true },
      trigger: { hour: 23, minute: 0, repeats: true },
    });

    // Пятничный пуш — каждую пятницу в 21:00 (weekday: 6 = пятница)
    const weekend = WEEKEND_MESSAGES[level] || WEEKEND_MESSAGES.green;
    await Notifications.scheduleNotificationAsync({
      content: { title: weekend.title, body: weekend.body, sound: true },
      trigger: { weekday: 6, hour: 21, minute: 0, repeats: true },
    });

  } catch {}
}

// Вызывается при каждом открытии приложения — откладывает напоминание на 3 дня вперёд.
// Если пользователь не открывает 3 дня — пуш придёт.
export async function scheduleReturnReminder(level) {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;

    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const existing = scheduled.filter(n => n.content.data?.type === 'return_reminder');
    await Promise.all(existing.map(n => Notifications.cancelScheduledNotificationAsync(n.identifier)));

    const msg = RETURN_MESSAGES[level] || RETURN_MESSAGES.green;
    await Notifications.scheduleNotificationAsync({
      content: { title: msg.title, body: msg.body, sound: true, data: { type: 'return_reminder' } },
      trigger: { seconds: 3 * 24 * 60 * 60 },
    });
  } catch {}
}

export async function scheduleWeeklyReport(userId) {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;

    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const existing = scheduled.filter(n => n.content.data?.type === 'weekly_report');
    if (existing.length > 0) return;

    const { supabase } = await import('../supabase');
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [{ data: userData }, { count: letters }, { count: helped }, { count: answers }] = await Promise.all([
      supabase.from('users').select('login_streak').eq('user_id', userId).single(),
      supabase.from('anonymous_letters').select('*', { count: 'exact', head: true }).eq('author_id', userId).gte('created_at', weekAgo),
      supabase.from('user_helps').select('*', { count: 'exact', head: true }).eq('helper_id', userId).gte('created_at', weekAgo),
      supabase.from('daily_answers').select('*', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', weekAgo),
    ]);

    const streak = userData?.login_streak || 0;
    const parts = [];
    if (streak > 0) parts.push(`${streak} ${streak === 1 ? 'день' : streak < 5 ? 'дня' : 'дней'} подряд`);
    if (letters) parts.push(`${letters} ${letters === 1 ? 'письмо' : 'письма'}`);
    if (helped) parts.push(`помог ${helped} ${helped === 1 ? 'человеку' : 'людям'}`);
    if (answers) parts.push(`${answers} ответов на вопрос дня`);

    const body = parts.length > 0 ? parts.join(' · ') : 'ты был здесь на этой неделе. это что-то значит.';

    await Notifications.scheduleNotificationAsync({
      content: { title: 'Эта неделя', body, sound: true, data: { type: 'weekly_report' } },
      trigger: { weekday: 1, hour: 19, minute: 0, repeats: true },
    });
  } catch {}
}

export async function scheduleLowMoodPush() {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;

    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const existing = scheduled.filter(n => n.content.data?.type === 'low_mood_support');
    if (existing.length > 0) return; // уже запланирован

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Ты держишься',
        body: 'Последние дни непростые. Зайди подышать или просто побудь с нами.',
        sound: true,
        data: { type: 'low_mood_support' },
      },
      trigger: { seconds: 3 * 60 * 60 },
    });
  } catch {}
}

const STOP_WORDS = new Set([
  'это','что','как','так','но','все','же','уже','вот','или','для','при','нет','ещё',
  'раз','там','тут','когда','если','чтобы','бы','можно','очень','просто','только',
  'себя','тебя','меня','него','неё','них','твой','мой','свой','наш','ваш','они',
  'тоже','хочу','знаю','надо','стало','было','есть','быть','буду','тоже','тебе','меня',
  'мне','этот','этой','этом','того','тому','кого','кому','кем','чем','чего','чему',
  'между','перед','после','снова','через','пока','сюда','туда','теперь','потом','здесь',
]);

export async function scheduleRoomDigestPush(level) {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;

    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const existing = scheduled.filter(n => n.content.data?.type === 'room_digest');
    await Promise.all(existing.map(n => Notifications.cancelScheduledNotificationAsync(n.identifier)));

    const { supabase } = await import('../supabase');
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: msgs } = await supabase
      .from('messages')
      .select('text')
      .eq('level', level)
      .gte('created_at', since);

    if (!msgs || msgs.length < 5) return;

    const freq = {};
    for (const { text } of msgs) {
      for (const raw of text.toLowerCase().split(/\s+/)) {
        const w = raw.replace(/[^а-яёa-z]/gi, '');
        if (w.length < 4 || STOP_WORDS.has(w)) continue;
        freq[w] = (freq[w] || 0) + 1;
      }
    }

    const top = Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([w]) => w);

    if (top.length === 0) return;

    const body = top.join(', ');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    const secondsUntil = Math.floor((tomorrow.getTime() - Date.now()) / 1000);

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'сегодня в комнате говорили о...',
        body,
        sound: true,
        data: { type: 'room_digest' },
      },
      trigger: { seconds: secondsUntil },
    });
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
