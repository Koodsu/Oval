import { colors } from '../theme';

/** Deterministic pastel circle behind club emoji (matches Explore club cards). */
export function clubCircleBg(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors.avatarPalette[Math.abs(hash) % colors.avatarPalette.length];
}
