import { realtimeUserId } from './useRealtimeTyping';

describe('realtimeUserId', () => {
  it('returns a valid user id from a realtime payload', () => {
    expect(realtimeUserId({ userId: 'user-1' })).toBe('user-1');
  });

  it('rejects absent and non-string user ids', () => {
    expect(realtimeUserId({})).toBeNull();
    expect(realtimeUserId({ userId: 42 })).toBeNull();
  });
});
