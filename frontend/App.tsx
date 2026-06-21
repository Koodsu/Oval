import React from 'react';
import { LinkingOptions } from '@react-navigation/native';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
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
import { useFonts } from 'expo-font';
import { BlurView } from 'expo-blur';
import {
  Sora_600SemiBold,
  Sora_700Bold,
  Sora_800ExtraBold,
} from '@expo-google-fonts/sora';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
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
import ExploreScreen from './src/screens/ExploreScreen';
import PodsScreen from './src/screens/PodsScreen';
import ClubsHomeScreen from './src/screens/clubs/ClubsHomeScreen';
import ClubMeetingsTonightScreen from './src/screens/clubs/ClubMeetingsTonightScreen';
import InboxScreen from './src/screens/InboxScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import ActivityPodsScreen from './src/screens/ActivityPodsScreen';
import PodDetailScreen from './src/screens/PodDetailScreen';
import PodChatScreen from './src/screens/PodChatScreen';
import ClubHomeScreen from './src/screens/clubs/ClubHomeScreen';
import ClubChatScreen from './src/screens/clubs/ClubChatScreen';
import ClubEventsScreen from './src/screens/clubs/ClubEventsScreen';
import MeetingDetailScreen from './src/screens/clubs/MeetingDetailScreen';
import ClubMembersScreen from './src/screens/clubs/ClubMembersScreen';
import ClubManageScreen from './src/screens/clubs/ClubManageScreen';
import ThreadScreen from './src/screens/ThreadScreen';
import EditProfileScreen from './src/screens/EditProfileScreen';
import UserProfileScreen from './src/screens/UserProfileScreen';
import UserSearchScreen from './src/screens/UserSearchScreen';
import BlockedUsersScreen from './src/screens/BlockedUsersScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import PrivacyDataScreen from './src/screens/PrivacyDataScreen';
import TermsAcceptanceScreen from './src/screens/TermsAcceptanceScreen';
import { Activity } from './src/types';
import { getFriendRequests, getMessageThreads, getPodInvites } from './src/api';
import { BORDER_W, ThemeProvider, elevation, fonts, motion, radii, useTheme } from './src/theme';
import { AppBackdrop, CountBubble, SkeletonBlock, SkeletonCard } from './src/components/ui';
import { CURRENT_TERMS_VERSION } from './src/constants/legal';

SplashScreen.preventAutoHideAsync().catch(() => {});

export type MainTabParamList = {
  Home: undefined;
  Explore: undefined;
  Pods: undefined;
  Clubs: undefined;
  Inbox: undefined;
};

export type RootStackParamList = {
  MainTabs: { screen?: keyof MainTabParamList } | undefined;
  ActivityPods: { activity: Activity; startCreate?: boolean };
  PodDetail: { podId: string };
  PodChat: { podId: string };
  ClubDetail: { clubId: string };
  ClubChat: { clubId: string; channelId: string };
  ClubEvents: { clubId: string; startCreate?: boolean };
  ClubMeeting: { clubId: string; meetingId: string };
  ClubMembers: { clubId: string };
  ClubManage: { clubId: string };
  ClubMeetingsTonight: undefined;
  Thread: { threadId: string; title: string };
  Profile: undefined;
  EditProfile: undefined;
  UserProfile: { userId: string };
  UserSearch: undefined;
  BlockedUsers: undefined;
  Settings: undefined;
  PrivacyData: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['oval://', 'https://www.theovalapp.com'],
  config: {
    screens: {
      PodDetail: 'pod/:podId',
      ClubDetail: 'clubs/:clubId',
      ClubChat: 'clubs/:clubId/chat/:channelId',
      ClubEvents: 'clubs/:clubId/events',
      ClubMeeting: 'clubs/:clubId/events/:meetingId',
      ClubMembers: 'clubs/:clubId/members',
      ClubManage: 'clubs/:clubId/manage',
      UserProfile: 'users/:userId',
    },
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
  const { colors } = useTheme();
  const pop = useSharedValue(focused ? 1 : 0);

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
          color={focused ? colors.primary : colors.faint}
        />
        {typeof badge === 'number' ? (
          <CountBubble count={badge} style={styles.tabBadge} />
        ) : null}
      </Animated.View>
      <Text
        style={[
          styles.tabLabel,
          { color: focused ? colors.primary : colors.faint },
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

  return (
    <View
      pointerEvents="box-none"
      style={[styles.dockWrap, { paddingBottom: Math.max(insets.bottom, 12) }]}
    >
      <View style={[styles.dock, { ...elevation.floating, shadowColor: colors.shadow }]}>
        <BlurView
          tint={isDark ? 'dark' : 'light'}
          intensity={40}
          style={StyleSheet.absoluteFill}
        />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.tabBar }]} />
        <View style={[StyleSheet.absoluteFill, styles.dockBorder, { borderColor: colors.border }]} />
        {state.routes.map((route, index) => {
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
      })}
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

  React.useEffect(() => {
    if (!token || !user?.verifiedUniversity) {
      setCount(0);
      return;
    }
    let active = true;

    const refresh = async () => {
      try {
        const [threads, invites, requests] = await Promise.all([
          getMessageThreads(),
          getPodInvites(),
          getFriendRequests(),
        ]);
        if (!active) return;
        setCount(
          threads.filter((thread) => thread.hasUnread).length +
            invites.length +
            requests.incoming.length,
        );
      } catch {
        // Keep the previous badge on transient errors.
      }
    };

    void refresh();
    const interval = setInterval(() => void refresh(), INBOX_BADGE_POLL_MS);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [token, user?.verifiedUniversity]);

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
      <Tab.Screen name="Explore" component={ExploreScreen} />
      <Tab.Screen name="Pods" component={PodsScreen} />
      <Tab.Screen name="Clubs" component={ClubsHomeScreen} />
      <Tab.Screen name="Inbox" component={InboxScreen} options={{ tabBarBadge: inboxBadge }} />
    </Tab.Navigator>
  );
}

function AuthedApp() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: Platform.OS === 'ios' ? 'default' : 'slide_from_right',
        animationDuration: 280,
      }}
    >
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen name="ActivityPods" component={ActivityPodsScreen} />
      <Stack.Screen name="PodDetail" component={PodDetailScreen} />
      <Stack.Screen name="PodChat" component={PodChatScreen} />
      <Stack.Screen name="ClubDetail" component={ClubHomeScreen} />
      <Stack.Screen name="ClubChat" component={ClubChatScreen} />
      <Stack.Screen name="ClubEvents" component={ClubEventsScreen} />
      <Stack.Screen name="ClubMeeting" component={MeetingDetailScreen} />
      <Stack.Screen name="ClubMembers" component={ClubMembersScreen} />
      <Stack.Screen name="ClubManage" component={ClubManageScreen} />
      <Stack.Screen name="ClubMeetingsTonight" component={ClubMeetingsTonightScreen} />
      <Stack.Screen name="Thread" component={ThreadScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen} />
      <Stack.Screen name="UserSearch" component={UserSearchScreen} />
      <Stack.Screen name="BlockedUsers" component={BlockedUsersScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="PrivacyData" component={PrivacyDataScreen} />
    </Stack.Navigator>
  );
}

function AppGate() {
  const { user, isLoading } = useAuth();

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

  return <AuthedApp />;
}

function ThemedApp() {
  const { colors, isDark } = useTheme();

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

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    [fonts.displayMedium]: Sora_600SemiBold,
    [fonts.display]: Sora_700Bold,
    [fonts.displayHeavy]: Sora_800ExtraBold,
    [fonts.body]: Inter_400Regular,
    [fonts.medium]: Inter_500Medium,
    [fonts.semibold]: Inter_600SemiBold,
    [fonts.bold]: Inter_700Bold,
  });

  const onReady = React.useCallback(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView
      style={[styles.flex, Platform.OS === 'web' && styles.webStage]}
      onLayout={onReady}
    >
      <View style={[styles.flex, Platform.OS === 'web' && styles.webShell]}>
        <SafeAreaProvider>
          <ThemeProvider>
            <AuthProvider>
              <ThemedApp />
            </AuthProvider>
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
    fontSize: 10.5,
    letterSpacing: 0.2,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
});
