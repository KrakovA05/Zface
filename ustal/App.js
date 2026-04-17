import { useEffect, useState, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet, AppState } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { supabase } from './supabase';
import { store } from './store';
import { colors } from './theme';

import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import TestScreen from './screens/TestScreen';
import RecommendationsScreen from './screens/RecommendationsScreen';
import HomeScreen from './screens/HomeScreen';
import MessagesScreen from './screens/MessagesScreen';
import ChatScreen from './screens/ChatScreen';
import RelaxScreen from './screens/RelaxScreen';
import ProfileScreen from './screens/ProfileScreen';
import FriendsScreen from './screens/FriendsScreen';
import DirectMessageScreen from './screens/DirectMessageScreen';
import UserProfileScreen from './screens/UserProfileScreen';
import FeedScreen from './screens/FeedScreen';
import RoomsScreen from './screens/RoomsScreen';
import FishingScreen from './screens/FishingScreen';
import BarScreen from './screens/BarScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
      }}
    >
      <Tab.Screen name="Home"     component={HomeScreen}     options={{ tabBarLabel: '🏠 Главная' }} />
      <Tab.Screen name="Feed"     component={FeedScreen}     options={{ tabBarLabel: '📰 Лента' }} />
      <Tab.Screen name="Messages" component={MessagesScreen} options={{ tabBarLabel: '💬 Сообщения' }} />
      <Tab.Screen name="Friends"  component={FriendsScreen}  options={{ tabBarLabel: '🔍 Свои' }} />
      <Tab.Screen name="Profile"  component={ProfileScreen}  options={{ tabBarLabel: '👤 Я' }} />
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

export default function App() {
  const [initialRoute, setInitialRoute] = useState(null);
  const presenceInterval = useRef(null);

  useEffect(() => {
    const init = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (session?.user) {
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('username, level, email, avatar_url, status')
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
          }
          setInitialRoute('Main');
          // Первичное обновление присутствия
          updatePresence();
        } else {
          setInitialRoute('Login');
        }
      } catch {
        setInitialRoute('Login');
      }
    };
    init();
  }, []);

  // Трекинг присутствия: обновляем last_seen при активации и каждые 2 минуты
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

  if (!initialRoute) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer>
          <Stack.Navigator
            initialRouteName={initialRoute}
            screenOptions={{ headerShown: false }}
          >
            <Stack.Screen name="Login"           component={LoginScreen} />
            <Stack.Screen name="Register"        component={RegisterScreen} />
            <Stack.Screen name="Test"            component={TestScreen} />
            <Stack.Screen name="Recommendations" component={RecommendationsScreen} />
            <Stack.Screen name="Main"            component={MainTabs} options={{ gestureEnabled: false }} />
            <Stack.Screen name="DirectMessage"   component={DirectMessageScreen} />
            <Stack.Screen name="UserProfile"     component={UserProfileScreen} />
            <Stack.Screen name="Rooms"           component={RoomsScreen} />
            <Stack.Screen name="Chat"            component={ChatScreen} />
            <Stack.Screen name="Relax"           component={RelaxScreen} />
            <Stack.Screen name="Fishing"         component={FishingScreen} />
            <Stack.Screen name="Bar"             component={BarScreen} />
          </Stack.Navigator>
        </NavigationContainer>
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
