import React from 'react';
import { ActivityIndicator, View, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { enableScreens } from 'react-native-screens';
import { Ionicons } from '@expo/vector-icons';

enableScreens();

import { AuthProvider, useAuth } from './src/context/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import ActivityListScreen from './src/screens/ActivityListScreen';
import MyActivitiesScreen from './src/screens/MyActivitiesScreen';
import SearchScreen from './src/screens/SearchScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import PodListScreen from './src/screens/PodListScreen';
import CreatePodScreen from './src/screens/CreatePodScreen';
import PodScreen from './src/screens/PodScreen';
import UserProfileScreen from './src/screens/UserProfileScreen';
import MyReportsScreen from './src/screens/MyReportsScreen';
import { colors } from './src/theme';

export type MainTabParamList = {
  Explore: undefined;
  MyActivities: undefined;
  Search: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  MainTabs: undefined;
  PodList: { activityId: string; activityTitle: string; activityCategory?: string };
  CreatePod: { activityId: string; activityTitle: string; activityCategory: string };
  Pod: { podId: string };
  UserProfile: { userId: string; name: string };
  MyReports: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

const TAB_ICONS: Record<keyof MainTabParamList, { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }> = {
  Explore: { active: 'compass', inactive: 'compass-outline' },
  MyActivities: { active: 'calendar', inactive: 'calendar-outline' },
  Search: { active: 'search', inactive: 'search-outline' },
  Profile: { active: 'person', inactive: 'person-outline' },
};

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          const icons = TAB_ICONS[route.name];
          return <Ionicons name={focused ? icons.active : icons.inactive} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 0.5,
          paddingTop: 4,
          ...Platform.select({
            ios: {
              shadowColor: '#0f172a',
              shadowOpacity: 0.06,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: -2 },
            },
            android: { elevation: 8 },
          }),
        },
      })}
    >
      <Tab.Screen
        name="Explore"
        component={ActivityListScreen}
        options={{ tabBarLabel: 'Explore' }}
      />
      <Tab.Screen
        name="MyActivities"
        component={MyActivitiesScreen}
        options={{ tabBarLabel: 'My Activities' }}
      />
      <Tab.Screen
        name="Search"
        component={SearchScreen}
        options={{ tabBarLabel: 'Search' }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarLabel: 'Profile' }}
      />
    </Tab.Navigator>
  );
}

function AppNavigator() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.primary,
          headerTitleStyle: { fontWeight: '700', color: colors.text },
          headerShadowVisible: false,
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: colors.bg },
          animation: 'slide_from_right',
        }}
      >
        {user ? (
          <>
            <Stack.Screen
              name="MainTabs"
              component={MainTabs}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="PodList"
              component={PodListScreen}
              options={({ route }) => ({
                title: route.params.activityTitle,
                headerLargeTitle: false,
              })}
            />
            <Stack.Screen
              name="CreatePod"
              component={CreatePodScreen}
              options={{ title: 'Create Pod' }}
            />
            <Stack.Screen
              name="Pod"
              component={PodScreen}
              options={{
                title: 'Your Pod',
                headerBlurEffect: 'light',
              }}
            />
            <Stack.Screen
              name="UserProfile"
              component={UserProfileScreen}
              options={{ title: 'Profile' }}
            />
            <Stack.Screen
              name="MyReports"
              component={MyReportsScreen}
              options={{ title: 'My Reports' }}
            />
          </>
        ) : (
          <>
            <Stack.Screen
              name="Login"
              component={LoginScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Register"
              component={RegisterScreen}
              options={{ headerShown: false }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppNavigator />
    </AuthProvider>
  );
}
