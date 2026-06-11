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
import {
  Unbounded_600SemiBold,
  Unbounded_700Bold,
  Unbounded_800ExtraBold,
} from '@expo-google-fonts/unbounded';
import {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
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
import ClubsScreen from './src/screens/ClubsScreen';
import ClubMeetingsTonightScreen from './src/screens/ClubMeetingsTonightScreen';
import InboxScreen from './src/screens/InboxScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import ActivityPodsScreen from './src/screens/ActivityPodsScreen';
import PodDetailScreen from './src/screens/PodDetailScreen';
import ClubDetailScreen from './src/screens/ClubDetailScreen';
import ThreadScreen from './src/screens/ThreadScreen';
import EditProfileScreen from './src/screens/EditProfileScreen';
import UserProfileScreen from './src/screens/UserProfileScreen';
import UserSearchScreen from './src/screens/UserSearchScreen';
import BlockedUsersScreen from './src/screens/BlockedUsersScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import PrivacyDataScreen from './src/screens/PrivacyDataScreen';
import TermsAcceptanceScreen from './src/screens/TermsAcceptanceScreen';
import { Activity } from './src/types';
import { BORDER_W, ThemeProvider, fonts, motion, radii, useTheme } from './src/theme';
import { AppBackdrop, SkeletonBlock, SkeletonCard } from './src/components/ui';
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
  ClubDetail: { clubId: string };
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
  prefixes: ['bridge://', 'https://www.joinbridgeapp.com'],
  config: {
    screens: {
      PodDetail: 'pod/:podId',
      ClubDetail: 'clubs/:clubId',
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

const TAB_TILTS: Record<keyof MainTabParamList, number> = {
  Home: -3,
  Explore: 2.5,
  Pods: -2,
  Clubs: 3,
  Inbox: -2.5,
};

function TabItem({
  routeName,
  label,
  focused,
  onPress,
  onLongPress,
}: {
  routeName: keyof MainTabParamList;
  label: string;
  focused: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const { colors } = useTheme();
  const pop = useSharedValue(focused ? 1 : 0);

  React.useEffect(() => {
    pop.value = withSpring(focused ? 1 : 0, motion.springBouncy);
  }, [focused, pop]);

  const stickerStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: 0.85 + pop.value * 0.15 },
      { rotate: `${pop.value * TAB_TILTS[routeName]}deg` },
    ],
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
          focused && {
            backgroundColor: colors.primary,
            borderColor: colors.border,
            borderWidth: BORDER_W,
          },
          stickerStyle,
        ]}
      >
        <Ionicons
          name={tabIcon(routeName, focused)}
          size={21}
          color={focused ? colors.onPrimary : colors.faint}
        />
      </Animated.View>
      <Text
        style={[
          styles.tabLabel,
          { color: focused ? colors.ink : colors.faint },
        ]}
        numberOfLines={1}
      >
        {label.toUpperCase()}
      </Text>
    </Pressable>
  );
}

function BridgeDock({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.dock,
        {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.border,
          paddingBottom: Math.max(insets.bottom, 10),
        },
      ]}
    >
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
          />
        );
      })}
    </View>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <BridgeDock {...props} />}
      screenOptions={{ headerShown: false }}
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
      <Stack.Screen name="ClubDetail" component={ClubDetailScreen} />
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
    [fonts.displayMedium]: Unbounded_600SemiBold,
    [fonts.display]: Unbounded_700Bold,
    [fonts.displayHeavy]: Unbounded_800ExtraBold,
    [fonts.body]: SpaceGrotesk_400Regular,
    [fonts.medium]: SpaceGrotesk_500Medium,
    [fonts.semibold]: SpaceGrotesk_600SemiBold,
    [fonts.bold]: SpaceGrotesk_700Bold,
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
    <GestureHandlerRootView style={styles.flex} onLayout={onReady}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <ThemedApp />
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  dock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderTopWidth: BORDER_W + 1,
    paddingTop: 8,
    paddingHorizontal: 6,
  },
  tabSlot: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    paddingVertical: 2,
  },
  tabSticker: {
    width: 44,
    height: 38,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontFamily: fonts.bold,
    fontSize: 9,
    letterSpacing: 1.2,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
});
