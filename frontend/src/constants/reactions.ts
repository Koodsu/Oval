/** Mirrors backend/src/lib/reactionEmojis.ts — keep in sync. */
export const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢'] as const;

export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];
