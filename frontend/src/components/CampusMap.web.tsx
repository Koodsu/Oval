import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette, radii, spacing, typography } from '../theme';

type Coordinate = {
  latitude: number;
  longitude: number;
};

export type MapPressEvent = {
  nativeEvent: {
    coordinate: Coordinate;
  };
};

type MapProps = {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: (event: MapPressEvent) => void;
};

type MarkerProps = {
  coordinate: Coordinate;
  title?: string;
  description?: string;
  onPress?: () => void;
  pinColor?: string;
};

type PolygonProps = {
  coordinates: Coordinate[];
  fillColor?: string;
  strokeColor?: string;
};

export const PROVIDER_DEFAULT = undefined;

export function Marker(_props: MarkerProps) {
  return null;
}

export function Polygon(_props: PolygonProps) {
  return null;
}

export default function CampusMap({ style }: MapProps) {
  return (
    <View style={[styles.map, style]} accessibilityRole="image" accessibilityLabel="Campus meetup map">
      <View style={styles.gridHorizontalOne} />
      <View style={styles.gridHorizontalTwo} />
      <View style={styles.gridVerticalOne} />
      <View style={styles.gridVerticalTwo} />
      <View style={styles.pin}>
        <Ionicons name="location" size={20} color={palette.white} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>Campus map</Text>
        <Text style={styles.body}>Interactive pins are available in the iOS app.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  map: {
    minHeight: 180,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: '#E8ECE7',
  },
  gridHorizontalOne: {
    position: 'absolute',
    top: '30%',
    left: -20,
    right: -20,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.8)',
    transform: [{ rotate: '-7deg' }],
  },
  gridHorizontalTwo: {
    position: 'absolute',
    top: '67%',
    left: -20,
    right: -20,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.75)',
    transform: [{ rotate: '5deg' }],
  },
  gridVerticalOne: {
    position: 'absolute',
    top: -20,
    bottom: -20,
    left: '25%',
    width: 2,
    backgroundColor: 'rgba(255,255,255,0.72)',
    transform: [{ rotate: '9deg' }],
  },
  gridVerticalTwo: {
    position: 'absolute',
    top: -20,
    bottom: -20,
    right: '22%',
    width: 3,
    backgroundColor: 'rgba(255,255,255,0.78)',
    transform: [{ rotate: '-11deg' }],
  },
  pin: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.scarlet,
    shadowColor: palette.shadowStrong,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 14,
  },
  copy: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  title: {
    ...typography.title,
  },
  body: {
    ...typography.body,
    fontSize: 13,
    textAlign: 'center',
  },
});
