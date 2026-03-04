import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../../App';
import { getMyPods } from '../api';
import { Pod } from '../types';
import Avatar from '../components/Avatar';
import GradientButton from '../components/GradientButton';
import { colors, spacing, radii, typography, shadows } from '../theme';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [pods, setPods] = useState<Pod[]>([]);

  const fetchStats = useCallback(async () => {
    try {
      const data = await getMyPods();
      setPods(data);
    } catch {
      // Stats are non-critical, fail silently
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const activePods = pods.filter((p) => p.status === 'FORMING' || p.status === 'LOCKED');
  const completedPods = pods.filter((p) => p.status === 'COMPLETED');

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
  };

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.heading}>Profile</Text>
      </View>

      <View style={[styles.profileCard, shadows.md]}>
        <Avatar name={user?.name ?? 'U'} size={72} />
        <Text style={styles.name}>{user?.name}</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>

      <Text style={styles.sectionTitle}>Stats</Text>
      <View style={styles.statsRow}>
        <View style={[styles.statCard, shadows.sm]}>
          <View style={[styles.statIcon, { backgroundColor: colors.primary + '15' }]}>
            <Ionicons name="people" size={20} color={colors.primary} />
          </View>
          <Text style={styles.statNumber}>{activePods.length}</Text>
          <Text style={styles.statLabel}>Active Pods</Text>
        </View>
        <View style={[styles.statCard, shadows.sm]}>
          <View style={[styles.statIcon, { backgroundColor: colors.green + '15' }]}>
            <Ionicons name="checkmark-circle" size={20} color={colors.green} />
          </View>
          <Text style={styles.statNumber}>{completedPods.length}</Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
        <View style={[styles.statCard, shadows.sm]}>
          <View style={[styles.statIcon, { backgroundColor: colors.violet + '15' }]}>
            <Ionicons name="star" size={20} color={colors.violet} />
          </View>
          <Text style={styles.statNumber}>{pods.length}</Text>
          <Text style={styles.statLabel}>Total Pods</Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.reportsLink}
        onPress={() => navigation.navigate('MyReports' as never)}
      >
        <Ionicons name="flag-outline" size={20} color={colors.primary} />
        <Text style={styles.reportsLinkText}>My Reports</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
      </TouchableOpacity>

      <View style={styles.signOutSection}>
        <GradientButton
          title="Sign Out"
          onPress={handleSignOut}
          icon="log-out-outline"
          variant="outline"
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingBottom: spacing.xxxl,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  heading: {
    ...typography.h2,
  },
  profileCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    marginHorizontal: spacing.lg,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
  },
  name: {
    ...typography.h2,
    marginTop: spacing.sm,
  },
  email: {
    ...typography.caption,
  },
  sectionTitle: {
    ...typography.label,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.sm + 4,
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm + 4,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statNumber: {
    ...typography.h2,
    fontSize: 24,
  },
  statLabel: {
    ...typography.tiny,
    textAlign: 'center',
  },
  reportsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    ...shadows.sm,
  },
  reportsLinkText: {
    ...typography.bodyBold,
    flex: 1,
    color: colors.primary,
  },
  signOutSection: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xxl,
  },
});
