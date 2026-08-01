import React from 'react';
import { ActivityIndicator, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import type { RootStackParamList } from '../../App';
import { getApiErrorMessage, getMyClubs, PUBLIC_SITE_URL, trackEvent } from '../api';
import type { MyClubMembershipRow } from '../types';
import { BORDER_W, fonts, radii, spacing, useTheme } from '../theme';
import { Banner, Sheet } from './ui';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function canCreateMeeting(row: MyClubMembershipRow) {
  return row.role === 'OWNER' || row.role === 'ADMIN' || row.role === 'OFFICER';
}

function CreateRow({
  icon,
  title,
  sub,
  onPress,
  disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  sub: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={title}
      hitSlop={8}
      style={({ pressed }) => [
        styles.row,
        { opacity: disabled ? 0.45 : pressed ? 0.62 : 1 },
      ]}
    >
      <View
        style={[
          styles.iconWell,
          { backgroundColor: colors.primarySoft, borderColor: colors.border },
        ]}
      >
        <Ionicons name={icon} size={19} color={colors.accentText} />
      </View>
      <View style={styles.copy}>
        <Text style={[styles.title, { color: colors.ink }]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[styles.sub, { color: colors.sub }]} numberOfLines={1}>
          {sub}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={17} color={colors.sub} />
    </Pressable>
  );
}

export default function CreateSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const navigation = useNavigation<Nav>();
  const { colors } = useTheme();
  const [clubs, setClubs] = React.useState<MyClubMembershipRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [choosingClub, setChoosingClub] = React.useState(false);

  React.useEffect(() => {
    if (!visible) {
      setChoosingClub(false);
      return;
    }

    let active = true;
    setLoading(true);
    getMyClubs()
      .then((rows) => {
        if (!active) return;
        setClubs(rows.filter(canCreateMeeting));
        setError(null);
      })
      .catch((loadError) => {
        if (!active) return;
        setError(getApiErrorMessage(loadError, "Couldn't load your clubs."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [visible]);

  const closeThen = React.useCallback(
    (action: () => void) => {
      onClose();
      requestAnimationFrame(action);
    },
    [onClose],
  );

  const openActivities = () => {
    closeThen(() => {
      navigation.navigate('MainTabs', {
        screen: 'Explore',
      });
    });
  };

  const openClubMeeting = (clubId: string) => {
    closeThen(() => {
      navigation.navigate('ClubEvents', { clubId, startCreate: true });
    });
  };

  const shareInvite = async () => {
    try {
      const result = await Share.share({
        title: 'Oval',
        // Link lives in `url` only — putting it in `message` too makes iOS
        // texts show it twice, and only the first renders as the rich tappable card.
        message: 'Join me on Oval!',
        url: PUBLIC_SITE_URL,
      });
      // Only count real shares — iOS reports dismissedAction when the user
      // closes the sheet without sharing (Android always reports shared).
      if (result.action !== Share.dismissedAction) {
        void trackEvent('invite.shared', { surface: 'create_sheet' });
      }
      onClose();
    } catch (shareError) {
      setError(getApiErrorMessage(shareError, "Couldn't open sharing."));
    }
  };

  const meetingSub =
    clubs.length === 0
      ? 'Available to club officers and admins'
      : clubs.length === 1
        ? clubs[0]?.club.name ?? 'Choose a club'
        : `${clubs.length} clubs available`;

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={choosingClub ? 'Choose club' : 'Create'}
      kicker="Oval"
      scrollable={choosingClub && clubs.length > 5}
    >
      <View style={styles.wrap}>
        {error ? <Banner message={error} kind="info" /> : null}
        {choosingClub ? (
          clubs.map((row) => (
            <CreateRow
              key={row.club.id}
              icon="calendar-outline"
              title={row.club.name}
              sub="Plan a club meeting"
              onPress={() => openClubMeeting(row.club.id)}
            />
          ))
        ) : (
          <>
            <CreateRow
              icon="add-circle-outline"
              title="Start a pod"
              sub="Pick an activity and open a plan"
              onPress={openActivities}
            />
            <CreateRow
              icon="calendar-outline"
              title="Plan a club meeting"
              sub={loading ? 'Checking your clubs' : meetingSub}
              disabled={loading || clubs.length === 0}
              onPress={() => {
                if (clubs.length === 1 && clubs[0]) {
                  openClubMeeting(clubs[0].club.id);
                } else {
                  setChoosingClub(true);
                }
              }}
            />
            <CreateRow
              icon="person-add-outline"
              title="Invite a friend"
              sub="Share Oval with someone"
              onPress={() => void shareInvite()}
            />
            {loading ? (
              <ActivityIndicator color={colors.accentText} style={styles.loader} />
            ) : null}
          </>
        )}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  row: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  iconWell: {
    width: 42,
    height: 42,
    borderRadius: radii.md,
    borderWidth: BORDER_W,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontFamily: fonts.semibold,
    fontWeight: '600',
    fontSize: 15,
  },
  sub: {
    fontFamily: fonts.medium,
    fontWeight: '500',
    fontSize: 12,
    marginTop: 2,
  },
  loader: {
    alignSelf: 'center',
    marginTop: spacing.sm,
  },
});
