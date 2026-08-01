import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  API_USER_MESSAGE,
  approveActivityRequest,
  getAdminActivityRequests,
  rejectActivityRequest,
} from '../api';
import type { RootStackParamList } from '../../App';
import type { ActivityRequest } from '../types';
import {
  AppBackdrop,
  Banner,
  Button,
  Card,
  EmptyState,
  ScreenHeader,
  Segmented,
  SkeletonCard,
  Tag,
  accentForSeed,
} from '../components/ui';
import { Theme, createThemedStyles, radii, spacing, useTheme } from '../theme';
import { toast } from '../lib/toast';

type Props = NativeStackScreenProps<RootStackParamList, 'AdminActivityRequests'>;
type ReviewTab = 'pending' | 'reviewed';

function relativeAge(iso: string) {
  const elapsed = Math.max(0, Date.now() - new Date(iso).getTime());
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function AdminActivityRequestsScreen({
  navigation,
  previewData,
}: Props & {
  previewData?: { pending: ActivityRequest[]; reviewed: ActivityRequest[] };
}) {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<ReviewTab>('pending');
  const [requests, setRequests] = useState<ActivityRequest[]>(previewData?.pending ?? []);
  const [loading, setLoading] = useState(!previewData);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (previewData) {
      setRequests(tab === 'pending' ? previewData.pending : previewData.reviewed);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await getAdminActivityRequests(tab);
      setRequests(response.requests);
      setWarning(null);
    } catch {
      setWarning(API_USER_MESSAGE);
    } finally {
      setLoading(false);
    }
  }, [previewData, tab]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const approve = async (request: ActivityRequest) => {
    setBusyId(request.id);
    try {
      await approveActivityRequest(request.id);
      setRequests((current) => current.filter((row) => row.id !== request.id));
      toast.success('Activity approved', `${request.title} is now in the catalog.`);
    } catch {
      toast.error('Could not approve request', API_USER_MESSAGE);
    } finally {
      setBusyId(null);
    }
  };

  const reject = (request: ActivityRequest) => {
    Alert.alert('Reject request?', request.title, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject',
        style: 'destructive',
        onPress: () => {
          setBusyId(request.id);
          void rejectActivityRequest(request.id)
            .then(() => {
              setRequests((current) => current.filter((row) => row.id !== request.id));
              toast.success('Request rejected', 'It remains available in Reviewed.');
            })
            .catch(() => toast.error('Could not reject request', API_USER_MESSAGE))
            .finally(() => setBusyId(null));
        },
      },
    ]);
  };

  return (
    <AppBackdrop>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xxl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader
          title="Activity requests"
          onBack={() => navigation.goBack()}
          right={
            <View style={[styles.countPill, { backgroundColor: colors.surfaceAlt }]}>
              <Text style={typography.captionSmall}>
                {tab === 'pending' ? requests.length : 'History'}
                {tab === 'pending' ? ' pending' : ''}
              </Text>
            </View>
          }
        />
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'pending', label: 'Pending' },
            { value: 'reviewed', label: 'Reviewed' },
          ]}
        />
        {warning ? <Banner kind="error" message={warning} /> : null}
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : requests.length ? (
          <View style={{ gap: spacing.md }}>
            {requests.map((request) => {
              const accent = accentForSeed(colors, request.category);
              return (
                <Card key={request.id} padded>
                  <View style={styles.cardHeader}>
                    <View style={{ flex: 1, minWidth: 0, gap: spacing.xs }}>
                      <Text style={typography.title} numberOfLines={2}>
                        {request.title}
                      </Text>
                      <View style={{ alignSelf: 'flex-start' }}>
                        <Tag label={request.category} tint={accent.soft} />
                      </View>
                    </View>
                    <Text style={typography.captionSmall}>{relativeAge(request.createdAt)}</Text>
                  </View>
                  <View style={styles.metaStack}>
                    <Text style={typography.captionSmall}>
                      Requested by {request.requester?.name ?? request.user?.name ?? 'Student'}
                    </Text>
                    {request.defaultLocation ? (
                      <Text style={typography.captionSmall}>
                        Suggested location: {request.defaultLocation}
                      </Text>
                    ) : null}
                  </View>
                  {request.description ? (
                    <Text style={[typography.caption, { marginTop: spacing.sm }]}>
                      {request.description}
                    </Text>
                  ) : null}
                  {tab === 'pending' ? (
                    <View style={styles.actions}>
                      <Button
                        label="Approve"
                        size="sm"
                        loading={busyId === request.id}
                        onPress={() => void approve(request)}
                        style={{ flex: 1 }}
                      />
                      <Button
                        label="Reject"
                        size="sm"
                        variant="secondary"
                        disabled={busyId === request.id}
                        onPress={() => reject(request)}
                        style={{ flex: 1 }}
                      />
                    </View>
                  ) : (
                    <View
                      style={[
                        styles.reviewedNote,
                        {
                          backgroundColor:
                            request.status === 'APPROVED'
                              ? colors.successSoft
                              : colors.dangerSoft,
                        },
                      ]}
                    >
                      <Text style={typography.subheading}>
                        {request.status === 'APPROVED' ? 'Approved' : 'Rejected'}
                      </Text>
                      {request.reviewNote ? (
                        <Text style={[typography.captionSmall, { flex: 1 }]}>
                          {request.reviewNote}
                        </Text>
                      ) : null}
                    </View>
                  )}
                </Card>
              );
            })}
          </View>
        ) : tab === 'pending' ? (
          <EmptyState
            icon="clipboard-outline"
            title="All caught up"
            body="No activity requests need review."
            actionLabel="View reviewed"
            onAction={() => setTab('reviewed')}
          />
        ) : (
          <EmptyState
            icon="time-outline"
            title="No review history"
            body="Approved and rejected requests will appear here."
            actionLabel="View pending"
            onAction={() => setTab('pending')}
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
  countPill: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: spacing.md,
  },
  metaStack: {
    gap: 3,
    marginTop: spacing.sm,
  },
  actions: {
    flexDirection: 'row' as const,
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  reviewedNote: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radii.sm,
  },
}));
