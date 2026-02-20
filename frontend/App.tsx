import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { enableScreens } from 'react-native-screens';

enableScreens();

import { AuthProvider, useAuth } from './src/context/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import ActivityListScreen from './src/screens/ActivityListScreen';
import PodListScreen from './src/screens/PodListScreen';
import PodScreen from './src/screens/PodScreen';
import { colors } from './src/theme';

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  ActivityList: undefined;
  PodList: { activityId: string; activityTitle: string };
  Pod: { podId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

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
              name="ActivityList"
              component={ActivityListScreen}
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
              name="Pod"
              component={PodScreen}
              options={{
                title: 'Your Pod',
                headerBlurEffect: 'light',
              }}
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
