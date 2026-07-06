import React from 'react';
import { LinkingOptions } from '@react-navigation/native';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import {
  BottomTabBarProps,
  createBottomTabNavigator,
} from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import AuthScreen from './src/screens/AuthScreen';
import VerifyEmailScreen from './src/screens/VerifyEmailScreen';
import HomeScreen from './src/screens/HomeScreen';
import FirstPlanScreen from './src/screens/FirstPlanScreen';
import ExploreScreen from './src/screens/ExploreScreen';
import ClubsHomeScreen from './src/screens/clubs/ClubsHomeScreen';
import PodsScreen from './src/screens/PodsScreen';
import ClubMeetingsTonightScreen from './src/screens/clubs/ClubMeetingsTonightScreen';
import InboxScreen from './src/screens/InboxScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import ActivityPodsScreen from './src/screens/ActivityPodsScreen';
import AdminActivityRequestsScreen from './src/screens/AdminActivityRequestsScreen';
import PodDetailScreen from './src/screens/PodDetailScreen';
import PodChatScreen from './src/screens/PodChatScreen';
import ClubHomeScreen from './src/screens/clubs/ClubHomeScreen';
import ClubChatScreen from './src/screens/clubs/ClubChatScreen';
import ClubEventsScreen from './src/screens/clubs/ClubEventsScreen';
import MeetingDetailScreen from './src/screens/clubs/MeetingDetailScreen';
import ClubMembersScreen from './src/screens/clubs/ClubMembersScreen';
import ClubManageScreen from './src/screens/clubs/ClubManageScreen';
import CreateClubScreen from './src/screens/clubs/CreateClubScreen';
import ClubApplyScreen from './src/screens/clubs/ClubApplyScreen';
import ClubApplicationsScreen from './src/screens/clubs/ClubApplicationsScreen';
import ErrorBoundary from './src/components/ErrorBoundary';
import { initMonitoring, wrapApp } from './src/lib/monitoring';

initMonitoring();
import ThreadScreen from './src/screens/ThreadScreen';
import EditProfileScreen from './src/screens/EditProfileScreen';
import UserProfileScreen from './src/screens/UserProfileScreen';
import UserSearchScreen from './src/screens/UserSearchScreen';
import BlockedUsersScreen from './src/screens/BlockedUsersScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import PrivacyDataScreen from './src/screens/PrivacyDataScreen';
import DeleteAccountScreen from './src/screens/DeleteAccountScreen';
import TermsAcceptanceScreen from './src/screens/TermsAcceptanceScreen';
import { Activity } from './src/types';
import { getInboxSummary } from './src/api';
import { BORDER_W, ThemeProvider, elevation, fonts, motion, radii, useTheme } from './src/theme';
import { AppBackdrop, CountBubble, SkeletonBlock, SkeletonCard } from './src/components/ui';
import { CURRENT_TERMS_VERSION } from './src/constants/legal';
import { REALTIME_INBOX_EVENTS, useRealtimeChannel } from './src/hooks/useRealtimeChannel';
import { captureReferralFromUrl } from './src/lib/referrals';

SplashScreen.preventAutoHideAsync().catch(() => {});
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}
if (Platform.OS === 'android') {
  // Expo pushes land on the 'default' channel; without registering it with
  // high importance, Android shows no heads-up banner (silent tray only).
  void Notifications.setNotificationChannelAsync('default', {
    name: 'Default',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
  }).catch(() => {});
}

export type MainTabParamList = {
  Home: undefined;
  // startCreate is a nonce (Date.now()) rather than a boolean so repeated
  // "[+] → Start a pod" taps re-trigger the template picker; a boolean param
  // never changes value on the persistent tab screen after the first tap.
  Explore: { startCreate?: number } | undefined;
  Pods: undefined;
  Clubs: undefined;
  Inbox: undefined;
};

type MainTabsParams =
  | undefined
  | {
      [Screen in keyof MainTabParamList]: {
        screen: Screen;
        params?: MainTabParamList[Screen];
      };
    }[keyof MainTabParamList];

export type RootStackParamList = {
  MainTabs: MainTabsParams;
  FirstPlan: undefined;
  ActivityPods: { activity: Activity; startCreate?: boolean };
  AdminActivityRequests: undefined;
  PodDetail: { podId: string; justCreated?: boolean };
  PodChat: { podId: string };
  ClubDetail: { clubId: string; justCreated?: boolean };
  ClubChat: { clubId: string; channelId: string };
  ClubEvents: { clubId: string; startCreate?: boolean };
  ClubMeeting: { clubId: string; meetingId: string };
  ClubMembers: { clubId: string };
  ClubManage: { clubId: string };
  ClubMeetingsTonight: undefined;
  CreateClub: undefined;
  ClubApply: { clubId: string };
  ClubApplications: { clubId: string };
  Thread: { threadId: string; title?: string };
  Profile: undefined;
  EditProfile: undefined;
  UserProfile: { userId: string };
  UserSearch: undefined;
  BlockedUsers: undefined;
  Settings: undefined;
  PrivacyData: undefined;
  DeleteAccount: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

// Dedupe notification taps: getInitialURL and the response listener can both
// see the same response on a cold start, and getLastNotificationResponseAsync
// can replay an old response after an OTA reload.
let lastHandledNotificationId: string | null = null;

function urlFromNotificationResponse(
  response: Notifications.NotificationResponse | null,
): string | null {
  if (!response) return null;
  const id = response.notification.request.identifier;
  if (id && lastHandledNotificationId === id) return null;
  if (id) lastHandledNotificationId = id;
  const url = response.notification.request.content.data?.url;
  return typeof url === 'string' && url.length > 0 ? url : null;
}

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['oval://', 'https://www.theovalapp.com', 'https://theovalapp.com'],
  config: {
    // Cold-start deep links (push tap / share link with the app killed) must
    // put MainTabs UNDER the linked screen — otherwise PodDetail becomes the
    // only route: no tab bar, dead back button.
    initialRouteName: 'MainTabs',
    screens: {
      MainTabs: {
        screens: {
          Home: 'home',
          Explore: 'explore',
          Pods: 'pods',
          Clubs: 'clubs-home',
          Inbox: 'inbox',
        },
      },
      PodDetail: 'pod/:podId',
      ClubDetail: 'clubs/:clubId',
      ClubChat: 'clubs/:clubId/chat/:channelId',
      ClubEvents: 'clubs/:clubId/events',
      ClubMeeting: 'clubs/:clubId/events/:meetingId',
      ClubMembers: 'clubs/:clubId/members',
      ClubManage: 'clubs/:clubId/manage',
      Thread: 'thread/:threadId',
      UserProfile: 'users/:userId',
    },
  },
  // Notification taps feed the SAME linking pipeline as real URLs — this is
  // the React Navigation + expo-notifications recipe. The previous approach
  // (Linking.openURL from a response listener) round-trips through the OS and
  // silently no-ops in several states, which shipped as "tapping a push just
  // opens the app".
  async getInitialURL() {
    const url = await Linking.getInitialURL();
    if (url) {
      void captureReferralFromUrl(url);
      return url;
    }
    if (Platform.OS !== 'web') {
      const response = await Notifications.getLastNotificationResponseAsync();
      const notificationUrl = urlFromNotificationResponse(response);
      if (notificationUrl) return notificationUrl;
    }
    return null;
  },
  subscribe(listener) {
    const urlSubscription = Linking.addEventListener('url', ({ url }) => {
      void captureReferralFromUrl(url);
      listener(url);
    });
    const notificationSubscription =
      Platform.OS !== 'web'
        ? Notifications.addNotificationResponseReceivedListener((response) => {
            const url = urlFromNotificationResponse(response);
            if (url) listener(url);
          })
        : null;
    return () => {
      urlSubscription.remove();
      notificationSubscription?.remove();
    };
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// The Dock — full-width slab bar with a tilted scarlet sticker on the
// active tab. Icons ride a spring; the sticker pops.
// ─────────────────────────────────────────────────────────────────────────────

function tabIcon(
  routeName: keyof MainTabParamList,
  focused: boolean,
): keyof typeof Ionicons.glyphMap {
  switch (routeName) {
    case 'Home':
      return focused ? 'planet' : 'planet-outline';
    case 'Explore':
      return focused ? 'telescope' : 'telescope-outline';
    case 'Pods':
      return focused ? 'flash' : 'flash-outline';
    case 'Clubs':
      return focused ? 'megaphone' : 'megaphone-outline';
    case 'Inbox':
      return focused ? 'chatbox-ellipses' : 'chatbox-ellipses-outline';
  }
}

function TabItem({
  routeName,
  label,
  focused,
  onPress,
  onLongPress,
  badge,
}: {
  routeName: keyof MainTabParamList;
  label: string;
  focused: boolean;
  onPress: () => void;
  onLongPress: () => void;
  badge?: number | string;
}) {
  const { colors, isDark } = useTheme();
  const pop = useSharedValue(focused ? 1 : 0);
  const activeTint = isDark ? colors.accentText : colors.primary;

  React.useEffect(() => {
    pop.value = withSpring(focused ? 1 : 0, motion.springBouncy);
  }, [focused, pop]);

  const stickerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.92 + pop.value * 0.08 }],
  }));

  return (
    <Pressable
      onPress={() => {
        try { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)?.catch?.(() => {}); } catch {}
        onPress();
      }}
      onLongPress={onLongPress}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: focused }}
      style={styles.tabSlot}
    >
      <Animated.View
        style={[
          styles.tabSticker,
          focused && { backgroundColor: colors.primarySoft },
          stickerStyle,
        ]}
      >
        <Ionicons
          name={tabIcon(routeName, focused)}
          size={22}
          color={focused ? activeTint : colors.sub}
        />
        {typeof badge === 'number' ? (
          <CountBubble count={badge} style={styles.tabBadge} />
        ) : null}
      </Animated.View>
      <Text
        style={[
          styles.tabLabel,
          { color: focused ? activeTint : colors.sub },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function OvalDock({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const renderRoute = (route: BottomTabBarProps['state']['routes'][number], index: number) => {
    const { options } = descriptors[route.key];
    const label =
      typeof options.tabBarLabel === 'string'
        ? options.tabBarLabel
        : options.title ?? route.name;
    const focused = state.index === index;

    return (
      <TabItem
        key={route.key}
        routeName={route.name as keyof MainTabParamList}
        label={label}
        focused={focused}
        onPress={() => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        }}
        onLongPress={() =>
          navigation.emit({ type: 'tabLongPress', target: route.key })
        }
        badge={options.tabBarBadge}
      />
    );
  };

  return (
    <View
      pointerEvents="box-none"
      style={[styles.dockWrap, { paddingBottom: Math.max(insets.bottom, 12) }]}
    >
      <View style={[styles.dock, { ...elevation.floating, shadowColor: colors.shadow }]}>
        <BlurView
          tint={isDark ? 'dark' : 'light'}
          intensity={30}
          style={StyleSheet.absoluteFill}
        />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.tabBar }]} />
        <View style={[StyleSheet.absoluteFill, styles.dockBorder, { borderColor: colors.border }]} />
        {state.routes.map(renderRoute)}
      </View>
    </View>
  );
}

const INBOX_BADGE_POLL_MS = 60 * 1000;

/**
 * Keeps the Inbox tab badge fresh app-wide instead of only updating when the
 * Inbox tab itself loads.
 */
function useInboxBadgeCount(): number | undefined {
  const { token, user } = useAuth();
  const [count, setCount] = React.useState(0);

  const refresh = React.useCallback(async () => {
    if (!token || !user?.verifiedUniversity) {
      setCount(0);
      return;
    }
    try {
      const summary = await getInboxSummary();
      setCount(summary.total);
    } catch {
      // Keep the previous badge on transient errors.
    }
  }, [token, user?.verifiedUniversity]);

  useRealtimeChannel(
    token && user?.verifiedUniversity ? `user-${user.id}` : null,
    REALTIME_INBOX_EVENTS,
    () => {
      void refresh();
    },
  );

  React.useEffect(() => {
    if (!token || !user?.verifiedUniversity) {
      setCount(0);
      return;
    }
    let active = true;

    const guardedRefresh = async () => {
      await refresh();
      if (!active) return;
    };

    void guardedRefresh();
    const interval = setInterval(() => void guardedRefresh(), INBOX_BADGE_POLL_MS);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [refresh, token, user?.verifiedUniversity]);

  return count || undefined;
}

function MainTabs() {
  const inboxBadge = useInboxBadgeCount();
  return (
    <Tab.Navigator
      tabBar={(props) => <OvalDock {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Explore">
        {({ route }) => <ExploreScreen startCreate={route.params?.startCreate} />}
      </Tab.Screen>
      <Tab.Screen name="Pods" component={PodsScreen} />
      <Tab.Screen name="Clubs" component={ClubsHomeScreen} />
      <Tab.Screen name="Inbox" component={InboxScreen} options={{ tabBarBadge: inboxBadge }} />
    </Tab.Navigator>
  );
}

const FIRST_RUN_DONE_KEY = 'oval.firstrun.done';

function AuthedApp({
  showFirstPlan,
  onFirstPlanDone,
}: {
  showFirstPlan: boolean;
  onFirstPlanDone: () => void;
}) {
  return (
    <Stack.Navigator
      initialRouteName={showFirstPlan ? 'FirstPlan' : 'MainTabs'}
      screenOptions={{
        headerShown: false,
        animation: Platform.OS === 'ios' ? 'default' : 'slide_from_right',
        animationDuration: 280,
      }}
    >
      <Stack.Screen name="FirstPlan">
        {(props) => <FirstPlanScreen {...props} onDone={onFirstPlanDone} />}
      </Stack.Screen>
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen name="ActivityPods" component={ActivityPodsScreen} />
      <Stack.Screen name="AdminActivityRequests" component={AdminActivityRequestsScreen} />
      <Stack.Screen name="PodDetail" component={PodDetailScreen} />
      <Stack.Screen name="PodChat" component={PodChatScreen} />
      <Stack.Screen name="ClubDetail" component={ClubHomeScreen} />
      <Stack.Screen name="ClubChat" component={ClubChatScreen} />
      <Stack.Screen name="ClubEvents" component={ClubEventsScreen} />
      <Stack.Screen name="ClubMeeting" component={MeetingDetailScreen} />
      <Stack.Screen name="ClubMembers" component={ClubMembersScreen} />
      <Stack.Screen name="ClubManage" component={ClubManageScreen} />
      <Stack.Screen name="ClubMeetingsTonight" component={ClubMeetingsTonightScreen} />
      <Stack.Screen name="CreateClub" component={CreateClubScreen} />
      <Stack.Screen name="ClubApply" component={ClubApplyScreen} />
      <Stack.Screen name="ClubApplications" component={ClubApplicationsScreen} />
      <Stack.Screen name="Thread" component={ThreadScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen} />
      <Stack.Screen name="UserSearch" component={UserSearchScreen} />
      <Stack.Screen name="BlockedUsers" component={BlockedUsersScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="PrivacyData" component={PrivacyDataScreen} />
      <Stack.Screen name="DeleteAccount" component={DeleteAccountScreen} />
    </Stack.Navigator>
  );
}

function AppGate() {
  const { user, isLoading } = useAuth();
  const [firstRunReady, setFirstRunReady] = React.useState(false);
  const [showFirstPlan, setShowFirstPlan] = React.useState(false);

  const termsReady =
    Boolean(user?.verifiedUniversity) &&
    user?.termsVersion === CURRENT_TERMS_VERSION &&
    Boolean(user?.ageAttestedAt);

  React.useEffect(() => {
    if (!user || !termsReady) {
      setFirstRunReady(false);
      setShowFirstPlan(false);
      return;
    }

    let active = true;
    AsyncStorage.getItem(FIRST_RUN_DONE_KEY)
      .then((value) => {
        if (!active) return;
        setShowFirstPlan(value !== '1');
      })
      .catch(() => {
        if (!active) return;
        setShowFirstPlan(false);
      })
      .finally(() => {
        if (active) setFirstRunReady(true);
      });

    return () => {
      active = false;
    };
  }, [termsReady, user]);

  const markFirstRunDone = React.useCallback(() => {
    setShowFirstPlan(false);
    void AsyncStorage.setItem(FIRST_RUN_DONE_KEY, '1');
  }, []);

  if (isLoading) {
    return (
      <AppBackdrop>
        <View style={styles.loading}>
          <SkeletonBlock width="58%" height={38} radius={16} />
          <SkeletonBlock width="82%" height={14} radius={7} />
          <SkeletonCard />
          <SkeletonCard compact />
        </View>
      </AppBackdrop>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  if (!user.verifiedUniversity) {
    return <VerifyEmailScreen />;
  }

  if (user.termsVersion !== CURRENT_TERMS_VERSION || !user.ageAttestedAt) {
    return <TermsAcceptanceScreen />;
  }

  if (!firstRunReady) {
    return (
      <AppBackdrop>
        <View style={styles.loading}>
          <SkeletonBlock width="58%" height={38} radius={16} />
          <SkeletonBlock width="82%" height={14} radius={7} />
          <SkeletonCard />
          <SkeletonCard compact />
        </View>
      </AppBackdrop>
    );
  }

  return <AuthedApp showFirstPlan={showFirstPlan} onFirstPlanDone={markFirstRunDone} />;
}

function ThemedApp() {
  const { colors, isDark } = useTheme();
  // URL + notification handling lives in the `linking` options above so that
  // deep links and push taps share one pipeline.

  const navTheme = React.useMemo(() => {
    const base = isDark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        background: colors.bg,
        card: colors.bg,
        text: colors.ink,
        border: 'transparent',
        primary: colors.primary,
      },
    };
  }, [colors, isDark]);

  return (
    <NavigationContainer theme={navTheme} linking={linking}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <AppGate />
    </NavigationContainer>
  );
}

function ThemeReadyGate({ children }: { children: React.ReactNode }) {
  const { ready } = useTheme();
  const [laidOut, setLaidOut] = React.useState(false);

  React.useEffect(() => {
    if (ready && laidOut) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [ready, laidOut]);

  if (!ready) {
    return null;
  }

  return (
    <View style={styles.flex} onLayout={() => setLaidOut(true)}>
      {children}
    </View>
  );
}

function App() {
  return (
    <GestureHandlerRootView
      style={[styles.flex, Platform.OS === 'web' && styles.webStage]}
    >
      <View style={[styles.flex, Platform.OS === 'web' && styles.webShell]}>
        <SafeAreaProvider>
          <ThemeProvider>
            <ThemeReadyGate>
              <ErrorBoundary>
                <AuthProvider>
                  <ThemedApp />
                </AuthProvider>
              </ErrorBoundary>
            </ThemeReadyGate>
          </ThemeProvider>
        </SafeAreaProvider>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  webStage: {
    alignItems: 'center',
    backgroundColor: '#0F0B09',
  },
  webShell: {
    width: '100%',
    maxWidth: 480,
    overflow: 'hidden',
  },
  dockWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    alignItems: 'stretch',
  },
  dock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderRadius: radii.xl,
    paddingVertical: 10,
    paddingHorizontal: 6,
    overflow: 'hidden',
  },
  dockBorder: {
    borderRadius: radii.xl,
    borderWidth: BORDER_W,
  },
  tabSlot: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
  },
  tabSticker: {
    width: 46,
    height: 32,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBadge: {
    position: 'absolute',
    top: -8,
    right: -2,
  },
  tabLabel: {
    fontFamily: fonts.semibold,
    fontWeight: '600',
    fontSize: 11,
    letterSpacing: 0,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
});

export default wrapApp(App);
