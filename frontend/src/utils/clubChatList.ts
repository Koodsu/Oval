import type { ClubMessage } from '../types';
import { CHAT_GAP_MS } from './podChatList';

export type ClubChatListItem =
  | { type: 'time'; id: string; date: string }
  | { type: 'message'; message: ClubMessage; index: number };

export function buildClubChatList(messages: ClubMessage[]): ClubChatListItem[] {
  const items: ClubChatListItem[] = [];
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
