import path from 'path';
import fs from 'fs';
import { isSupabaseStorageConfigured, supabaseStorage } from './supabaseStorage';

export const USER_AVATAR_BUCKET = 'user-avatars';

export const UPLOAD_DIR = path.join(__dirname, '../../uploads/avatars');
// Resolved once at startup; used to guard against path traversal when deleting old avatars.
const UPLOAD_DIR_RESOLVED = path.resolve(UPLOAD_DIR);
try {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
} catch {
  // Vercel read-only filesystem — ignore
}

/**
 * Safely unlinks an avatar file. Resolves the stored path and verifies it
 * lives inside UPLOAD_DIR before deleting — prevents path traversal if the
 * DB record were ever tampered with.
 */
function safeUnlinkAvatar(storedUrl: string): void {
  const fullPath = path.resolve(path.join(__dirname, '../../', storedUrl));
  if (fullPath.startsWith(UPLOAD_DIR_RESOLVED + path.sep)) {
    fs.unlink(fullPath, () => {}); // best-effort, ignore ENOENT
  }
}

function supabaseObjectNameFromPublicUrl(url: string, bucket: string): string | null {
  const marker = `/storage/v1/object/public/${bucket}/`;
  const index = url.indexOf(marker);
  if (index === -1) return null;
  return decodeURIComponent(url.slice(index + marker.length));
}

export async function cleanupAvatarUrl(avatarUrl: string | null | undefined): Promise<void> {
  if (!avatarUrl) return;

  const objectName = isSupabaseStorageConfigured()
    ? supabaseObjectNameFromPublicUrl(avatarUrl, USER_AVATAR_BUCKET)
    : null;
  if (objectName) {
    await supabaseStorage.storage.from(USER_AVATAR_BUCKET).remove([objectName]);
    return;
  }

  safeUnlinkAvatar(avatarUrl);
}
