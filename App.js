import { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { supabase } from './supabase';
import { store } from './store';
import { colors } from './theme';
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import TestScreen from './screens/TestScreen';
import HomeScreen from './screens/HomeScreen';
import ChatScreen from './screens/ChatScreen';
import RelaxScreen from './screens/RelaxScreen';
import ProfileScreen from './screens/ProfileScreen';
import FriendsScreen from './screens/FriendsScreen';
import DirectMessageScreen from './screens/DirectMessageScreen';
import UserProfileScreen from './screens/UserProfileScreen';

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
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: '🏠 Главная' }} />
      <Tab.Screen name="Chat" component={ChatScreen} options={{ tabBarLabel: '💬 Чат' }} />
      <Tab.Screen name="Relax" component={RelaxScreen} options={{ tabBarLabel: '🎧 Релакс' }} />
      <Tab.Screen name="Friends" component={FriendsScreen} options={{ tabBarLabel: '🔍 Свои' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarLabel: '👤 Я' }} />
    </Tab.Navigator>
  );
}

export default function App() {
  const [initialRoute, setInitialRoute] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const { data: userData } = await supabase
          .from('users')
          .select('username, level, email, avatar_url, status')
          .eq('user_id', session.user.id)
          .single();
        store.userId = session.user.id;
        if (userData) {
          store.username = userData.username;
          store.level = userData.level || 'green';
          store.email = userData.email || session.user.email;
          store.avatarUrl = userData.avatar_url || '';
          store.status = userData.status || '';
        }
        setInitialRoute('Main');
      } else {
        setInitialRoute('Login');
      }
    });
  }, []);

  if (!initialRoute) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName={initialRoute}
          screenOptions={{ headerShown: false }}
        >
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
          <Stack.Screen name="Test" component={TestScreen} />
          <Stack.Screen
            name="Main"
            component={MainTabs}
            options={{ gestureEnabled: false }}
          />
          <Stack.Screen name="DirectMessage" component={DirectMessageScreen} />
          <Stack.Screen name="UserProfile" component={UserProfileScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
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
