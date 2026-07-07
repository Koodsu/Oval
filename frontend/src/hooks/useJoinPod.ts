import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import {
  ApiError,
  createPod,
  getApiErrorMessage,
  getMyPods,
  joinPod as joinPodApi,
  joinWaitlist,
} from '../api';
import type { Pod } from '../types';

import { toast } from '../lib/toast';
type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * Shared inline-join behavior (02 §1): join → haptic + navigate to the pod.
 * On the two 409 paths it opens the recovery flows instead of a dead-end
 * error: full pod → waitlist or twin (04 §2d); duplicate activity → open the
 * pod you're already in.
 */
export function useJoinPod(onJoined?: (pod: Pod) => void) {
  const navigation = useNavigation<Nav>();
  const [busyPodId, setBusyPodId] = useState<string | null>(null);

  const offerWaitlistAndTwin = useCallback(
    (pod: Pod) => {
      Alert.alert(
        'This pod is full',
        'Grab the next open spot, or start a twin with the same plan 30 minutes later.',
        [
          { text: 'Not now', style: 'cancel' },
          {
            text: 'Join waitlist',
            onPress: () => {
              void joinWaitlist(pod.id)
                .then(() => toast.success('On the list', "We'll ping you the moment a spot opens."))
                .catch((error) =>
                  toast.error('Could not join waitlist', getApiErrorMessage(error)),
                );
            },
          },
          {
            text: 'Start a twin',
            onPress: () => {
              void (async () => {
                try {
                  const twinTime = new Date(pod.meetupTime);
                  twinTime.setMinutes(twinTime.getMinutes() + 30);
                  const twin = await createPod(pod.activityId, {
                    location: pod.location,
                    meetupTime: twinTime.toISOString(),
                    minMembers: 2,
                    maxMembers: pod.maxMembers,
                    visibility: 'public',
                    twinFromPodId: pod.id,
                    template: 'twin',
                  });
                  navigation.navigate('PodDetail', { podId: twin.id, justCreated: true });
                } catch (error) {
                  toast.error('Could not start twin', getApiErrorMessage(error));
                }
              })();
            },
          },
        ],
      );
    },
    [navigation],
  );

  const offerExistingPod = useCallback(
    async (pod: Pod) => {
      try {
        const mine = await getMyPods();
        const existing = mine.find(
          (candidate) =>
            candidate.activityId === pod.activityId &&
            (candidate.status === 'FORMING' || candidate.status === 'LOCKED'),
        );
        if (existing) {
          Alert.alert(
            'You already have this plan',
            `You're in an active ${existing.activity?.title ?? 'pod'} pod. One plan per activity at a time.`,
            [
              { text: 'OK', style: 'cancel' },
              {
                text: 'Open my pod',
                onPress: () => navigation.navigate('PodDetail', { podId: existing.id }),
              },
            ],
          );
          return;
        }
      } catch {
        // fall through to the generic copy
      }
      toast.error('Already in one', 'You are already in an active pod for this activity.');
    },
    [navigation],
  );

  const join = useCallback(
    async (pod: Pod): Promise<boolean> => {
      if (busyPodId) return false;
      setBusyPodId(pod.id);
      try {
        const joined = await joinPodApi(pod.id);
        try {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)?.catch?.(
            () => {},
          );
        } catch {
          // haptics unavailable (web/simulator) — never block the join
        }
        onJoined?.(joined);
        navigation.navigate('PodDetail', { podId: pod.id });
        return true;
      } catch (error) {
        const status = error instanceof ApiError ? error.status : undefined;
        const message = getApiErrorMessage(error);
        if (status === 409 && /full/i.test(message)) {
          offerWaitlistAndTwin(pod);
        } else if (status === 409 && /already in an active pod/i.test(message)) {
          void offerExistingPod(pod);
        } else {
          toast.error('Could not join pod', message);
        }
        return false;
      } finally {
        setBusyPodId(null);
      }
    },
    [busyPodId, navigation, offerExistingPod, offerWaitlistAndTwin, onJoined],
  );

  return { join, busyPodId };
}
