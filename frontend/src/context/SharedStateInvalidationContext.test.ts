import { scopesFromRealtimePayload } from './SharedStateInvalidationContext';

describe('shared state realtime payloads', () => {
  it('accepts known scopes, removes duplicates, and ignores untrusted values', () => {
    expect(scopesFromRealtimePayload({
      scopes: ['pods', 'clubs', 'pods', 'secret', 42],
    })).toEqual(['pods', 'clubs']);
  });

  it('ignores malformed payloads', () => {
    expect(scopesFromRealtimePayload({ scopes: 'pods' })).toEqual([]);
    expect(scopesFromRealtimePayload({})).toEqual([]);
  });
});
