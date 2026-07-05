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
  Button,
  Card,
  Chip,
  EmptyState,
  SkeletonCard,
} from '../components/ui';
import {
  Theme,
  createThemedStyles,
  fonts,
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
      <View style={styles.screen}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.masthead}>
            <Text style={[typography.kicker, { color: colors.accentText }]}>
              This week, near you
            </Text>
            <Text style={styles.title}>Pick your first plan.</Text>
            <Text style={[typography.caption, { color: colors.sub }]} numberOfLines={2}>
              A few live pods based on what you told us. Join one now or browse later.
            </Text>
          </View>

          {interests.length ? (
            <View style={styles.chipWrap}>
              {interests.slice(0, 4).map((tag) => (
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
              <SkeletonCard compact />
              <SkeletonCard compact />
              <SkeletonCard compact />
            </>
          ) : pods.length ? (
            <View style={styles.podList}>
              {pods.map((pod, index) => {
                const topPick = index === 0;
                const spotsLeft = Math.max(0, pod.maxMembers - pod.members.length);
                return (
                  <Card key={pod.id} padded borderColor={topPick ? colors.primary : undefined}>
                    <View style={styles.podRow}>
                      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                        {topPick ? (
                          <Text style={[typography.kicker, { color: colors.accentText }]}>
                            BEST MATCH
                          </Text>
                        ) : null}
                        <Text style={typography.heading} numberOfLines={1}>
                          {pod.activity?.title ?? 'Pod'}
                        </Text>
                        <Text style={typography.captionSmall} numberOfLines={1}>
                          {formatDateTime(pod.meetupTime)} · {pod.location}
                        </Text>
                        <Text style={[typography.captionSmall, { color: colors.sub }]}>
                          {pod.members.length} of {pod.maxMembers} in · {spotsLeft}{' '}
                          {spotsLeft === 1 ? 'spot' : 'spots'} left
                        </Text>
                      </View>
                      <Button
                        label="Join"
                        size="sm"
                        onPress={() => void handleJoin(pod)}
                        loading={busyPodId === pod.id}
                        disabled={Boolean(busyPodId)}
                        variant={topPick ? 'primary' : 'secondary'}
                      />
                    </View>
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
        </ScrollView>

        {/* Pinned footer: skipping must be visible without scrolling — users
            were missing it entirely when it lived at the end of the scroll. */}
        {!loading && pods.length ? (
          <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]}>
            <Button label="Skip for now" variant="ghost" onPress={handleSkip} />
          </View>
        ) : null}
      </View>
    </AppBackdrop>
  );
}

const useStyles = createThemedStyles((t: Theme) => ({
  screen: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  masthead: {
    gap: spacing.xs,
  },
  title: {
    fontFamily: fonts.display,
    fontWeight: '800' as const,
    fontSize: 26,
    lineHeight: 31,
    color: t.colors.ink,
  },
  chipWrap: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: spacing.sm,
  },
  podList: {
    gap: spacing.sm,
  },
  podRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
  },
}));
