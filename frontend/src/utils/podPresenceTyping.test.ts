import { parseTypingUsersFromPresenceState } from './podPresenceTyping';

describe('parseTypingUsersFromPresenceState', () => {
  const me = 'user-self';

  it('returns users with typing true excluding current user', () => {
    const state = {
      a: [{ userId: 'u1', typing: true }],
      b: [{ userId: 'u2', typing: true }],
    };
    expect(parseTypingUsersFromPresenceState(state, me)).toEqual([
      { userId: 'u1' },
      { userId: 'u2' },
    ]);
  });

  it('excludes current user', () => {
    const state = {
      k: [{ userId: me, typing: true }],
      o: [{ userId: 'other', typing: true }],
    };
    expect(parseTypingUsersFromPresenceState(state, me)).toEqual([{ userId: 'other' }]);
  });

  it('ignores typing false or missing', () => {
    const state = {
      x: [{ userId: 'u1', typing: false }],
      y: [{ userId: 'u2' }],
      z: [{ userId: 'u3', typing: true }],
    };
    expect(parseTypingUsersFromPresenceState(state, me)).toEqual([{ userId: 'u3' }]);
  });

  it('dedupes same userId across keys', () => {
    const state = {
      k1: [{ userId: 'dup', typing: true }],
      k2: [{ userId: 'dup', typing: true }],
    };
    expect(parseTypingUsersFromPresenceState(state, me)).toEqual([{ userId: 'dup' }]);
  });

  it('when currentUserId is undefined does not exclude any userId', () => {
    const state = {
      k: [{ userId: me, typing: true }],
    };
    expect(parseTypingUsersFromPresenceState(state, undefined)).toEqual([{ userId: me }]);
  });

  it('skips invalid metas', () => {
    const state = {
      k: [{ typing: true }, { userId: 'ok', typing: true }],
    };
    expect(parseTypingUsersFromPresenceState(state, me)).toEqual([{ userId: 'ok' }]);
  });
});
