import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { RootStackParamList } from '../../App';
import { getPeopleYouMet, sendFriendRequest, resolveAvatarUrl, API_USER_MESSAGE } from '../api';
import { PeopleYouMetUser } from '../types';
import Avatar from '../components/Avatar';
import TagPills from '../components/TagPills';
import { colors, spacing, radii, typography, shadows } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'PeopleYouMet'>;

type RequestStatus = 'idle' | 'sending' | 'sent';

export default function PeopleYouMetScreen({ route, navigation }: Props) {
  const { podId } = route.params;
  const [users, setUsers] = useState<PeopleYouMetUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestStatuses, setRequestStatuses] = useState<Record<string, RequestStatus>>({});

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
          <Text style={styles.doneButton}>Done</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  useEffect(() => {
    getPeopleYouMet(podId)
      .then((data) => setUsers(data.users))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [podId]);

  const handleAddFriend = async (userId: string) => {
    setRequestStatuses((prev) => ({ ...prev, [userId]: 'sending' }));
    try {
      await sendFriendRequest(userId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setRequestStatuses((prev) => ({ ...prev, [userId]: 'sent' }));
    } catch (err: unknown) {
      setRequestStatuses((prev) => ({ ...prev, [userId]: 'idle' }));
      Alert.alert('Error', API_USER_MESSAGE);
    }
  };

  const renderUser = ({ item }: { item: PeopleYouMetUser }) => {
    const status = requestStatuses[item.id] ?? 'idle';
    const subtitle = [item.classYear, item.major].filter(Boolean).join(' · ');

    return (
      <TouchableOpacity
        style={[styles.card, shadows.sm]}
        onPress={() => navigation.navigate('UserProfile', { userId: item.id, name: item.name })}
        activeOpacity={0.7}
      >
        <View style={styles.cardRow}>
          <Avatar
            name={item.name}
            size={52}
            uri={resolveAvatarUrl(item.avatarUrl)}
          />
          <View style={styles.cardInfo}>
            <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
            {subtitle ? <Text style={styles.cardSubtitle} numberOfLines={1}>{subtitle}</Text> : null}
            {item.interestTags.length > 0 && (
              <TagPills tags={item.interestTags} max={3} size="sm" style={styles.tags} />
            )}
          </View>
          {status === 'sent' ? (
            <View style={styles.sentBadge}>
              <Ionicons name="checkmark" size={16} color={colors.green} />
              <Text style={styles.sentText}>Sent</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => handleAddFriend(item.id)}
              disabled={status === 'sending'}
              activeOpacity={0.7}
            >
              {status === 'sending' ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <>
                  <Ionicons name="person-add-outline" size={16} color={colors.primary} />
                  <Text style={styles.addBtnText}>Add</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (users.length === 0) {
    return (
      <View style={styles.center}>
        <Ionicons name="people-outline" size={48} color={colors.textTertiary} />
        <Text style={styles.emptyTitle}>No new people to add</Text>
        <Text style={styles.emptySubtitle}>
          You're already friends with everyone from this meetup!
        </Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.emptyBtn}>
          <Text style={styles.emptyBtnText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>People you met</Text>
        <Text style={styles.headerSubtitle}>
          Stay connected with the people from your meetup
        </Text>
      </View>
      <FlatList
        data={users}
        keyExtractor={(u) => u.id}
        renderItem={renderUser}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerTitle: {
    ...typography.h2,
  },
  headerSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  list: {
    padding: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  cardInfo: {
    flex: 1,
    gap: 2,
  },
  cardName: {
    ...typography.bodyBold,
    fontSize: 15,
  },
  cardSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  tags: {
    marginTop: spacing.xs,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  addBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  sentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
  },
  sentText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.green,
  },
  doneButton: {
    ...typography.bodyBold,
    color: colors.primary,
    fontSize: 15,
  },
  emptyTitle: {
    ...typography.h3,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  emptySubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  emptyBtn: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.primary + '12',
  },
  emptyBtnText: {
    ...typography.bodyBold,
    color: colors.primary,
    fontSize: 14,
  },
});
