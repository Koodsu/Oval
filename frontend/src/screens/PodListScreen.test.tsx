import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import PodListScreen from './PodListScreen';
import { Pod } from '../types';

type PodListProps = React.ComponentProps<typeof PodListScreen>;

jest.mock('../api', () => ({
  getPodsByActivity: jest.fn(),
  joinPod: jest.fn(),
  joinWaitlist: jest.fn(),
}));

jest.mock('../components/FadeIn', () => ({ children }: { children: React.ReactNode }) => children);

jest.mock('../components/GradientButton', () => {
  const React = require('react');
  const { TouchableOpacity, Text } = require('react-native');
  return ({ title, onPress }: { title: string; onPress: () => void }) =>
    React.createElement(TouchableOpacity, { onPress }, React.createElement(Text, null, title));
});

jest.mock('../components/PodCard', () => {
  const React = require('react');
  const { TouchableOpacity, Text, View } = require('react-native');
  return ({ onJoin, onView, isMember }: { onJoin: () => void; onView: () => void; isMember: boolean }) =>
    React.createElement(
      View,
      { testID: 'pod-card' },
      isMember
        ? React.createElement(TouchableOpacity, { onPress: onView }, React.createElement(Text, null, 'View Pod'))
        : React.createElement(TouchableOpacity, { onPress: onJoin }, React.createElement(Text, null, 'Join Pod')),
    );
});

jest.mock('../components/GuidelinesModal', () => {
  const React = require('react');
  const { View, TouchableOpacity, Text } = require('react-native');
  return ({
    visible,
    onAccept,
  }: {
    visible: boolean;
    onAccept: () => void;
  }) =>
    visible
      ? React.createElement(
          View,
          { testID: 'guidelines-modal' },
          React.createElement(
            TouchableOpacity,
            { testID: 'guidelines-accept', onPress: onAccept },
            React.createElement(Text, null, 'Accept'),
          ),
        )
      : null;
});

const mockNavigate = jest.fn();
const mockReplace = jest.fn();

const mockAuth = {
  user: { id: 'user-1', name: 'Alice', email: 'a@test.com' },
  hasAcceptedGuidelines: false,
  acceptGuidelines: jest.fn().mockResolvedValue(undefined),
};

jest.mock('../context/AuthContext', () => ({
  useAuth: () => mockAuth,
}));

import { getPodsByActivity, joinPod } from '../api';

const mockGetPodsByActivity = getPodsByActivity as jest.Mock;
const mockJoinPod = joinPod as jest.Mock;

const openPod: Pod = {
  id: 'pod-open',
  activityId: 'act-1',
  meetupTime: new Date(Date.now() + 86400000).toISOString(),
  location: 'Library',
  locationType: 'public',
  minMembers: 2,
  maxMembers: 4,
  status: 'FORMING',
  creatorId: 'other',
  createdAt: new Date().toISOString(),
  activity: {
    id: 'act-1',
    title: 'Study',
    description: 'd',
    category: 'Academic',
    defaultLocation: 'Library',
    createdAt: new Date().toISOString(),
  },
  members: [{ id: 'm1', userId: 'other', joinedAt: new Date().toISOString(), user: { id: 'other', name: 'Bob' } }],
};

function buildProps() {
  return {
    navigation: { navigate: mockNavigate, replace: mockReplace, setOptions: jest.fn() },
    route: {
      key: 'r',
      name: 'PodList' as const,
      params: { activityId: 'act-1', activityTitle: 'Study', activityCategory: 'Academic' },
    },
  };
}

describe('PodListScreen — pod terms', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.hasAcceptedGuidelines = false;
    mockAuth.acceptGuidelines = jest.fn().mockResolvedValue(undefined);
    mockGetPodsByActivity.mockResolvedValue([openPod]);
    mockJoinPod.mockResolvedValue({ id: 'pod-open', members: [] });
  });

  it('navigates to CreatePod on Start a Pod without showing guidelines when terms not accepted', async () => {
    render(<PodListScreen {...(buildProps() as PodListProps)} />);

    await waitFor(() => expect(screen.getByText('Start a Pod')).toBeTruthy());

    fireEvent.press(screen.getByText('Start a Pod'));

    expect(mockNavigate).toHaveBeenCalledWith('CreatePod', {
      activityId: 'act-1',
      activityTitle: 'Study',
      activityCategory: 'Academic',
    });
    expect(screen.queryByTestId('guidelines-modal')).toBeNull();
  });

  it('shows guidelines modal when joining a pod and terms not accepted', async () => {
    render(<PodListScreen {...(buildProps() as PodListProps)} />);

    await waitFor(() => expect(screen.getByText('Join Pod')).toBeTruthy());

    fireEvent.press(screen.getByText('Join Pod'));

    expect(screen.getByTestId('guidelines-modal')).toBeTruthy();
    expect(mockJoinPod).not.toHaveBeenCalled();
  });

  it('calls acceptGuidelines then joinPod when user accepts from modal', async () => {
    render(<PodListScreen {...(buildProps() as PodListProps)} />);

    await waitFor(() => expect(screen.getByText('Join Pod')).toBeTruthy());
    fireEvent.press(screen.getByText('Join Pod'));
    await waitFor(() => expect(screen.getByTestId('guidelines-accept')).toBeTruthy());

    fireEvent.press(screen.getByTestId('guidelines-accept'));

    await waitFor(() => {
      expect(mockAuth.acceptGuidelines).toHaveBeenCalled();
      expect(mockJoinPod).toHaveBeenCalledWith('pod-open');
    });
  });
});
