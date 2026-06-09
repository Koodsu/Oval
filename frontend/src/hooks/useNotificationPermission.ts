import { useCallback, useEffect, useState } from 'react';
import { Linking, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { registerPushToken } from '../api';

export function useNotificationPermission() {
  const [granted, setGranted] = useState(Platform.OS === 'web');
  const [canAskAgain, setCanAskAgain] = useState(true);
  const [loaded, setLoaded] = useState(Platform.OS === 'web');

  const refresh = useCallback(async () => {
    if (Platform.OS === 'web') return;
    try {
      const permission = await Notifications.getPermissionsAsync();
      setGranted(permission.status === 'granted');
      setCanAskAgain(permission.canAskAgain);
    } catch {
      setGranted(false);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const requestNotifications = useCallback(async () => {
    if (Platform.OS === 'web') return true;

    try {
      let permission = await Notifications.getPermissionsAsync();
      if (permission.status !== 'granted') {
        if (!permission.canAskAgain) {
          await Linking.openSettings();
          return false;
        }
        permission = await Notifications.requestPermissionsAsync();
      }

      const allowed = permission.status === 'granted';
      setGranted(allowed);
      setCanAskAgain(permission.canAskAgain);
      if (!allowed) return false;

      const tokenData = await Notifications.getExpoPushTokenAsync();
      await registerPushToken(tokenData.data);
      return true;
    } catch {
      return false;
    }
  }, []);

  return {
    granted,
    canAskAgain,
    loaded,
    refresh,
    requestNotifications,
  };
}
