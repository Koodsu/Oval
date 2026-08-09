import { describe, expect, it } from 'vitest';
import { clubChannelTopic, createBroadcastRequest } from './realtime';

describe('realtime broadcast requests', () => {
  it('uses apikey authentication without treating opaque secret keys as JWTs', () => {
    const request = createBroadcastRequest(
      'sb_secret_test',
      'dm-thread-1',
      'typing',
      { userId: 'user-1' },
    );
    const headers = request.headers as Record<string, string>;

    expect(headers.apikey).toBe('sb_secret_test');
    expect(headers.Authorization).toBeUndefined();
  });

  it('builds the batch payload expected by Supabase Realtime', () => {
    const request = createBroadcastRequest(
      'legacy-service-role-jwt',
      'pod-1',
      'new_message',
      { userId: 'user-1' },
    );

    expect(JSON.parse(String(request.body))).toEqual({
      messages: [
        {
          topic: 'pod-1',
          event: 'new_message',
          payload: { userId: 'user-1' },
          private: false,
        },
      ],
    });
  });

  it('creates stable channel-specific club topics', () => {
    expect(clubChannelTopic('club-1', 'channel-2')).toBe('club-club-1-channel-channel-2');
  });
});
