import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  AppBackdrop,
  AvatarStack,
  Banner,
  Button,
  Card,
  Chip,
  ContentImage,
  Field,
  ScreenHeader,
  SectionHeader,
  Segmented,
  SkeletonRow,
  SpotIllustration,
  StateActions,
  StateCopy,
  useDockClearance,
} from '../components/ui';
import { ClubEmptyState, ClubIdentityHero } from '../components/clubs';
import { captureException, monitoringEnabled } from '../lib/monitoring';
import { spacing, useTheme } from '../theme';

const welcomeSpot = require('../../assets/illustrations/spot/onboarding/01-welcome.png');

/**
 * Deterministic, development-only component lab used for screenshot QA.
 * It contains no production social proof and is reachable only when
 * EXPO_PUBLIC_UI_PREVIEW=foundation is set at build/start time.
 */
/**
 * Dev-only Sentry smoke test.
 *
 * Renders nothing unless a DSN is configured, so it is inert in normal dev and
 * in any build without EXPO_PUBLIC_SENTRY_DSN set.
 *
 * "Send handled error" goes through captureException() — the same path
 * ErrorBoundary uses. Appears in Sentry within a few seconds.
 *
 * "Throw unhandled error" throws during render, which ErrorBoundary catches and
 * reports. This is the more realistic test: it exercises the native crash path
 * and is what a real user-facing crash looks like.
 *
 * If nothing arrives in Sentry: confirm the DSN is set, and remember events are
 * tagged with EXPO_PUBLIC_ENV, so a local run shows up under "development".
 */
function SentryTestPanel() {
  const { typography } = useTheme();
  const [shouldThrow, setShouldThrow] = React.useState(false);

  if (shouldThrow) {
    throw new Error('Oval Sentry smoke test — unhandled render error');
  }

  if (!monitoringEnabled) return null;

  return (
    <View style={{ gap: spacing.sm }}>
      <SectionHeader title="Sentry smoke test (dev only)" />
      <Text style={typography.caption}>
        Events report to the environment named by EXPO_PUBLIC_ENV.
      </Text>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Button
          label="Send handled error"
          size="sm"
          onPress={() =>
            captureException(new Error('Oval Sentry smoke test — handled error'), {
              source: 'FoundationPreviewScreen',
            })
          }
          style={styles.flex}
        />
        <Button
          label="Throw unhandled error"
          size="sm"
          variant="secondary"
          onPress={() => setShouldThrow(true)}
          style={styles.flex}
        />
      </View>
    </View>
  );
}

export default function FoundationPreviewScreen() {
  const { colors, typography, preference, setPreference } = useTheme();
  const dockClearance = useDockClearance();
  const [segment, setSegment] = React.useState<'upcoming' | 'past'>('upcoming');

  return (
    <AppBackdrop>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.content, { paddingBottom: dockClearance }]}
          keyboardShouldPersistTaps="handled"
        >
          <ScreenHeader
            title="Campus Pulse"
            kicker="Foundation preview"
            right={
              <Chip
                label={preference === 'dark' ? 'Light' : 'Dark'}
                selected
                onPress={() => setPreference(preference === 'dark' ? 'light' : 'dark')}
              />
            }
          />

          <View style={styles.intro}>
            <Text style={typography.hero}>Made for plans that actually happen.</Text>
            <Text style={typography.body}>
              White canvas, compact hierarchy, solid surfaces, and scarlet reserved for action.
            </Text>
          </View>

          <SentryTestPanel />

          <SectionHeader title="Standardized club system" />
          <ClubIdentityHero
            club={{
              name: 'Photography Club',
              category: 'Arts & Creative',
              emoji: '📷',
              avatarUrl: null,
              isVerified: true,
              members: [{}, {}, {}, {}],
            }}
            role="OWNER"
            onBack={() => {}}
            onActions={() => {}}
          />
          <ClubEmptyState
            variant="chat"
            compact
            title="No announcements yet"
            body="Official club updates will appear here."
            actionLabel="Open club chat"
            onAction={() => {}}
          />

          <Segmented
            value={segment}
            onChange={setSegment}
            options={[
              { value: 'upcoming', label: 'Upcoming' },
              { value: 'past', label: 'Past' },
            ]}
          />

          <Card faceStyle={styles.card}>
            <SectionHeader title="A real content surface" actionLabel="See all" onAction={() => {}} />
            <ContentImage
              seed="outdoors"
              fallbackIcon="trail-sign-outline"
              accessibilityLabel="Activity artwork placeholder"
            />
            <View style={styles.cardCopy}>
              <View style={{ flex: 1 }}>
                <Text style={typography.heading}>Sunrise hike & coffee</Text>
                <Text style={typography.caption}>Saturday · 9:00 AM · The Oval</Text>
              </View>
              <Button label="Join" onPress={() => {}} size="sm" />
            </View>
            <AvatarStack
              names={[{ name: 'A' }, { name: 'B' }, { name: 'C' }]}
              overflowCount={5}
              size={28}
            />
          </Card>

          <View style={styles.chips}>
            <Chip label="All" selected onPress={() => {}} />
            <Chip label="Outdoors" tint={colors.greenSoft} onPress={() => {}} />
            <Chip label="Study" tint={colors.blueSoft} onPress={() => {}} />
            <Chip label="Coffee" tint={colors.amberSoft} onPress={() => {}} />
          </View>

          <View style={styles.buttonRow}>
            <Button label="Primary action" onPress={() => {}} style={styles.flex} />
            <Button
              label="Secondary"
              onPress={() => {}}
              variant="secondary"
              style={styles.flex}
            />
          </View>

          <Field label="Plan title" value="Coffee & catch up" onChangeText={() => {}} />
          <Banner kind="info" message="Live UI copy stays readable on a solid themed surface." />

          <SectionHeader title="Editorial state anatomy" />
          <Card faceStyle={styles.stateCard}>
            <SpotIllustration
              source={welcomeSpot}
              accessibilityLabel="Students welcoming someone into the campus community"
              height={150}
            />
            <StateCopy
              eyebrow="Welcome to Oval"
              title="Your campus is waiting."
              body="Editorial people support the message; they never stand in for real members."
            />
            <StateActions
              primaryLabel="Find your people"
              primaryIcon="search"
              onPrimary={() => {}}
              secondaryLabel="Start a plan"
              onSecondary={() => {}}
            />
          </Card>

          <SectionHeader title="Loading rhythm" />
          <Card>
            <SkeletonRow />
            <SkeletonRow />
          </Card>
        </ScrollView>
      </SafeAreaView>
    </AppBackdrop>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.lg,
  },
  intro: {
    gap: spacing.sm,
  },
  card: {
    gap: spacing.md,
  },
  cardCopy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  flex: {
    flex: 1,
  },
  stateCard: {
    gap: spacing.lg,
    alignItems: 'center',
  },
});
