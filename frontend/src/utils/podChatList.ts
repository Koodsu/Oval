import type { Message } from '../types';

export const CHAT_GAP_MS = 5 * 60 * 1000;

export type PodChatListItem =
  | { type: 'time'; id: string; date: string }
  | { type: 'message'; message: Message; index: number };

export function buildPodChatList(messages: Message[]): PodChatListItem[] {
  const items: PodChatListItem[] = [];
  messages.forEach((msg, index) => {
    const t = new Date(msg.createdAt).getTime();
    const prev = index > 0 ? new Date(messages[index - 1].createdAt).getTime() : null;
    if (index === 0 || prev === null || t - prev > CHAT_GAP_MS) {
      items.push({ type: 'time', id: `time-${msg.id}`, date: msg.createdAt });
    }
    items.push({ type: 'message', message: msg, index });
  });
  return items;
}
