import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { getPodsByActivity, joinPod, createPod } from '../api';
import { Pod } from '../types';
import { useAuth } from '../context/AuthContext';

type Props = NativeStackScreenProps<RootStackParamList, 'PodList'>;

const STATUS_COLORS: Record<string, string> = {
  FORMING: '#22c55e',
  LOCKED: '#3b82f6',
  COMPLETED: '#9ca3af',
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function PodListScreen({ route, navigation }: Props) {
  const { activityId, activityTitle } = route.params;
  const { user } = useAuth();

  const [pods, setPods] = useState<Pod[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null); // pod id being acted on, or 'new'

  const fetchPods = useCallback(async () => {
    try {
      const data = await getPodsByActivity(activityId);
      // Show FORMING first, then LOCKED, then COMPLETED
      const sorted = [...data].sort((a, b) => {
        const order = { FORMING: 0, LOCKED: 1, COMPLETED: 2 };
        return (order[a.status] ?? 3) - (order[b.status] ?? 3);
      });
      setPods(sorted);
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to load pods');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activityId]);

  useEffect(() => {
    fetchPods();
  }, [fetchPods]);

  const handleJoin = async (podId: string) => {
    setActionId(podId);
    try {
      const pod = await joinPod(podId);
      navigation.replace('Pod', { podId: pod.id });
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to join pod');
    } finally {
      setActionId(null);
    }
  };

  const handleCreate = async () => {
    setActionId('new');
    try {
      const pod = await createPod(activityId);
      navigation.replace('Pod', { podId: pod.id });
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to create pod');
    } finally {
      setActionId(null);
    }
  };

  const isAlreadyMember = (pod: Pod) =>
    pod.members.some((m) => m.user.id === user?.id);

  const formingPods = pods.filter((p) => p.status === 'FORMING');
  const otherPods = pods.filter((p) => p.status !== 'FORMING');

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1a1a1a" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={pods}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchPods();
            }}
          />
        }
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View>
            {/* Create pod CTA */}
            <TouchableOpacity
              style={[styles.createButton, actionId === 'new' && styles.createButtonDisabled]}
              onPress={handleCreate}
              disabled={actionId !== null}
            >
              {actionId === 'new' ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.createButtonIcon}>+</Text>
                  <Text style={styles.createButtonText}>Create a New Pod</Text>
                </>
              )}
            </TouchableOpacity>

            {formingPods.length > 0 && (
              <Text style={styles.sectionLabel}>Open Pods — join one</Text>
            )}
            {formingPods.length === 0 && otherPods.length === 0 && (
              <Text style={styles.emptyText}>
                No pods yet. Be the first to create one!
              </Text>
            )}
          </View>
        }
        ListFooterComponent={
          otherPods.length > 0 ? (
            <Text style={styles.sectionLabel}>Past Pods</Text>
          ) : null
        }
        renderItem={({ item }) => {
          const memberCount = item.members.length;
          const isMember = isAlreadyMember(item);
          const isForming = item.status === 'FORMING';
          const canJoin = isForming && memberCount < 4 && !isMember;

          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => isMember ? navigation.navigate('Pod', { podId: item.id }) : undefined}
              activeOpacity={isMember ? 0.7 : 1}
            >
              {/* Status + member count row */}
              <View style={styles.cardHeader}>
                <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[item.status] ?? '#888' }]} />
                <Text style={styles.cardStatus}>{item.status}</Text>
                <Text style={styles.memberCount}>{memberCount}/4 members</Text>
              </View>

              {/* Member names */}
              <View style={styles.memberRow}>
                {item.members.map((m) => (
                  <View key={m.id} style={styles.memberChip}>
                    <Text style={styles.memberChipText}>
                      {m.user.name.split(' ')[0]}
                      {m.user.id === user?.id ? ' ★' : ''}
                    </Text>
                  </View>
                ))}
                {Array.from({ length: 4 - memberCount }).map((_, i) => (
                  <View key={`empty-${i}`} style={[styles.memberChip, styles.memberChipEmpty]}>
                    <Text style={styles.memberChipEmptyText}>open</Text>
                  </View>
                ))}
              </View>

              {/* Meetup info */}
              <Text style={styles.meta}>🕐 {formatTime(item.meetupTime)}</Text>
              <Text style={styles.meta}>📍 {item.location}</Text>

              {/* Action button */}
              {isMember ? (
                <TouchableOpacity
                  style={styles.viewButton}
                  onPress={() => navigation.navigate('Pod', { podId: item.id })}
                >
                  <Text style={styles.viewButtonText}>View Pod →</Text>
                </TouchableOpacity>
              ) : canJoin ? (
                <TouchableOpacity
                  style={[styles.joinButton, actionId === item.id && styles.joinButtonDisabled]}
                  onPress={() => handleJoin(item.id)}
                  disabled={actionId !== null}
                >
                  {actionId === item.id ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.joinButtonText}>Join Pod</Text>
                  )}
                </TouchableOpacity>
              ) : !isMember && isForming && memberCount >= 4 ? (
                <Text style={styles.fullText}>Full</Text>
              ) : null}
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    padding: 16,
    paddingBottom: 40,
  },
  createButton: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  createButtonDisabled: {
    backgroundColor: '#999',
  },
  createButtonIcon: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '300',
    marginRight: 8,
    lineHeight: 24,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 4,
  },
  emptyText: {
    textAlign: 'center',
    color: '#aaa',
    fontSize: 14,
    marginTop: 20,
    marginBottom: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  cardStatus: {
    fontSize: 12,
    fontWeight: '600',
    color: '#555',
    flex: 1,
  },
  memberCount: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  memberRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
    gap: 6,
  },
  memberChip: {
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  memberChipText: {
    fontSize: 13,
    color: '#333',
  },
  memberChipEmpty: {
    backgroundColor: '#fafafa',
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderStyle: 'dashed',
  },
  memberChipEmptyText: {
    fontSize: 12,
    color: '#ccc',
  },
  meta: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  joinButton: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  joinButtonDisabled: {
    backgroundColor: '#999',
  },
  joinButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  viewButton: {
    marginTop: 12,
    alignItems: 'flex-end',
  },
  viewButtonText: {
    color: '#1a1a1a',
    fontSize: 14,
    fontWeight: '600',
  },
  fullText: {
    marginTop: 12,
    textAlign: 'center',
    color: '#aaa',
    fontSize: 13,
  },
});
