import { buildPodChatList, CHAT_GAP_MS } from './podChatList';
import type { Message } from '../types';

function msg(id: string, createdAt: string, userId = 'u1'): Message {
  return {
    id,
    podId: 'p1',
    userId,
    content: 'hi',
    createdAt,
    user: { id: userId, name: 'Test', avatarUrl: null },
    reactions: [],
    replyTo: null,
  };
}

describe('buildPodChatList', () => {
  it('inserts a time row before the first message', () => {
    const m = [msg('1', '2026-04-14T12:00:00.000Z')];
    const items = buildPodChatList(m);
    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({ type: 'time', id: 'time-1', date: m[0].createdAt });
    expect(items[1]).toMatchObject({ type: 'message', message: m[0], index: 0 });
  });

  it('does not insert a time row when messages are within 5 minutes', () => {
    const m = [
      msg('1', '2026-04-14T12:00:00.000Z'),
      msg('2', '2026-04-14T12:03:00.000Z'),
    ];
    const items = buildPodChatList(m);
    expect(items.filter((i) => i.type === 'time')).toHaveLength(1);
    expect(items.filter((i) => i.type === 'message')).toHaveLength(2);
  });

  it('inserts a time row when gap exceeds 5 minutes', () => {
    const t0 = new Date('2026-04-14T12:00:00.000Z').getTime();
    const m = [
      msg('1', new Date(t0).toISOString()),
      msg('2', new Date(t0 + CHAT_GAP_MS + 1000).toISOString()),
    ];
    const items = buildPodChatList(m);
    expect(items.filter((i) => i.type === 'time')).toHaveLength(2);
  });
});
