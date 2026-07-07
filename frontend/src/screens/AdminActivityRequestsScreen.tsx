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
  ListRow,
  ScreenHeader,
  SkeletonCard,
} from '../components/ui';
import { spacing, useTheme } from '../theme';

import { toast } from '../lib/toast';
type Props = NativeStackScreenProps<RootStackParamList, 'AdminActivityRequests'>;

export default function AdminActivityRequestsScreen({ navigation }: Props) {
  const { colors, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const [requests, setRequests] = useState<ActivityRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await getAdminActivityRequests();
      setRequests(response.requests);
      setWarning(null);
    } catch {
      setWarning(API_USER_MESSAGE);
    } finally {
      setLoading(false);
    }
  }, []);

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
            .then(() => setRequests((current) => current.filter((row) => row.id !== request.id)))
            .catch(() => toast.error('Could not reject request', API_USER_MESSAGE))
            .finally(() => setBusyId(null));
        },
      },
    ]);
  };

  return (
    <AppBackdrop>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.xl,
          paddingTop: insets.top + spacing.md,
          paddingBottom: insets.bottom + spacing.xxl,
          gap: spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader title="Activity Requests" onBack={() => navigation.goBack()} />
        {warning ? <Banner kind="error" message={warning} /> : null}
        {loading ? (
          <>
            <SkeletonCard compact />
            <SkeletonCard compact />
          </>
        ) : requests.length ? (
          <View style={{ gap: spacing.md }}>
            {requests.map((request) => (
              <Card key={request.id}>
                <ListRow
                  icon="sparkles-outline"
                  title={request.title}
                  sub={`${request.category} · ${request.requester?.name ?? 'Student'}${request.defaultLocation ? ` · ${request.defaultLocation}` : ''}`}
                  tint={colors.amberSoft}
                  right={
                    <View style={{ gap: spacing.xs, alignItems: 'flex-end' }}>
                      <Button
                        label="Approve"
                        size="sm"
                        icon="checkmark"
                        loading={busyId === request.id}
                        onPress={() => void approve(request)}
                      />
                      <Button
                        label="Reject"
                        size="sm"
                        variant="ghost"
                        onPress={() => reject(request)}
                      />
                    </View>
                  }
                  last
                />
                {request.description ? (
                  <Text style={[typography.caption, { color: colors.sub, paddingBottom: spacing.md }]}>
                    {request.description}
                  </Text>
                ) : null}
              </Card>
            ))}
          </View>
        ) : (
          <EmptyState
            icon="checkmark-done"
            title="Queue clear"
            body="No pending activity requests."
            actionLabel="Refresh"
            onAction={() => void load()}
          />
        )}
      </ScrollView>
    </AppBackdrop>
  );
}
