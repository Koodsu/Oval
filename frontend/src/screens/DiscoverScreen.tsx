import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { MainTabParamList } from '../../App';
import { Segmented } from '../components/ui';
import { spacing, useTheme } from '../theme';
import ExploreScreen from './ExploreScreen';
import ClubsHomeScreen from './clubs/ClubsHomeScreen';

type Segment = 'activities' | 'clubs';

export default function DiscoverScreen() {
  const route = useRoute<RouteProp<MainTabParamList, 'Discover'>>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [segment, setSegment] = React.useState<Segment>(
    route.params?.segment ?? 'activities',
  );
  // Mount the clubs segment lazily, then keep BOTH segments mounted and toggle
  // visibility — this preserves each segment's scroll position (02 §3).
  const [clubsMounted, setClubsMounted] = React.useState(segment === 'clubs');

  React.useEffect(() => {
    if (route.params?.segment) {
      setSegment(route.params.segment);
    }
  }, [route.params?.segment]);

  React.useEffect(() => {
    if (segment === 'clubs') setClubsMounted(true);
  }, [segment]);

  return (
    <View style={[styles.wrap, { backgroundColor: colors.bg }]}>
      <View
        style={[
          styles.segmentWrap,
          { backgroundColor: colors.bg, paddingTop: insets.top + spacing.sm },
        ]}
      >
        <Segmented<Segment>
          value={segment}
          onChange={setSegment}
          options={[
            { value: 'activities', label: 'Activities' },
            { value: 'clubs', label: 'Clubs' },
          ]}
        />
      </View>
      <View style={styles.body}>
        <View style={[styles.segmentBody, segment !== 'activities' && styles.hidden]}>
          <ExploreScreen startCreate={route.params?.startCreate} embedded />
        </View>
        {clubsMounted ? (
          <View style={[styles.segmentBody, segment !== 'clubs' && styles.hidden]}>
            <ClubsHomeScreen embedded />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
  },
  segmentWrap: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.sm,
  },
  body: {
    flex: 1,
  },
  segmentBody: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  hidden: {
    display: 'none',
  },
});
