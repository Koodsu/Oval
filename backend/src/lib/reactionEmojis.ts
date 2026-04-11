export const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢'] as const;

export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

export function isValidReactionEmoji(emoji: string): emoji is ReactionEmoji {
  return REACTION_EMOJIS.includes(emoji as ReactionEmoji);
}
