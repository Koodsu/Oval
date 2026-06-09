import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { getApiErrorMessage, searchUsers, sendFriendRequest } from '../api';
import { RootStackParamList } from '../../App';
import { FriendUser } from '../types';
import { EmptyState, PrimaryButton, Screen, ScreenHeader, SearchField, UserAvatar } from '../components/ui';
import { Theme, createThemedStyles, fonts, radii, spacing, useTheme } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'UserSearch'>;

export default function UserSearchScreen({ navigation }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FriendUser[]>([]);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [sentUserIds, setSentUserIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    let cancelled = false;
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      return;
    }

    const timeout = setTimeout(() => {
      searchUsers(trimmed)
        .then((users) => {
          if (!cancelled) setResults(users);
        })
        .catch((error) => {
          if (!cancelled) Alert.alert('Could not search users', getApiErrorMessage(error));
        });
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [query]);

  const handleAdd = async (userId: string) => {
    setBusyUserId(userId);
    setSentUserIds((current) => new Set(current).add(userId));
    try {
      await sendFriendRequest(userId);
    } catch (error) {
      setSentUserIds((current) => {
        const next = new Set(current);
        next.delete(userId);
        return next;
      });
      Alert.alert('Could not send request', getApiErrorMessage(error));
    } finally {
      setBusyUserId(null);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag">
        <ScreenHeader title="Find people" onBack={() => navigation.goBack()} />
        <SearchField
          value={query}
          onChangeText={setQuery}
          placeholder="Search students by name..."
        />

        {query.trim().length === 0 ? (
          <EmptyState icon="search-outline" title="Search the campus graph" body="Look up someone you met in a pod, class, or club and send the request from here." />
        ) : results.length ? (
          <View style={styles.section}>
            {results.map((user) => (
              <TouchableOpacity
                key={user.id}
                style={styles.row}
                activeOpacity={0.88}
                onPress={() => navigation.navigate('UserProfile', { userId: user.id })}
              >
                <View style={styles.rowMain}>
                  <UserAvatar name={user.name} avatarUrl={user.avatarUrl} />
                  <View style={styles.copy}>
                    <Text style={styles.title}>{user.name}</Text>
                    <Text style={styles.body}>{user.verifiedUniversity ? 'Verified Ohio State student' : 'Student'}</Text>
                  </View>
                </View>
                <PrimaryButton
                  label={sentUserIds.has(user.id) ? 'Sent' : 'Add'}
                  onPress={() => void handleAdd(user.id)}
                  loading={busyUserId === user.id}
                  disabled={sentUserIds.has(user.id)}
                  kind="ghost"
                />
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <EmptyState icon="person-outline" title="No matches yet" body="Try a different spelling or search for their first and last name." />
        )}
      </ScrollView>
    </Screen>
  );
}

const useStyles = createThemedStyles((t: Theme) => ({
  content: {
    flexGrow: 1,
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  section: {
    gap: spacing.sm,
  },
  row: {
    gap: spacing.sm,
  },
  rowMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...t.typography.title,
  },
  body: {
    ...t.typography.body,
  },
}));
