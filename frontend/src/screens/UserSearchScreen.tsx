import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getApiErrorMessage, searchUsers, sendFriendRequest } from '../api';
import { RootStackParamList } from '../../App';
import { FriendUser } from '../types';
import {
  AppBackdrop,
  Avatar,
  Button,
  EmptyState,
  ScreenHeader,
  SearchBar,
  Slab,
} from '../components/ui';
import { Theme, createThemedStyles, spacing, useTheme } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'UserSearch'>;

export default function UserSearchScreen({ navigation }: Props) {
  const styles = useStyles();
  const { typography } = useTheme();
  const insets = useSafeAreaInsets();
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
    <AppBackdrop>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xxl },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <ScreenHeader title="Find people" kicker="THE CAMPUS GRAPH" onBack={() => navigation.goBack()} />
        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder="Search students by name…"
          autoFocus
        />

        {query.trim().length === 0 ? (
          <EmptyState
            icon="telescope"
            title="Search the campus graph"
            body="Look up someone you met in a pod, class, or club and send the request from here."
            actionLabel="Back"
            onAction={() => navigation.goBack()}
          />
        ) : results.length ? (
          <View style={styles.section}>
            {results.map((user, index) => (
              <Slab
                key={user.id}
                onPress={() => navigation.navigate('UserProfile', { userId: user.id })}
                faceStyle={styles.rowFace}
                accessibilityLabel={`View ${user.name}'s profile`}
              >
                <Avatar
                  name={user.name}
                  uri={user.avatarUrl}
                  size={44}
                  tilt={index % 2 === 0 ? -2 : 2}
                />
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Text style={typography.heading} numberOfLines={1}>
                    {user.name}
                  </Text>
                  <Text style={typography.captionSmall}>
                    {user.verifiedUniversity ? 'Verified Ohio State student' : 'Student'}
                  </Text>
                </View>
                <Button
                  label={sentUserIds.has(user.id) ? 'Sent' : 'Add'}
                  size="sm"
                  variant={sentUserIds.has(user.id) ? 'secondary' : 'primary'}
                  onPress={() => void handleAdd(user.id)}
                  loading={busyUserId === user.id}
                  disabled={sentUserIds.has(user.id)}
                />
              </Slab>
            ))}
          </View>
        ) : (
          <EmptyState
            icon="person"
            title="No matches yet"
            body="Try a different spelling or search for their first and last name."
            actionLabel="Clear search"
            onAction={() => setQuery('')}
          />
        )}
      </ScrollView>
    </AppBackdrop>
  );
}

const useStyles = createThemedStyles((_t: Theme) => ({
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
  },
  section: {
    gap: spacing.md,
  },
  rowFace: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
    padding: spacing.md,
  },
}));
