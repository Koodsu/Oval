import React from 'react';
import { LinkingOptions } from '@react-navigation/native';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import {
  BottomTabBarProps,
  createBottomTabNavigator,
} from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
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
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeIn,
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
import { ThemeProvider, fonts, motion, useTheme } from './src/theme';
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
// Tab bar
// ─────────────────────────────────────────────────────────────────────────────

function tabIcon(
  routeName: keyof MainTabParamList,
  focused: boolean,
): keyof typeof Ionicons.glyphMap {
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
  const { colors, gradients } = useTheme();
  const lift = useSharedValue(focused ? 1 : 0);

  React.useEffect(() => {
    lift.value = withSpring(focused ? 1 : 0, motion.springBouncy);
  }, [focused, lift]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + lift.value * 0.1 }],
  }));

  const inner = (
    <View style={styles.tabInner}>
      <Animated.View style={iconStyle}>
        <Ionicons
          name={tabIcon(routeName, focused)}
          size={22}
          color={focused ? '#FFFFFF' : colors.faint}
        />
      </Animated.View>
      {focused ? (
        <Animated.Text
          entering={FadeIn.duration(160)}
          style={styles.tabLabelActive}
          numberOfLines={1}
        >
          {label}
        </Animated.Text>
      ) : null}
    </View>
  );

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      onLongPress={onLongPress}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: focused }}
    >
      {focused ? (
        <LinearGradient
          colors={gradients.brand}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.tabPill, styles.tabPillActive]}
        >
          {inner}
        </LinearGradient>
      ) : (
        <View style={styles.tabPill}>{inner}</View>
      )}
    </Pressable>
  );
}

function BridgeTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      pointerEvents="box-none"
      style={[styles.dockWrap, { paddingBottom: Math.max(insets.bottom, 14) }]}
    >
      <View style={styles.dockShadow}>
        <View
          style={[
            styles.dock,
            {
              backgroundColor: colors.tabBar,
              borderColor: isDark ? colors.borderStrong : colors.border,
            },
          ]}
        >
          {Platform.OS === 'ios' ? (
            <BlurView
              intensity={44}
              tint={isDark ? 'dark' : 'light'}
              style={StyleSheet.absoluteFill}
            />
          ) : null}
          <View style={styles.tabRow}>
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
        </View>
      </View>
    </View>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <BridgeTabBar {...props} />}
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
  dockWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  dockShadow: {
    borderRadius: 999,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 12,
  },
  dock: {
    borderRadius: 999,
    borderWidth: 1,
    padding: 6,
    overflow: 'hidden',
  },
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  tabPill: {
    height: 46,
    minWidth: 48,
    borderRadius: 999,
    paddingHorizontal: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabPillActive: {
    paddingHorizontal: 16,
  },
  tabInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  tabLabelActive: {
    fontFamily: fonts.semibold,
    fontSize: 12.5,
    letterSpacing: 0.2,
    color: '#FFFFFF',
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
});
