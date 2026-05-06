import React from 'react';
import { LinkingOptions } from '@react-navigation/native';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import AuthScreen from './src/screens/AuthScreen';
import VerifyEmailScreen from './src/screens/VerifyEmailScreen';
import HomeScreen from './src/screens/HomeScreen';
import ExploreScreen from './src/screens/ExploreScreen';
import PodsScreen from './src/screens/PodsScreen';
import ClubsScreen from './src/screens/ClubsScreen';
import ClubMeetingsTonightScreen from './src/screens/ClubMeetingsTonightScreen';
import InboxScreen from './src/screens/InboxScreen';
import ActivityPodsScreen from './src/screens/ActivityPodsScreen';
import PodDetailScreen from './src/screens/PodDetailScreen';
import ClubDetailScreen from './src/screens/ClubDetailScreen';
import ThreadScreen from './src/screens/ThreadScreen';
import EditProfileScreen from './src/screens/EditProfileScreen';
import UserProfileScreen from './src/screens/UserProfileScreen';
import UserSearchScreen from './src/screens/UserSearchScreen';
import { Activity } from './src/types';
import { palette } from './src/theme';

export type MainTabParamList = {
  Home: undefined;
  Explore: undefined;
  Pods: undefined;
  Clubs: undefined;
  Inbox: undefined;
};

export type RootStackParamList = {
  MainTabs: { screen?: keyof MainTabParamList } | undefined;
  ActivityPods: { activity: Activity };
  PodDetail: { podId: string };
  ClubDetail: { clubId: string };
  ClubMeetingsTonight: undefined;
  Thread: { threadId: string; title: string };
  EditProfile: undefined;
  UserProfile: { userId: string };
  UserSearch: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: 'transparent',
    card: palette.paper,
    text: palette.ink,
    border: 'transparent',
    primary: palette.scarlet,
  },
};

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['bridge://', 'https://joinbridgeapp.com', 'https://bridge.app'],
  config: {
    screens: {
      PodDetail: 'pod/:podId',
      ClubDetail: 'clubs/:clubId',
      UserProfile: 'users/:userId',
    },
  },
};

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: palette.scarlet,
        tabBarInactiveTintColor: '#6F818C',
        tabBarLabelStyle: styles.tabLabel,
        tabBarIcon: ({ color, size, focused }) => (
          <Ionicons
            name={tabIcon(route.name, focused)}
            size={size}
            color={color}
          />
        ),
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Explore" component={ExploreScreen} />
      <Tab.Screen name="Pods" component={PodsScreen} />
      <Tab.Screen name="Clubs" component={ClubsScreen} />
      <Tab.Screen name="Inbox" component={InboxScreen} />
    </Tab.Navigator>
  );
}

function AuthedApp() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen name="ActivityPods" component={ActivityPodsScreen} />
      <Stack.Screen name="PodDetail" component={PodDetailScreen} />
      <Stack.Screen name="ClubDetail" component={ClubDetailScreen} />
      <Stack.Screen name="ClubMeetingsTonight" component={ClubMeetingsTonightScreen} />
      <Stack.Screen name="Thread" component={ThreadScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen} />
      <Stack.Screen name="UserSearch" component={UserSearchScreen} />
    </Stack.Navigator>
  );
}

function AppGate() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={palette.scarlet} />
        <Text style={styles.loadingText}>Loading Bridge</Text>
      </View>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  if (!user.verifiedUniversity) {
    return <VerifyEmailScreen />;
  }

  return <AuthedApp />;
}

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer theme={navTheme} linking={linking}>
        <StatusBar style="dark" />
        <AppGate />
      </NavigationContainer>
    </AuthProvider>
  );
}

function tabIcon(routeName: keyof MainTabParamList, focused: boolean): keyof typeof Ionicons.glyphMap {
  switch (routeName) {
    case 'Home':
      return focused ? 'home' : 'home-outline';
    case 'Explore':
      return focused ? 'compass' : 'compass-outline';
    case 'Pods':
      return focused ? 'flash' : 'flash-outline';
    case 'Clubs':
      return focused ? 'people' : 'people-outline';
    case 'Inbox':
      return focused ? 'mail' : 'mail-outline';
  }
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: 'rgba(251, 249, 244, 0.96)',
    borderTopWidth: 0,
    height: Platform.select({ ios: 86, default: 68 }),
    paddingTop: 8,
    paddingBottom: Platform.select({ ios: 20, default: 10 }),
    elevation: 0,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.paper,
    gap: 12,
  },
  loadingText: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: '700',
  },
});
