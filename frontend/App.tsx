import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View, Platform, Linking } from 'react-native';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { enableScreens } from 'react-native-screens';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';

// Show notifications as banners when the app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

enableScreens();

import { AuthProvider, useAuth } from './src/context/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import ActivityListScreen from './src/screens/ActivityListScreen';
import TodayScreen from './src/screens/TodayScreen';
import MyActivitiesScreen from './src/screens/MyActivitiesScreen';
import SearchScreen from './src/screens/SearchScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import PodListScreen from './src/screens/PodListScreen';
import CreatePodScreen from './src/screens/CreatePodScreen';
import PodScreen from './src/screens/PodScreen';
import UserProfileScreen from './src/screens/UserProfileScreen';
import MyReportsScreen from './src/screens/MyReportsScreen';
import FindAGroupScreen from './src/screens/FindAGroupScreen';
import VerifyEmailScreen from './src/screens/VerifyEmailScreen';
import FriendsScreen from './src/screens/FriendsScreen';
import FriendRequestsScreen from './src/screens/FriendRequestsScreen';
import UserSearchScreen from './src/screens/UserSearchScreen';
import MessagesInboxScreen from './src/screens/MessagesInboxScreen';
import DirectMessageThreadScreen from './src/screens/DirectMessageThreadScreen';
import PodInvitesScreen from './src/screens/PodInvitesScreen';
import EditProfileScreen from './src/screens/EditProfileScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import PeopleYouMetScreen from './src/screens/PeopleYouMetScreen';
import { colors } from './src/theme';
import { ErrorBoundary } from './src/components/ErrorBoundary';

export type MainTabParamList = {
  Today: undefined;
  MyActivities: undefined;
  Search: undefined;
  Messages: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  VerifyEmail: undefined;
  MainTabs: undefined;
  PodList: { activityId: string; activityTitle: string; activityCategory?: string };
  CreatePod: { activityId: string; activityTitle: string; activityCategory: string };
  Pod: { podId: string };
  UserProfile: { userId: string; name: string };
  MyReports: undefined;
  FindAGroup: undefined;
  Friends: undefined;
  FriendRequests: undefined;
  UserSearch: undefined;
  DirectMessageThread: { threadId: string; otherUserId: string; otherUserName: string };
  PodInvites: undefined;
  EditProfile: undefined;
  Settings: undefined;
  PeopleYouMet: { podId: string };
};

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

// Supported URL prefixes for deep links
const LINKING_PREFIXES = ['bridge://', 'https://bridge.app'];

// Extracts a podId from any supported invite URL, returns null if not a pod link
function extractPodId(url: string): string | null {
  // Matches bridge://pod/ID or https://bridge.app/pod/ID
  const match = url.match(/(?:bridge:\/\/|https:\/\/bridge\.app)\/pod\/([^/?#]+)/);
  return match ? match[1] : null;
}

const linking = {
  prefixes: LINKING_PREFIXES,
  config: {
    screens: {
      Pod: 'pod/:podId',
    },
  },
};

const TAB_ICONS: Record<keyof MainTabParamList, { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }> = {
  Today: { active: 'flash', inactive: 'flash-outline' },
  MyActivities: { active: 'calendar', inactive: 'calendar-outline' },
  Search: { active: 'search', inactive: 'search-outline' },
  Messages: { active: 'chatbubble', inactive: 'chatbubble-outline' },
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
        animation: 'fade',
      })}
    >
      <Tab.Screen
        name="Today"
        component={TodayScreen}
        options={{ tabBarLabel: 'Today' }}
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
        name="Messages"
        component={MessagesInboxScreen}
        options={{ tabBarLabel: 'Messages' }}
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
  const navigationRef = useNavigationContainerRef<RootStackParamList>();
  const [pendingPodId, setPendingPodId] = useState<string | null>(null);
  // Track whether the navigator is ready to accept programmatic navigation
  const isNavigatorReady = useRef(false);

  // On mount: check if the app was cold-started from an invite link or notification
  useEffect(() => {
    Linking.getInitialURL().then((url) => {
      if (url) {
        const podId = extractPodId(url);
        if (podId) setPendingPodId(podId);
      }
    });

    // Check if app was opened by tapping a push notification (cold start)
    Notifications.getLastNotificationResponseAsync().then((response) => {
      const podId = response?.notification.request.content.data?.podId as string | undefined;
      if (podId) setPendingPodId(podId);
    });

    // Handle links received while the app is already open
    const linkSub = Linking.addEventListener('url', ({ url }) => {
      const podId = extractPodId(url);
      if (!podId) return;
      if (isNavigatorReady.current && navigationRef.isReady()) {
        navigationRef.navigate('Pod', { podId });
      } else {
        // Not logged in yet — store and navigate after login
        setPendingPodId(podId);
      }
    });

    // Handle notification taps while the app is open or in the background
    const notifSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const podId = response.notification.request.content.data?.podId as string | undefined;
      if (!podId) return;
      if (isNavigatorReady.current && navigationRef.isReady()) {
        navigationRef.navigate('Pod', { podId });
      } else {
        setPendingPodId(podId);
      }
    });

    return () => {
      linkSub.remove();
      notifSub.remove();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Once the user logs in and a pending pod link is waiting, navigate to it
  useEffect(() => {
    if (user && pendingPodId && isNavigatorReady.current && navigationRef.isReady()) {
      navigationRef.navigate('Pod', { podId: pendingPodId });
      setPendingPodId(null);
    }
  }, [user, pendingPodId, navigationRef]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      linking={linking}
      onReady={() => {
        isNavigatorReady.current = true;
        // If there's a pending pod link and the user is already logged in, navigate now
        if (user && pendingPodId) {
          navigationRef.navigate('Pod', { podId: pendingPodId });
          setPendingPodId(null);
        }
      }}
    >
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.primary,
          headerTitleStyle: { fontWeight: '700', color: colors.text },
          headerShadowVisible: false,
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: colors.bg },
          animation: 'slide_from_right',
          animationDuration: 250,
        }}
      >
        {user && !user.verifiedUniversity ? (
          <>
            <Stack.Screen
              name="VerifyEmail"
              component={VerifyEmailScreen}
              options={{ headerShown: false }}
            />
          </>
        ) : user ? (
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
                title: 'Pod',
                headerShown: false,
                animation: 'fade_from_bottom',
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
            <Stack.Screen
              name="FindAGroup"
              component={FindAGroupScreen}
              options={{ title: 'Find a Group' }}
            />
            <Stack.Screen
              name="Friends"
              component={FriendsScreen}
              options={{ title: 'Friends' }}
            />
            <Stack.Screen
              name="FriendRequests"
              component={FriendRequestsScreen}
              options={{ title: 'Friend Requests' }}
            />
            <Stack.Screen
              name="UserSearch"
              component={UserSearchScreen}
              options={{ title: 'Find People' }}
            />
            <Stack.Screen
              name="DirectMessageThread"
              component={DirectMessageThreadScreen}
              options={({ route }) => ({ title: route.params.otherUserName })}
            />
            <Stack.Screen
              name="PodInvites"
              component={PodInvitesScreen}
              options={{ title: 'Pod Invites' }}
            />
            <Stack.Screen
              name="EditProfile"
              component={EditProfileScreen}
              options={{ title: 'Edit Profile' }}
            />
            <Stack.Screen
              name="Settings"
              component={SettingsScreen}
              options={{ title: 'Settings' }}
            />
            <Stack.Screen
              name="PeopleYouMet"
              component={PeopleYouMetScreen}
              options={{ title: 'People You Met' }}
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
    <ErrorBoundary>
      <AuthProvider>
        <AppNavigator />
      </AuthProvider>
    </ErrorBoundary>
  );
}
