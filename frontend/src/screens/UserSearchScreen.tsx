import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../../App';
import { searchUsers, resolveAvatarUrl } from '../api';
import { FriendUser } from '../types';
import Avatar from '../components/Avatar';
import { colors, spacing, radii, typography, shadows } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'UserSearch'>;

export default function UserSearchScreen({ navigation }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FriendUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = (text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!text.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await searchUsers(text.trim());
        setResults(data);
        setSearched(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color={colors.textTertiary} />
        <TextInput
          style={styles.input}
          placeholder="Search by name..."
          placeholderTextColor={colors.textTertiary}
          value={query}
          onChangeText={handleSearch}
          autoFocus
          returnKeyType="search"
          autoCapitalize="words"
        />
        {loading && <ActivityIndicator size="small" color={colors.primary} />}
        {!loading && query.length > 0 && (
          <TouchableOpacity onPress={() => handleSearch('')}>
            <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={results}
        keyExtractor={(u) => u.id}
        contentContainerStyle={results.length === 0 ? styles.emptyContainer : styles.list}
        keyboardDismissMode="on-drag"
        ListEmptyComponent={
          searched && !loading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No users found</Text>
            </View>
          ) : !searched ? (
            <View style={styles.emptyState}>
              <Ionicons name="search-outline" size={48} color={colors.textTertiary} />
              <Text style={styles.emptyText}>Type a name to search</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.row, shadows.sm]}
            onPress={() => navigation.navigate('UserProfile', { userId: item.id, name: item.name })}
            activeOpacity={0.8}
          >
            <Avatar name={item.name} size={44} uri={resolveAvatarUrl(item.avatarUrl)} />
            <View style={styles.rowInfo}>
              <Text style={styles.rowName}>{item.name}</Text>
              {item.verifiedUniversity && (
                <View style={styles.verifiedBadge}>
                  <Ionicons name="shield-checkmark" size={11} color={colors.green} />
                  <Text style={styles.verifiedText}>OSU Verified</Text>
                </View>
              )}
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    margin: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.text,
  },
  list: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xl },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyState: { alignItems: 'center', gap: spacing.md },
  emptyText: { ...typography.body, color: colors.textSecondary },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  rowInfo: { flex: 1, gap: 2 },
  rowName: { ...typography.bodyBold },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    alignSelf: 'flex-start',
    backgroundColor: colors.greenLight,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radii.pill,
  },
  verifiedText: { ...typography.tiny, color: colors.green, fontWeight: '600' },
});
