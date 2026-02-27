import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { RootStackParamList } from '../../App';
import { blockUser } from '../api';
import Avatar from '../components/Avatar';
import { colors, spacing, radii, typography, shadows } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'UserProfile'>;

export default function UserProfileScreen({ route, navigation }: Props) {
  const { userId, name } = route.params;
  const [blocking, setBlocking] = useState(false);

  const handleBlock = () => {
    Alert.alert(
      'Block User',
      `Block ${name}? You won't see each other in pods or be able to message. You'll both be removed from any shared pods.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            setBlocking(true);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            try {
              await blockUser(userId);
              navigation.pop(2);
            } catch (err: unknown) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Failed to block user');
            } finally {
              setBlocking(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.card, shadows.md]}>
        <Avatar name={name} size={80} />
        <Text style={styles.name}>{name}</Text>
      </View>

      <TouchableOpacity
        style={[styles.blockButton, shadows.sm]}
        onPress={handleBlock}
        disabled={blocking}
        activeOpacity={0.8}
      >
        {blocking ? (
          <ActivityIndicator size="small" color={colors.red} />
        ) : (
          <>
            <Ionicons name="ban-outline" size={20} color={colors.red} />
            <Text style={styles.blockButtonText}>Block User</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  name: {
    ...typography.h2,
  },
  blockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: '#fef2f2',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.red,
  },
  blockButtonText: {
    ...typography.bodyBold,
    color: colors.red,
  },
});
