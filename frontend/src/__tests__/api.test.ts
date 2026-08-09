import {
  getApiErrorMessage,
  getActivities,
  getMessages,
  getThreadMessages,
  getToken,
  getUserProfileShareUrl,
  setOnUnauthorized,
  setToken,
  transferClubOwnership,
} from '../api';

beforeEach(() => {
  setToken(null);
  setOnUnauthorized(null);
});

describe('setToken / getToken', () => {
  it('stores and retrieves the token', () => {
    setToken('abc123');
    expect(getToken()).toBe('abc123');
  });

  it('clears the token when null is passed', () => {
    setToken('abc123');
    setToken(null);
    expect(getToken()).toBeNull();
  });
});

describe('getUserProfileShareUrl', () => {
  it('builds a universal link and safely encodes the user id', () => {
    expect(getUserProfileShareUrl('user/id')).toBe('https://www.theovalapp.com/users/user%2Fid');
  });
});

describe('transferClubOwnership', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('posts the selected member to the owner-only transfer endpoint', async () => {
    setToken('owner-token');
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          ok: true,
          previousOwner: { userId: 'owner-1', role: 'ADMIN' },
          newOwner: {
            id: 'membership-2',
            clubId: 'club/1',
            userId: 'member/2',
            role: 'OWNER',
            user: { id: 'member/2', name: 'Next Owner' },
          },
        }),
    });

    await transferClubOwnership('club/1', 'member/2');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/clubs/club%2F1/transfer-ownership'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ newOwnerUserId: 'member/2' }),
        headers: expect.objectContaining({
          Authorization: 'Bearer owner-token',
          'Content-Type': 'application/json',
        }),
      }),
    );
  });
});

describe('setOnUnauthorized', () => {
  it('registers a callback without throwing', () => {
    const cb = jest.fn();
    expect(() => setOnUnauthorized(cb)).not.toThrow();
  });

  it('can be cleared by passing null', () => {
    setOnUnauthorized(jest.fn());
    expect(() => setOnUnauthorized(null)).not.toThrow();
  });
});

describe('request — 401 handling', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('fires the onUnauthorized callback on a 401 response', async () => {
    const onUnauthorized = jest.fn();
    setOnUnauthorized(onUnauthorized);
    setToken('expired-token');

    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ error: 'Invalid or expired token' }),
    });

    await expect(getMessages('pod-1')).rejects.toThrow('Invalid or expired token');
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('does not fire the onUnauthorized callback when a 401 response had no token attached', async () => {
    const onUnauthorized = jest.fn();
    setOnUnauthorized(onUnauthorized);
    setToken(null);

    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ error: 'Missing or invalid authorization header' }),
    });

    await expect(getMessages('pod-1')).rejects.toThrow('Missing or invalid authorization header');
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('does not fire onUnauthorized for non-401 errors', async () => {
    const onUnauthorized = jest.fn();
    setOnUnauthorized(onUnauthorized);

    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => JSON.stringify({ error: 'Internal server error' }),
    });

    await expect(getMessages('pod-1')).rejects.toThrow('Internal server error');
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('handles a plain-text Vercel function error without a JSON parse failure', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'A server error has occurred\n\nFUNCTION_INVOCATION_FAILED',
    });

    const error = await getMessages('pod-1').catch((caught) => caught);

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toContain('FUNCTION_INVOCATION_FAILED');
    expect(getApiErrorMessage(error)).toBe(
      'Oval hit a server error while trying that. Please try again in a minute.'
    );
  });
});

describe('live message reads', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('bypasses app and native caches when realtime refetches a DM thread', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            messages: [],
            otherUser: { id: 'user-2', name: 'Friend' },
            typingUserIds: [],
            otherLastReadAt: null,
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            messages: [{ id: 'message-1', createdAt: '2026-08-08T12:00:00.000Z' }],
            otherUser: { id: 'user-2', name: 'Friend' },
            typingUserIds: [],
            otherLastReadAt: null,
          }),
      });

    await getThreadMessages('thread-1', { limit: 50 });
    const refreshed = await getThreadMessages('thread-1', { limit: 50 });

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('/messages/threads/thread-1?limit=50'),
      expect.objectContaining({ cache: 'no-store' }),
    );
    expect(refreshed.messages).toHaveLength(1);
  });

  it('also keeps pod message polling uncached', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ messages: [], typingUserIds: [] }),
    });

    await getMessages('pod-1', { limit: 50 });
    await getMessages('pod-1', { limit: 50 });

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch).toHaveBeenLastCalledWith(
      expect.stringContaining('/pods/pod-1/messages?limit=50'),
      expect.objectContaining({ cache: 'no-store' }),
    );
  });
});

describe('shared app reads', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does not reuse stale data for ordinary authenticated screens', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify([{ id: 'activity-1', demandCount: 1 }]),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify([{ id: 'activity-1', demandCount: 2 }]),
      });

    await getActivities();
    const refreshed = await getActivities();

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch).toHaveBeenLastCalledWith(
      expect.stringContaining('/activities'),
      expect.objectContaining({ cache: 'no-store' }),
    );
    expect(refreshed[0]?.demandCount).toBe(2);
  });
});
