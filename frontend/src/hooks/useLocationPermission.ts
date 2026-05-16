import { useCallback, useEffect, useState } from 'react';
import * as Location from 'expo-location';

export function useLocationPermission() {
  const [granted, setGranted] = useState(false);
  const [canAskAgain, setCanAskAgain] = useState(true);
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  const loadCurrentLocation = useCallback(async () => {
    const loc = await Location.getCurrentPositionAsync({});
    setUserLocation({
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
    });
  }, []);

  useEffect(() => {
    let mounted = true;

    Location.getForegroundPermissionsAsync()
      .then((permission) => {
        if (!mounted) return;
        setCanAskAgain(permission.canAskAgain);
        if (permission?.status !== 'granted') return;
        setGranted(true);
        return loadCurrentLocation();
      })
      .catch(() => {
        if (mounted) setGranted(false);
      });

    return () => {
      mounted = false;
    };
  }, [loadCurrentLocation]);

  const requestLocation = useCallback(async () => {
    const permission = await Location.requestForegroundPermissionsAsync();
    setCanAskAgain(permission.canAskAgain);
    const allowed = permission.status === 'granted';
    setGranted(allowed);
    if (allowed) {
      await loadCurrentLocation();
    }
    return allowed;
  }, [loadCurrentLocation]);

  return { granted, canAskAgain, userLocation, requestLocation };
}
