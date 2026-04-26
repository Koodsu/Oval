import { useState, useEffect } from 'react';
import * as Location from 'expo-location';

export function useLocationPermission() {
  const [granted, setGranted] = useState(false);
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  useEffect(() => {
    let mounted = true;

    Location.requestForegroundPermissionsAsync()
      .then((permission) => {
        if (!mounted || permission?.status !== 'granted') return;
        setGranted(true);
        return Location.getCurrentPositionAsync({});
      })
      .then((loc) => {
        if (!mounted || !loc) return;
        setUserLocation({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
      })
      .catch(() => {
        if (mounted) setGranted(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return { granted, userLocation };
}
