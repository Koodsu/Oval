/// <reference types="node" />
/**
 * Read-only diagnostic for the screenshot seed.
 *
 * Answers: which database am I pointed at, did the activity-catalog migration
 * land there, is any seed data actually present, and does my own account see it?
 * Writes nothing — safe to run against production.
 *
 *   npx ts-node prisma/check-screenshot-seed.ts
 *   CHECK_EMAIL=you@osu.edu npx ts-node prisma/check-screenshot-seed.ts
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();
const MANIFEST_PATH = path.join(__dirname, '.screenshot-seed-manifest.json');

function describeTarget() {
  try {
    const u = new URL(process.env.DATABASE_URL ?? '');
    const user = decodeURIComponent(u.username || '');
    const ref = user.includes('.') ? user.split('.').slice(1).join('.') : '(none)';
    return { host: u.host, ref };
  } catch {
    return { host: '(unparseable DATABASE_URL)', ref: '(unknown)' };
  }
}

async function main() {
  const t = describeTarget();
  console.log('=== TARGET ===');
  console.log('  host          :', t.host);
  console.log('  project ref   :', t.ref);
  console.log('  (compare this ref to the DATABASE_URL in your Vercel project settings)');

  console.log('\n=== MIGRATION STATE ===');
  const cols: Array<{ column_name: string }> = await prisma.$queryRawUnsafe(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'Activity'`
  );
  const names = cols.map((c) => c.column_name);
  const hasCatalogV2 = ['isActive', 'artworkKey', 'sortOrder'].every((c) => names.includes(c));
  console.log('  activity_catalog_v2 applied :', hasCatalogV2 ? 'YES' : 'NO  <-- seed will throw without this');

  if (hasCatalogV2) {
    const needed = ['frisbee', 'trivia', 'study-group', 'grab-coffee-tea', 'casual-hangout', 'pickup-soccer'];
    const found = await prisma.activity.findMany({
      where: { artworkKey: { in: needed }, isActive: true },
      select: { artworkKey: true },
    });
    const missing = needed.filter((k) => !found.some((f) => f.artworkKey === k));
    console.log('  activities the seed needs   :', `${found.length}/${needed.length} present`);
    if (missing.length) console.log('  MISSING                     :', missing.join(', '));
  }

  console.log('\n=== WHAT IS ACTUALLY IN THIS DB ===');
  const seedUsers = await prisma.user.count({ where: { email: { startsWith: 'oval-seed-' } } });
  console.log('  demo users (oval-seed-*)    :', seedUsers);
  console.log('  users (total)               :', await prisma.user.count());
  console.log('  pods (total)                :', await prisma.pod.count());
  console.log('  clubs (total)               :', await prisma.club.count());
  console.log('  club members (total)        :', await prisma.clubMember.count());
  console.log('  friendships (total)         :', await prisma.friendship.count());

  console.log('\n=== MANIFEST vs DB ===');
  if (!fs.existsSync(MANIFEST_PATH)) {
    console.log('  no active manifest on disk (seed has not run, or cleanup already archived it)');
  } else {
    const m = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    console.log('  manifest createdAt          :', m.createdAt);
    const live = await prisma.user.count({ where: { id: { in: m.users ?? [] } } });
    console.log('  manifest users still in DB  :', `${live}/${(m.users ?? []).length}`);
    const livePods = await prisma.pod.count({ where: { id: { in: m.pods ?? [] } } });
    console.log('  manifest pods still in DB   :', `${livePods}/${(m.pods ?? []).length}`);
    const liveClubs = await prisma.club.count({ where: { id: { in: m.clubs ?? [] } } });
    console.log('  manifest clubs still in DB  :', `${liveClubs}/${(m.clubs ?? []).length}`);
  }

  const email = (process.env.CHECK_EMAIL ?? 'vanbibber.21@osu.edu').trim().toLowerCase();
  console.log(`\n=== ACCOUNT: ${email} ===`);
  const me = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      accountStatus: true,
      verifiedUniversity: true,
      _count: { select: { clubMemberships: true } },
    },
  });
  if (!me) {
    console.log('  NOT FOUND in this database  <-- the app you are testing uses a different DB');
  } else {
    console.log('  id                          :', me.id);
    console.log('  accountStatus               :', me.accountStatus);
    console.log('  verifiedUniversity          :', me.verifiedUniversity);
    console.log('  club memberships            :', me._count.clubMemberships);
    const friends = await prisma.friendship.count({
      where: { OR: [{ userAId: me.id }, { userBId: me.id }] },
    });
    console.log('  friendships                 :', friends);
  }
}

main()
  .catch((e) => {
    console.error('\n[check] failed:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
