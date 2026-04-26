import React, { useCallback, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { API_USER_MESSAGE, getMyPodHistory, getMyPods } from '../api';
import { RootStackParamList } from '../../App';
import { Pod } from '../types';
import { CompactHeader, EmptyState, Panel, Screen, SectionHeader, SegmentedControl } from '../components/ui';
import { formatDateTime } from '../utils/format';
import { sortUpcomingPods } from '../utils/experience';
import { radii, spacing, typography, palette } from '../theme';

type Mode = 'active' | 'history';
type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function PodsScreen() {
  const navigation = useNavigation<Nav>();
  const [mode, setMode] = useState<Mode>('active');
  const [activePods, setActivePods] = useState<Pod[]>([]);
  const [historyPods, setHistoryPods] = useState<Pod[]>([]);

  const load = useCallback(async () => {
    try {
      const [mine, history] = await Promise.all([getMyPods(), getMyPodHistory()]);
      setActivePods(mine);
      setHistoryPods(history);
    } catch {
      Alert.alert('Could not load your pods', API_USER_MESSAGE);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const items = useMemo(
    () => (mode === 'active' ? sortUpcomingPods(activePods) : sortUpcomingPods(historyPods)),
    [activePods, historyPods, mode]
  );

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <CompactHeader
          eyebrow="Pods"
          title="Your plans, all in one place."
          subtitle="Active pods you're in now, and a history of everything you've done."
        />
        <SegmentedControl
          value={mode}
          options={[
            { value: 'active', label: 'Active' },
            { value: 'history', label: 'History' },
          ]}
          onChange={setMode}
        />
        <View style={styles.section}>
          <SectionHeader title={mode === 'active' ? 'Current pods' : 'Past pods'} />
          {items.length ? items.map((pod) => (
            <TouchableOpacity key={pod.id} style={styles.card} onPress={() => navigation.navigate('PodDetail', { podId: pod.id })}>
              <Text style={styles.eyebrow}>{pod.status}</Text>
              <Text style={styles.title}>{pod.activity?.title ?? 'Pod'}</Text>
              <Text style={styles.body}>{formatDateTime(pod.meetupTime)}</Text>
              <Text style={styles.body}>{pod.location}</Text>
            </TouchableOpacity>
          )) : <EmptyState icon="calendar-outline" title="No pods here yet" body={mode === 'active' ? 'Join one from Explore and it will appear here.' : 'Completed pods and recaps will build your history over time.'} />}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  section: {
    gap: spacing.sm,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: palette.border,
    gap: 4,
  },
  eyebrow: {
    ...typography.label,
  },
  title: {
    ...typography.title,
  },
  body: {
    ...typography.body,
  },
});
