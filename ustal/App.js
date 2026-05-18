import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState, useRef, useCallback } from 'react';

SplashScreen.preventAutoHideAsync();
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, AppState } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from './supabase';
import { store } from './store';
import { colors } from './theme';
import * as Notifications from 'expo-notifications';
import { registerForPushNotifications, scheduleQuestNotifications, scheduleReturnReminder, scheduleWeeklyReport, scheduleRoomDigestPush } from './utils/notifications';
import { getLastRead } from './utils/unread';
import { initCrashReporting } from './utils/crashReporting';
import { createNavigationListener } from './utils/analytics';
import StreakModal from './components/StreakModal';

initCrashReporting();

import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import EmailConfirmScreen from './screens/EmailConfirmScreen';
import TestScreen from './screens/TestScreen';
import RecommendationsScreen from './screens/RecommendationsScreen';
import OnboardingMomentScreen from './screens/OnboardingMomentScreen';
import OnboardingCarouselScreen from './screens/OnboardingCarouselScreen';
import ThoughtsScreen from './screens/ThoughtsScreen';
import HomeScreen from './screens/HomeScreen';
import MessagesScreen from './screens/MessagesScreen';
import ChatScreen from './screens/ChatScreen';
import BreathingScreen from './screens/BreathingScreen';
import ProfileScreen from './screens/ProfileScreen';
import FriendsScreen from './screens/FriendsScreen';
import DirectMessageScreen from './screens/DirectMessageScreen';
import UserProfileScreen from './screens/UserProfileScreen';
import FeedScreen from './screens/FeedScreen';
import RoomsScreen from './screens/RoomsScreen';
import FishingScreen from './screens/FishingScreen';
import PostScreen from './screens/PostScreen';
import ResourcesScreen from './screens/ResourcesScreen';
import LetterScreen from './screens/LetterScreen';
import SupportScreen from './screens/SupportScreen';
import NotificationsScreen from './screens/NotificationsScreen';
import PsychTestScreen from './screens/PsychTestScreen';
import AiChatScreen from './screens/AiChatScreen'
import AccountSettingsScreen from './screens/AccountSettingsScreen';
import AdminScreen from './screens/AdminScreen';
import AdminUserProfileScreen from './screens/AdminUserProfileScreen';
import AnalyticsScreen from './screens/AnalyticsScreen';
import AchievementsScreen from './screens/AchievementsScreen';
import AnalyticsPreviewScreen from './screens/AnalyticsPreviewScreen';
import DimensionHistoryScreen from './screens/DimensionHistoryScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const TAB_ICONS = {
  Home:     { focused: 'home',        blur: 'home-outline' },
  Feed:     { focused: 'newspaper',   blur: 'newspaper-outline' },
  Messages: { focused: 'chatbubbles', blur: 'chatbubbles-outline' },
  Friends:  { focused: 'people',      blur: 'people-outline' },
  Profile:  { focused: 'person',      blur: 'person-outline' },
};

function CustomTabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[tabStyles.wrapper, { paddingBottom: insets.bottom || 12 }]}>
      <View style={tabStyles.pill}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const badge = descriptors[route.key].options.tabBarBadge;
          const icons = TAB_ICONS[route.name];

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          // Спецрендер для таба @один
          if (route.name === 'AiChat') {
            return (
              <TouchableOpacity
                key={route.key}
                onPress={onPress}
                style={[tabStyles.tab, focused && tabStyles.tabActive]}
                activeOpacity={0.7}
              >
                <View style={tabStyles.iconWrap}>
                  <Text style={[tabStyles.aiTabStar, { color: focused ? '#8B7355' : 'rgba(44,36,32,0.35)' }]}>✦</Text>
                  <View style={tabStyles.aiTabBadge}>
                    <Text style={tabStyles.aiTabBadgeText}>AI</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              style={[tabStyles.tab, focused && tabStyles.tabActive]}
              activeOpacity={0.7}
            >
              <View style={tabStyles.iconWrap}>
                <Ionicons
                  name={focused ? icons.focused : icons.blur}
                  size={24}
                  color={focused ? '#8B7355' : 'rgba(44,36,32,0.35)'}
                />
                {!!badge && (
                  <View style={tabStyles.badge}>
                    <Text style={tabStyles.badgeText}>
                      {typeof badge === 'number' && badge > 99 ? '99+' : String(badge)}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const tabStyles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 8,
    backgroundColor: 'transparent',
  },
  pill: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 34,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#E8DFD0',
    shadowColor: '#8B7B6B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 26,
  },
  tabActive: {
    backgroundColor: 'rgba(124,58,237,0.08)',
  },
  iconWrap: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -8,
    backgroundColor: '#e74c3c',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: 'bold',
  },
  aiTabStar: {
    fontSize: 22,
    fontWeight: '700',
  },
  aiTabBadge: {
    position: 'absolute',
    top: -5,
    right: -6,
    backgroundColor: '#7B61FF',
    borderRadius: 5,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  aiTabBadgeText: {
    color: '#FFFFFF',
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});

function MainTabs() {
  const [msgBadge, setMsgBadge] = useState(null);
  const [friendBadge, setFriendBadge] = useState(null);

  const refreshBadges = useCallback(async () => {
    if (!store.userId) return;

    const { count: reqCount } = await supabase
      .from('friendships')
      .select('*', { count: 'exact', head: true })
      .eq('receiver_id', store.userId)
      .eq('status', 'pending');
    setFriendBadge(reqCount || null);

    const { data: dms } = await supabase
      .from('direct_messages')
      .select('conversation_id, sender_id, created_at')
      .neq('sender_id', store.userId)
      .order('created_at', { ascending: false })
      .limit(100);

    const convIds = [...new Set(
      (dms || [])
        .filter(m => m.conversation_id.includes(store.userId))
        .map(m => m.conversation_id)
    )];

    let unreadChats = 0;

    for (const cid of convIds) {
      const lastRead = await getLastRead(`dm_${cid}`);
      const hasUnread = (dms || []).some(m =>
        m.conversation_id === cid &&
        (!lastRead || new Date(m.created_at) > new Date(lastRead))
      );
      if (hasUnread) unreadChats++;
    }

    const checkGroupChat = async (level, key, excludeField, excludeValue) => {
      const lastRead = await getLastRead(key);
      let query = supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('level', level)
        .neq(excludeField, excludeValue);
      if (lastRead) query = query.gt('created_at', lastRead);
      const { count } = await query;
      return (count || 0) > 0;
    };

    const globalUnread = await checkGroupChat('global', 'global', 'sender_id', store.userId);
    if (globalUnread) unreadChats++;

    const userLevel = store.level;
    if (userLevel) {
      const roomUnread = await checkGroupChat(userLevel, `room_${userLevel}`, 'sender_id', store.userId);
      if (roomUnread) unreadChats++;
    }

    setMsgBadge(unreadChats || null);
  }, []);

  useEffect(() => {
    refreshBadges();
    store.refreshBadges = refreshBadges;
    const interval = setInterval(refreshBadges, 30000);
    return () => clearInterval(interval);
  }, [refreshBadges]);

  return (
    <Tab.Navigator
      tabBar={props => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneContainerStyle: { backgroundColor: colors.background },
      }}
    >
      <Tab.Screen name="Home"     component={HomeScreen} />
      <Tab.Screen name="Feed"     component={FeedScreen} />
      <Tab.Screen name="Messages" component={MessagesScreen} options={{ tabBarBadge: msgBadge }} />
      <Tab.Screen name="AiChat"   component={AiChatScreen} />
      <Tab.Screen name="Friends"  component={FriendsScreen} options={{ tabBarBadge: friendBadge }} />
      <Tab.Screen name="Profile"  component={ProfileScreen} />
    </Tab.Navigator>
  );
}

const updatePresence = async () => {
  if (!store.userId) return;
  await supabase
    .from('users')
    .update({ last_seen: new Date().toISOString() })
    .eq('user_id', store.userId);
};

function navigateFromNotification(navigationRef, data) {
  if (!data?.screen || !navigationRef.current) return;
  const nav = navigationRef.current;
  switch (data.screen) {
    case 'Letter':
      nav.navigate('Letter');
      break;
    case 'Friends':
      nav.navigate('Friends');
      break;
    case 'Feed':
      nav.navigate('Main', { screen: 'Feed' });
      break;
    case 'Profile':
      nav.navigate('Main', { screen: 'Profile' });
      break;
    case 'Messages':
      nav.navigate('Main', { screen: 'Messages' });
      break;
    case 'Rooms':
      nav.navigate('Rooms', { level: store.level || 'green' });
      break;
    case 'Breathing':
      nav.navigate('Breathing');
      break;
    case 'Fishing':
      nav.navigate('Fishing');
      break;
    case 'Thoughts':
      nav.navigate('Thoughts');
      break;
    case 'DirectMessage':
      if (data.friendUserId && data.friendUsername) {
        nav.navigate('DirectMessage', {
          friend: { userId: data.friendUserId, username: data.friendUsername, level: data.friendLevel || 'green', avatarUrl: null },
        });
      }
      break;
    default:
      break;
  }
}

export default function App() {
  const [initialRoute, setInitialRoute] = useState(null);
  const [streakData, setStreakData] = useState(null);
  const presenceInterval = useRef(null);
  const navigationRef = useRef(null);
  const pendingNotificationData = useRef(null);

  useEffect(() => {
    const init = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (session?.user) {
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('username, level, email, avatar_url, status, login_streak, last_login_date, goal, is_admin, banned_until')
            .eq('user_id', session.user.id)
            .single();
          if (userError) throw userError;
          store.userId = session.user.id;
          if (userData) {
            store.username = userData.username;
            store.level = userData.level || 'green';
            store.email = userData.email || session.user.email;
            store.avatarUrl = userData.avatar_url || '';
            store.status = userData.status || '';
            store.goal = userData.goal || '';
            store.isAdmin = userData.is_admin || false;
          }

          // Проверка бана
          if (userData?.banned_until) {
            const until = new Date(userData.banned_until)
            if (until > new Date()) {
              await supabase.auth.signOut()
              store.userId = null
              setInitialRoute('Login')
              return
            }
          }

          // Стрик по дням входа
          const today = new Date().toISOString().split('T')[0];
          const lastDate = userData?.last_login_date;
          if (lastDate !== today) {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yStr = yesterday.toISOString().split('T')[0];
            const prevStreak = userData?.login_streak || 1;
            const newStreak = lastDate === yStr ? prevStreak + 1 : 1;
            await supabase.from('users').update({ login_streak: newStreak, last_login_date: today }).eq('user_id', session.user.id);
            if (newStreak > 1) setStreakData(newStreak);
          }

          setInitialRoute('Main');
          updatePresence();
          registerForPushNotifications().then(token => {
            if (token) supabase.from('users').update({ push_token: token }).eq('user_id', session.user.id);
          });
          scheduleQuestNotifications(userData?.level || 'green');
          scheduleReturnReminder(userData?.level || 'green');
          scheduleWeeklyReport(session.user.id);
          scheduleRoomDigestPush(userData?.level || 'green');
        } else {
          setInitialRoute('Login');
        }
      } catch (e) {
        console.warn('App init error:', e?.message);
        setInitialRoute('Login');
      }
    };
    init();
  }, []);

  useEffect(() => {
    const handleAppState = (nextState) => {
      if (nextState === 'active') updatePresence();
    };
    const sub = AppState.addEventListener('change', handleAppState);
    presenceInterval.current = setInterval(updatePresence, 2 * 60 * 1000);
    return () => {
      sub.remove();
      clearInterval(presenceInterval.current);
    };
  }, []);

  // Слушатель тапа по уведомлению (приложение в фоне или закрыто)
  useEffect(() => {
    // Приложение было закрыто — берём последний ответ
    Notifications.getLastNotificationResponseAsync().then(response => {
      const data = response?.notification?.request?.content?.data;
      if (data?.screen) pendingNotificationData.current = data;
    });

    const sub = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      if (!data?.screen) return;
      if (navigationRef.current) {
        navigateFromNotification(navigationRef, data);
      } else {
        pendingNotificationData.current = data;
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (initialRoute) SplashScreen.hideAsync();
  }, [initialRoute]);

  if (!initialRoute) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
        <NavigationContainer
          ref={navigationRef}
          onStateChange={createNavigationListener(navigationRef)}
          onReady={() => {
            if (pendingNotificationData.current) {
              navigateFromNotification(navigationRef, pendingNotificationData.current);
              pendingNotificationData.current = null;
            }
          }}
        >
          <Stack.Navigator
            initialRouteName={initialRoute}
            screenOptions={{ headerShown: false }}
          >
            <Stack.Screen name="Login"           component={LoginScreen} />
            <Stack.Screen name="Register"        component={RegisterScreen} />
            <Stack.Screen name="EmailConfirm"    component={EmailConfirmScreen} />
            <Stack.Screen name="Test"            component={TestScreen} />
            <Stack.Screen name="Recommendations"     component={RecommendationsScreen} />
            <Stack.Screen name="OnboardingMoment"    component={OnboardingMomentScreen} />
            <Stack.Screen name="OnboardingCarousel" component={OnboardingCarouselScreen} />
            <Stack.Screen name="Main"            component={MainTabs} options={{ gestureEnabled: false }} />
            <Stack.Screen name="DirectMessage"   component={DirectMessageScreen} />
            <Stack.Screen name="UserProfile"     component={UserProfileScreen} />
            <Stack.Screen name="Rooms"           component={RoomsScreen} />
            <Stack.Screen name="Chat"            component={ChatScreen} />
            <Stack.Screen name="Breathing"        component={BreathingScreen} />
            <Stack.Screen name="Fishing"         component={FishingScreen} />
            <Stack.Screen name="Post"            component={PostScreen} />
            <Stack.Screen name="Thoughts"        component={ThoughtsScreen} />
            <Stack.Screen name="Resources"       component={ResourcesScreen} />
            <Stack.Screen name="Letter"          component={LetterScreen} />
            <Stack.Screen name="Support"         component={SupportScreen} />
            <Stack.Screen name="Notifications"   component={NotificationsScreen} />
            <Stack.Screen name="Friends"       component={FriendsScreen} options={{ headerShown: false }} />
            <Stack.Screen name="PsychTest"        component={PsychTestScreen} options={{ headerShown: false }} />
            <Stack.Screen name="AccountSettings"  component={AccountSettingsScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Analytics"        component={AnalyticsScreen}       options={{ headerShown: false }} />
            <Stack.Screen name="Admin"            component={AdminScreen}           options={{ headerShown: false }} />
            <Stack.Screen name="AdminUserProfile" component={AdminUserProfileScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Achievements"     component={AchievementsScreen}     options={{ headerShown: false }} />
            <Stack.Screen name="AnalyticsPreview"   component={AnalyticsPreviewScreen}   options={{ headerShown: false }} />
            <Stack.Screen name="DimensionHistory"   component={DimensionHistoryScreen}   options={{ headerShown: false }} />
          </Stack.Navigator>
        </NavigationContainer>
        <StreakModal streak={streakData} visible={!!streakData} onClose={() => setStreakData(null)} />
        </SafeAreaView>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
