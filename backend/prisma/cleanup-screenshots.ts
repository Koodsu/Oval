/// <reference types="node" />
/**
 * Screenshot cleanup script.
 *
 * Removes EXACTLY the data created by seed-screenshots.ts, by reading the
 * manifest of created ids. Anything not in the manifest is never touched, so
 * your real/original data — and any real account you attached via
 * SEED_ATTACH_EMAIL — is preserved. Deleting the seed clubs/pods/threads
 * cascades their child rows (members, messages, meetings, etc.), including the
 * attached account's membership in seed content, without deleting that account.
 *
 * SAFETY: operates on whatever DATABASE_URL points at. To run you must set
 * CLEANUP_CONFIRM=yes. Example (production):
 *   CLEANUP_CONFIRM=yes \
 *   DATABASE_URL="<prod pooler url>" DIRECT_URL="<prod direct url>" \
 *   npx ts-node prisma/cleanup-screenshots.ts
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();
const MANIFEST_PATH = path.join(__dirname, '.screenshot-seed-manifest.json');

function dbHost(): string {
  try {
    return new URL(process.env.DATABASE_URL ?? '').host || '(unknown)';
  } catch {
    return '(unparseable DATABASE_URL)';
  }
}

type Manifest = {
  users: string[];
  activities: string[];
  pods: string[];
  clubs: string[];
  dmThreads: string[];
  friendships: string[];
  friendRequests: string[];
  attachEmail: string | null;
};

async function main() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error(`No manifest found at ${MANIFEST_PATH}. Nothing to clean up (did the seed run?).`);
    process.exit(1);
  }
  const m: Manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));

  if (process.env.CLEANUP_CONFIRM !== 'yes') {
    console.error(
      `\nRefusing to run without confirmation.\n` +
      `Target database host: ${dbHost()}\n` +
      `Will delete: ${m.clubs.length} clubs, ${m.pods.length} pods, ${m.dmThreads.length} DM threads, ` +
      `${m.friendships.length} friendships, ${m.activities.length} activities, ${m.users.length} users ` +
      `(plus their cascaded children).\n` +
      `Real data and the attached account (${m.attachEmail ?? 'none'}) are preserved.\n` +
      `Re-run with CLEANUP_CONFIRM=yes once you've verified the database host above.\n`
    );
    process.exit(1);
  }
  console.log(`[cleanup] Removing screenshot seed data from: ${dbHost()}`);

  const inIds = (ids: string[]) => ({ where: { id: { in: ids } } });

  // Order matters (FK constraints): clubs & pods first (cascade their children),
  // then DM threads, friendships, activities, and finally the demo users.
  const clubs = await prisma.club.deleteMany(inIds(m.clubs));
  const pods = await prisma.pod.deleteMany(inIds(m.pods));
  const threads = await prisma.directMessageThread.deleteMany(inIds(m.dmThreads));
  const friendships = await prisma.friendship.deleteMany(inIds(m.friendships));
  const friendRequests = await prisma.friendRequest.deleteMany(inIds(m.friendRequests ?? []));
  // Pod.activityId is onDelete: Restrict, so only delete manifest activities
  // that no remaining (real) pod still references. The seed also reuses
  // pre-existing activities by title, so some manifest activities may be
  // shared with the main seed — skipping in-use ones keeps those intact.
  const activities = await prisma.activity.deleteMany({
    where: { id: { in: m.activities }, pods: { none: {} } },
  });
  const users = await prisma.user.deleteMany(inIds(m.users));

  console.log(
    `[cleanup] deleted clubs=${clubs.count} pods=${pods.count} dmThreads=${threads.count} ` +
    `friendships=${friendships.count} friendRequests=${friendRequests.count} ` +
    `activities=${activities.count} users=${users.count}`
  );

  // Archive the manifest so a second accidental run is a no-op.
  const doneName = MANIFEST_PATH.replace(/\.json$/, `.cleaned-${Date.now()}.json`);
  fs.renameSync(MANIFEST_PATH, doneName);
  console.log(`[cleanup] done. Manifest archived to ${doneName}`);
}

main()
  .catch((e) => {
    console.error('[cleanup] failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
