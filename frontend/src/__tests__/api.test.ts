import { setToken, setOnUnauthorized, getToken, getMessages } from '../api';

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
      json: async () => ({ error: 'Invalid or expired token' }),
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
      json: async () => ({ error: 'Missing or invalid authorization header' }),
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
      json: async () => ({ error: 'Internal server error' }),
    });

    await expect(getMessages('pod-1')).rejects.toThrow('Internal server error');
    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});
