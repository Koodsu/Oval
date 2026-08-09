import { describe, expect, it } from 'vitest';
import { sharedStateScopesForRequest } from './sharedStateInvalidation';

describe('shared state invalidation classification', () => {
  it('maps shared resource mutations to the screens that consume them', () => {
    expect(sharedStateScopesForRequest('PATCH', '/pods/pod-1')).toEqual(['pods']);
    expect(sharedStateScopesForRequest('POST', '/clubs/club-1/meetings')).toEqual(['clubs']);
    expect(sharedStateScopesForRequest('POST', '/friends/requests')).toEqual([
      'friends',
      'users',
      'inbox',
    ]);
    expect(sharedStateScopesForRequest('PATCH', '/users/me')).toEqual([
      'users',
      'friends',
      'pods',
      'clubs',
    ]);
    expect(sharedStateScopesForRequest('POST', '/activities/activity-1/demand')).toEqual([
      'activities',
      'pods',
    ]);
  });

  it('does not broadcast for reads, errors-to-be-decided later, or private noise', () => {
    expect(sharedStateScopesForRequest('GET', '/pods/pod-1')).toEqual([]);
    expect(sharedStateScopesForRequest('POST', '/pods/pod-1/typing')).toEqual([]);
    expect(sharedStateScopesForRequest('PATCH', '/messages/threads/thread-1/read')).toEqual(['messages']);
    expect(sharedStateScopesForRequest('POST', '/users/push-token')).toEqual([]);
    expect(sharedStateScopesForRequest('PATCH', '/users/notifications')).toEqual([]);
  });

  it('refreshes message metadata without reloading unrelated resource feeds', () => {
    expect(sharedStateScopesForRequest('POST', '/messages/threads/thread-1/messages')).toEqual(['messages']);
    expect(sharedStateScopesForRequest('POST', '/pods/pod-1/messages')).toEqual(['messages']);
    expect(
      sharedStateScopesForRequest(
        'DELETE',
        '/clubs/club-1/channels/channel-1/messages/message-1',
      ),
    ).toEqual(['messages']);
  });
});
