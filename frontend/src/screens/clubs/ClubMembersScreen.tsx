import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  API_USER_MESSAGE,
  assignClubRole,
  patchClubMemberRole,
  removeClubMember,
  removeClubRole,
} from '../../api';
import type { RootStackParamList } from '../../../App';
import {
  AppBackdrop,
  Card,
  EmptyState,
  ListRow,
  ScreenHeader,
  SearchBar,
  Sheet,
} from '../../components/ui';
import { ClubScreenLoading, MemberRow } from '../../components/clubs';
import { roleRank, useClub } from '../../hooks/useClub';
import type { ClubMemberWithUser } from '../../types';
import { spacing, useTheme } from '../../theme';
import { useAuth } from '../../context/AuthContext';

type Props = NativeStackScreenProps<RootStackParamList, 'ClubMembers'>;

export default function ClubMembersScreen({ route, navigation }: Props) {
  const { clubId } = route.params;
  const { club, can, loading, refresh } = useClub(clubId);
  const { user } = useAuth();
  const { typography } = useTheme();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState<ClubMemberWithUser | null>(null);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const members = (club?.members ?? []).filter((member) =>
      !q || [member.user.name, member.user.major, member.role].join(' ').toLowerCase().includes(q),
    );
    return [
      ['OWNERS', members.filter((member) => member.role === 'OWNER')],
      ['OFFICERS', members.filter((member) => member.role === 'ADMIN' || member.role === 'OFFICER')],
      ['MEMBERS', members.filter((member) => member.role === 'MEMBER')],
    ] as const;
  }, [club?.members, query]);

  const canManageTarget = (member: ClubMemberWithUser) =>
    member.userId !== user?.id && roleRank(member.role) < roleRank(club?.myRole);
  const canChangePrimaryRole = (member: ClubMemberWithUser) =>
    canManageTarget(member) && can('MANAGE_MEMBERS');
  const canManageTags = (member: ClubMemberWithUser) =>
    canManageTarget(member) && can('MANAGE_ROLES') && Boolean(club?.roles?.length);
  const canAct = (member: ClubMemberWithUser) =>
    canChangePrimaryRole(member) || canManageTags(member);

  const updateRole = async (role: 'ADMIN' | 'OFFICER' | 'MEMBER') => {
    if (!active) return;
    try {
      await patchClubMemberRole(clubId, active.userId, { role });
      setActive(null);
      await refresh();
    } catch {
      Alert.alert('Could not update role', API_USER_MESSAGE);
    }
  };

  const toggleTag = async (roleId: string, assigned: boolean) => {
    if (!active) return;
    try {
      if (assigned) {
        await removeClubRole(clubId, roleId, active.userId);
      } else {
        await assignClubRole(clubId, roleId, active.userId);
      }
      setActive(null);
      await refresh();
    } catch {
      Alert.alert('Could not update member tag', API_USER_MESSAGE);
    }
  };

  if (loading && !club) {
    return <ClubScreenLoading title="Members" onBack={() => navigation.goBack()} />;
  }

  return (
    <AppBackdrop>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: spacing.xl,
          paddingTop: insets.top + spacing.md,
          paddingBottom: insets.bottom + spacing.xxl,
          gap: spacing.lg,
        }}
      >
        <ScreenHeader title="Members" kicker={`${club?.members.length ?? 0} PEOPLE`} onBack={() => navigation.goBack()} />
        <SearchBar value={query} onChangeText={setQuery} placeholder="Search members" />
        {groups.some(([, rows]) => rows.length) ? groups.map(([label, rows]) => rows.length ? (
          <View key={label} style={{ gap: spacing.sm }}>
            <Text style={typography.kicker}>{label} · {rows.length}</Text>
            <Card padded>
              {rows.map((member) => (
                <MemberRow
                  key={member.id}
                  member={member}
                  onPress={() => navigation.navigate('UserProfile', { userId: member.userId })}
                  action={canAct(member) ? () => setActive(member) : undefined}
                />
              ))}
            </Card>
          </View>
        ) : null) : (
          <EmptyState icon="people-outline" title="No members found" body="Try another search." />
        )}
      </ScrollView>
      <Sheet visible={active != null} onClose={() => setActive(null)} title={active?.user.name} kicker={active?.role}>
        {active && canChangePrimaryRole(active) && active.role === 'MEMBER' ? (
          <ListRow icon="ribbon-outline" title="Promote to officer" onPress={() => void updateRole('OFFICER')} />
        ) : null}
        {active && canChangePrimaryRole(active) && active.role === 'OFFICER' && club?.myRole === 'OWNER' ? (
          <ListRow icon="key-outline" title="Promote to admin" onPress={() => void updateRole('ADMIN')} />
        ) : null}
        {active && canChangePrimaryRole(active) && active.role === 'ADMIN' ? (
          <ListRow icon="arrow-down-circle-outline" title="Demote to officer" onPress={() => void updateRole('OFFICER')} />
        ) : active && canChangePrimaryRole(active) && active.role === 'OFFICER' ? (
          <ListRow icon="arrow-down-circle-outline" title="Demote to member" onPress={() => void updateRole('MEMBER')} />
        ) : null}
        {active && canManageTags(active) ? (
          <View style={{ marginTop: spacing.sm }}>
            <Text style={typography.kicker}>MEMBER TAGS</Text>
            {(club?.roles ?? []).map((role) => {
              const assigned = active.customRoles?.some((item) => item.roleId === role.id) ?? false;
              return (
                <ListRow
                  key={role.id}
                  icon={assigned ? 'checkmark-circle' : 'ellipse-outline'}
                  title={role.name}
                  sub={assigned ? 'Assigned' : 'Not assigned'}
                  onPress={() => void toggleTag(role.id, assigned)}
                />
              );
            })}
          </View>
        ) : null}
        {active && canChangePrimaryRole(active) ? (
          <ListRow
            icon="person-remove-outline"
            title="Remove from club"
            destructive
            last
            onPress={() => {
              Alert.alert(
                'Remove member?',
                `${active.user.name} will lose access to member-only club spaces.`,
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: () => void removeClubMember(clubId, active.userId)
                      .then(() => {
                        setActive(null);
                        return refresh();
                      })
                      .catch(() => Alert.alert('Could not remove member', API_USER_MESSAGE)),
                  },
                ],
              );
            }}
          />
        ) : null}
      </Sheet>
    </AppBackdrop>
  );
}
