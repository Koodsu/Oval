import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootStackParamList } from '../../App';
import { fetchFeed, getApiErrorMessage, joinPod, trackEvent } from '../api';
import { useAuth } from '../context/AuthContext';
import { INTEREST_TAG_META } from '../constants/interestTags';
import { formatDateTime } from '../utils/format';
import { Pod } from '../types';
import {
  AppBackdrop,
  Avatar,
  Button,
  Card,
  Chip,
  EmptyState,
  SkeletonCard,
  Sticker,
} from '../components/ui';
import {
  DOCK_CLEARANCE,
  Theme,
  createThemedStyles,
  fonts,
  radii,
  spacing,
  useTheme,
} from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'FirstPlan'> & {
  onDone: () => void;
};

export default function FirstPlanScreen({ navigation, onDone }: Props) {
  const { user } = useAuth();
  const { colors, typography } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const [pods, setPods] = React.useState<Pod[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busyPodId, setBusyPodId] = React.useState<string | null>(null);
  const completedRef = React.useRef(false);

  const complete = React.useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    onDone();
    navigation.replace('MainTabs', { screen: 'Home' });
  }, [navigation, onDone]);

  React.useEffect(() => {
    let active = true;
    void trackEvent('onboarding.started');
    // Over-fetch: the top of the feed can be full/locked pods, and this screen
    // should still show up to 3 joinable ones.
    fetchFeed({ limit: 10 })
      .then((feed) => {
        if (!active) return;
        const joinable = feed.filter((pod) => pod.status === 'FORMING' && pod.members.length < pod.maxMembers).slice(0, 3);
        if (joinable.length === 0) {
          void trackEvent('onboarding.pods_shown', { count: 0 });
          complete();
          return;
        }
        setPods(joinable);
        void trackEvent('onboarding.pods_shown', { count: joinable.length });
      })
      .catch(() => {
        if (active) complete();
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [complete]);

  const handleJoin = async (pod: Pod) => {
    setBusyPodId(pod.id);
    try {
      await joinPod(pod.id);
      void trackEvent('onboarding.first_pod_joined', { podId: pod.id });
      completedRef.current = true;
      onDone();
      // Reset with MainTabs underneath so the user can back out of the pod
      // into the app — a bare replace() would leave PodDetail as the only
      // route (no tab bar, dead back button).
      navigation.reset({
        index: 1,
        routes: [{ name: 'MainTabs' }, { name: 'PodDetail', params: { podId: pod.id } }],
      });
    } catch (error) {
      Alert.alert('Could not join pod', getApiErrorMessage(error));
    } finally {
      setBusyPodId(null);
    }
  };

  const handleSkip = () => {
    void trackEvent('onboarding.skipped');
    complete();
  };

  const interests = user?.interestTags ?? [];

  return (
    <AppBackdrop>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + DOCK_CLEARANCE },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.masthead}>
          <Text style={[typography.kicker, { color: colors.accentText }]}>This week, near you</Text>
          <Text style={styles.title}>Pick your first plan.</Text>
          <Text style={[typography.body, { color: colors.sub }]}>
            A few live pods based on what you told us. Join one now or browse later.
          </Text>
        </View>

        {interests.length ? (
          <View style={styles.chipWrap}>
            {interests.slice(0, 6).map((tag) => (
              <Chip
                key={tag}
                label={INTEREST_TAG_META[tag]?.label ?? tag}
                selected
                tint={colors.primarySoft}
              />
            ))}
          </View>
        ) : null}

        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard compact />
          </>
        ) : pods.length ? (
          <View style={styles.podList}>
            {pods.map((pod, index) => {
              const topPick = index === 0;
              const spotsLeft = Math.max(0, pod.maxMembers - pod.members.length);
              return (
                <Card key={pod.id} padded borderColor={topPick ? colors.primary : undefined}>
                  <View style={styles.cardTop}>
                    <Sticker
                      label={topPick ? 'Best match' : pod.activity?.category ?? 'Open'}
                      tint={topPick ? colors.primary : colors.surfaceAlt}
                      textColor={topPick ? colors.onPrimary : colors.ink}
                      small
                      tilt={topPick ? -2 : 2}
                    />
                    <Text style={styles.spots}>{spotsLeft} spots left</Text>
                  </View>
                  <Text style={typography.title}>{pod.activity?.title ?? 'Pod'}</Text>
                  <Text style={[typography.caption, { marginTop: 4 }]}>
                    {formatDateTime(pod.meetupTime)} · {pod.location}
                  </Text>
                  <View style={styles.memberRow}>
                    {pod.members.slice(0, 4).map((member, memberIndex) => (
                      <Avatar
                        key={member.id}
                        name={member.user.name}
                        uri={member.user.avatarUrl}
                        size={28}
                        tilt={memberIndex % 2 === 0 ? -2 : 2}
                      />
                    ))}
                    <Text style={[typography.captionSmall, { color: colors.sub }]}>
                      {pod.members.length} of {pod.maxMembers} in
                    </Text>
                  </View>
                  <Button
                    label={topPick ? 'Join this pod' : 'Join'}
                    onPress={() => void handleJoin(pod)}
                    loading={busyPodId === pod.id}
                    disabled={Boolean(busyPodId)}
                    variant={topPick ? 'primary' : 'secondary'}
                    style={{ marginTop: spacing.md, alignSelf: 'flex-start' }}
                  />
                </Card>
              );
            })}
          </View>
        ) : (
          <EmptyState
            icon="compass"
            title="No pods right now"
            body="Oval will take you to the app instead."
            actionLabel="Continue"
            onAction={complete}
          />
        )}

        {!loading && pods.length ? (
          <Button label="Skip for now" variant="ghost" onPress={handleSkip} />
        ) : null}
      </ScrollView>
    </AppBackdrop>
  );
}

const useStyles = createThemedStyles((t: Theme) => ({
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
  },
  masthead: {
    gap: spacing.sm,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 30,
    lineHeight: 36,
    color: t.colors.ink,
  },
  chipWrap: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: spacing.sm,
  },
  podList: {
    gap: spacing.md,
  },
  cardTop: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  spots: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: t.colors.sub,
  },
  memberRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    marginTop: spacing.md,
  },
}));
