import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import PodCard from './PodCard';
import { Pod } from '../types';

const basePod: Pod = {
  id: 'pod-1',
  activityId: 'act-1',
  meetupTime: new Date(Date.now() + 86400000).toISOString(),
  location: 'RPAC',
  locationType: 'public',
  minMembers: 2,
  maxMembers: 4,
  status: 'FORMING',
  creatorId: 'u1',
  createdAt: new Date().toISOString(),
  activity: { id: 'act-1', title: 'Basketball', description: 'Pick-up game', category: 'Sports & Fitness', defaultLocation: 'RPAC', createdAt: new Date().toISOString() },
  members: [
    { id: 'm1', userId: 'u1', joinedAt: new Date().toISOString(), user: { id: 'u1', name: 'Alice' } },
    { id: 'm2', userId: 'u2', joinedAt: new Date().toISOString(), user: { id: 'u2', name: 'Bob' } },
  ],
};

describe('PodCard', () => {
  it('renders the activity title', () => {
    render(
      <PodCard pod={basePod} onJoin={jest.fn()} onView={jest.fn()} isJoining={false} isMember={false} />
    );
    expect(screen.getByText('Basketball')).toBeTruthy();
  });

  it('shows "Join Pod" button when user is not a member and pod has space', () => {
    render(
      <PodCard pod={basePod} onJoin={jest.fn()} onView={jest.fn()} isJoining={false} isMember={false} />
    );
    expect(screen.getByText('Join Pod')).toBeTruthy();
  });

  it('shows "View Pod" when user is already a member', () => {
    render(
      <PodCard pod={basePod} onJoin={jest.fn()} onView={jest.fn()} isJoining={false} isMember />
    );
    expect(screen.getByText('View Pod')).toBeTruthy();
  });

  it('calls onView when "View Pod" is pressed', () => {
    const onView = jest.fn();
    render(
      <PodCard pod={basePod} onJoin={jest.fn()} onView={onView} isJoining={false} isMember />
    );
    fireEvent.press(screen.getByText('View Pod'));
    expect(onView).toHaveBeenCalledTimes(1);
  });

  it('calls onJoin when "Join Pod" is pressed', () => {
    const onJoin = jest.fn();
    render(
      <PodCard pod={basePod} onJoin={onJoin} onView={jest.fn()} isJoining={false} isMember={false} />
    );
    fireEvent.press(screen.getByText('Join Pod'));
    expect(onJoin).toHaveBeenCalledTimes(1);
  });

  it('shows "Pod is full" when pod is at capacity, no waitlist handler', () => {
    const fullPod: Pod = {
      ...basePod,
      maxMembers: 2,
    };
    render(
      <PodCard pod={fullPod} onJoin={jest.fn()} onView={jest.fn()} isJoining={false} isMember={false} />
    );
    expect(screen.getByText('Pod is full')).toBeTruthy();
  });

  it('shows "Join Waitlist" when pod is full and onJoinWaitlist is provided', () => {
    const fullPod: Pod = {
      ...basePod,
      maxMembers: 2,
    };
    render(
      <PodCard
        pod={fullPod}
        onJoin={jest.fn()}
        onView={jest.fn()}
        onJoinWaitlist={jest.fn()}
        isJoining={false}
        isMember={false}
      />
    );
    expect(screen.getByText('Join Waitlist')).toBeTruthy();
  });

  it('calls onJoinWaitlist when "Join Waitlist" is pressed', () => {
    const onJoinWaitlist = jest.fn();
    const fullPod: Pod = {
      ...basePod,
      maxMembers: 2,
    };
    render(
      <PodCard
        pod={fullPod}
        onJoin={jest.fn()}
        onView={jest.fn()}
        onJoinWaitlist={onJoinWaitlist}
        isJoining={false}
        isMember={false}
      />
    );
    fireEvent.press(screen.getByText('Join Waitlist'));
    expect(onJoinWaitlist).toHaveBeenCalledTimes(1);
  });

  it('renders member count correctly', () => {
    render(
      <PodCard pod={basePod} onJoin={jest.fn()} onView={jest.fn()} isJoining={false} isMember={false} />
    );
    expect(screen.getByText(/2\/4 members/)).toBeTruthy();
  });

  it('renders the location', () => {
    render(
      <PodCard pod={basePod} onJoin={jest.fn()} onView={jest.fn()} isJoining={false} isMember={false} />
    );
    expect(screen.getByText('RPAC')).toBeTruthy();
  });
});
