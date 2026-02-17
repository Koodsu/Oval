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
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#1a1a1a" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: '#fff' },
          headerTintColor: '#1a1a1a',
          headerTitleStyle: { fontWeight: '700' },
          headerShadowVisible: false,
        }}
      >
        {user ? (
          // Authenticated screens
          <>
            <Stack.Screen
              name="ActivityList"
              component={ActivityListScreen}
              options={{ title: 'Bridge', headerShown: false }}
            />
            <Stack.Screen
              name="PodList"
              component={PodListScreen}
              options={({ route }) => ({ title: route.params.activityTitle })}
            />
            <Stack.Screen
              name="Pod"
              component={PodScreen}
              options={{ title: 'Your Pod' }}
            />
          </>
        ) : (
          // Auth screens
          <>
            <Stack.Screen
              name="Login"
              component={LoginScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Register"
              component={RegisterScreen}
              options={{ title: 'Register' }}
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
