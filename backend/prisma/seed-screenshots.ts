/// <reference types="node" />
/**
 * Screenshot seed script.
 *
 * Populates the database with realistic, *full-looking* demo content (a large
 * pool of users, activities, pods + chat, clubs with mid-double-digit
 * memberships, meetings with RSVP counts, announcements, club chat in every
 * club, friendships, DMs) so the main app screens look alive for App Store
 * screenshots and review.
 *
 * Every record it creates is recorded in a manifest file. Run
 * cleanup-screenshots.ts afterward to remove EXACTLY this data and nothing
 * else — your real/original data is never touched. Deleting a seed club/pod/
 * thread cascades its children (members, attendees, messages, etc.).
 *
 * SAFETY: writes to whatever DATABASE_URL points at. To run you must set
 * SEED_CONFIRM=yes. Example (production):
 *   SEED_CONFIRM=yes \
 *   DATABASE_URL="<prod pooler url>" DIRECT_URL="<prod direct url>" \
 *   SEED_ATTACH_EMAIL="you@osu.edu" \
 *   npx ts-node prisma/seed-screenshots.ts
 *
 * SEED_ATTACH_EMAIL (optional): an existing account (e.g. your own login). If
 * set, that account is added to a pod + a club, befriended with several demo
 * users, and given a DM thread (with the required friendship), so your logged-in
 * view looks populated too.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';
import { CURRENT_TERMS_VERSION } from '../src/config/legal';

const prisma = new PrismaClient();
const MANIFEST_PATH = path.join(__dirname, '.screenshot-seed-manifest.json');
const now = Date.now();
const hrs = (n: number) => new Date(now + n * 3600 * 1000);

const manifest = {
  createdAt: new Date().toISOString(),
  attachEmail: process.env.SEED_ATTACH_EMAIL ?? null,
  users: [] as string[],
  activities: [] as string[],
  pods: [] as string[],
  clubs: [] as string[],
  dmThreads: [] as string[],
  friendships: [] as string[],
  friendRequests: [] as string[],
};

function dbHost(): string {
  try {
    return new URL(process.env.DATABASE_URL ?? '').host || '(unknown)';
  } catch {
    return '(unparseable DATABASE_URL)';
  }
}

// Deterministic-enough PRNG so reruns look similar; not security-sensitive.
let _s = 1337;
const rand = () => ((_s = (_s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
function shuffled(n: number): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 8 hand-written profiles (rich bios) + a generated pool for volume.
const DETAILED = [
  { firstName: 'Ava', lastName: 'Chen', classYear: 'Junior', major: 'Neuroscience', bio: 'Coffee, climbing, and questionable trivia knowledge.', instagramHandle: '@ava.chen', interests: ['Coffee', 'Climbing', 'Trivia'] },
  { firstName: 'Marcus', lastName: 'Lee', classYear: 'Sophomore', major: 'Computer Science', bio: 'Building side projects and looking for a pickup game.', instagramHandle: '@marcuslee', interests: ['Basketball', 'Coding', 'Lo-fi'] },
  { firstName: 'Priya', lastName: 'Patel', classYear: 'Senior', major: 'Marketing', bio: 'Always down for boba and a study sprint.', instagramHandle: '@priya.p', interests: ['Boba', 'Design', 'Concerts'] },
  { firstName: 'Jordan', lastName: 'Brooks', classYear: 'Freshman', major: 'Undecided', bio: 'New to campus, trying to meet people the analog way.', instagramHandle: '@jordanb', interests: ['Soccer', 'Photography'] },
  { firstName: 'Sofia', lastName: 'Garcia', classYear: 'Junior', major: 'Environmental Policy', bio: 'Hammocks and good company over the library, usually.', instagramHandle: '@sofiag', interests: ['Hiking', 'Sustainability', 'Cooking'] },
  { firstName: 'Tyler', lastName: 'Nguyen', classYear: 'Senior', major: 'Mechanical Engineering', bio: 'Intramural soccer captain. Will recruit you.', instagramHandle: '@tyler.ng', interests: ['Soccer', 'Cars', 'Coffee'] },
  { firstName: 'Maya', lastName: 'Johnson', classYear: 'Sophomore', major: 'Psychology', bio: 'Looking for a running buddy and good playlists.', instagramHandle: '@maya.j', interests: ['Running', 'Music', 'Volunteering'] },
  { firstName: 'Ethan', lastName: 'Park', classYear: 'Junior', major: 'Finance', bio: 'Markets by day, intramurals by night.', instagramHandle: '@ethanpark', interests: ['Investing', 'Basketball', 'Sushi'] },
];

const FIRST = ['Liam', 'Olivia', 'Noah', 'Emma', 'Mateo', 'Zoe', 'Ibrahim', 'Hana', 'Caleb', 'Nina', 'Diego', 'Aisha', 'Ryan', 'Leah', 'Omar', 'Grace', 'Kai', 'Ella', 'Andre', 'Mia', 'Sam', 'Lucia', 'Owen', 'Ruby', 'Devin', 'Chloe', 'Marco', 'Tara', 'Nico', 'Bella', 'Reed', 'Yuki', 'Cole', 'Amara', 'Eli', 'Sana', 'Drew', 'Iris', 'Theo', 'Jade', 'Max', 'Nora'];
const LAST = ['Reyes', 'Kim', 'Walsh', 'Ahmed', 'Rossi', 'Osei', 'Sato', 'Bauer', 'Lopez', 'Khan', 'Murphy', 'Ortiz', 'Singh', 'Cohen', 'Ford', 'Tran', 'Diaz', 'Hughes', 'Romano', 'Hassan', 'Cruz', 'Webb', 'Lin', 'Novak', 'Pierce', 'Vance', 'Acosta', 'Bell', 'Doyle', 'Estrada', 'Frost', 'Gupta', 'Hale', 'Jensen', 'Kwon', 'Lund', 'Maxwell', 'Doan', 'Park', 'Shah', 'Reed', 'Ali'];
const MAJORS = ['Computer Science', 'Biology', 'Business', 'Psychology', 'Engineering', 'Communications', 'Political Science', 'Design', 'Nursing', 'Economics', 'English', 'Data Science', 'Public Health', 'Art History'];
const YEARS = ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Grad'];
const BIOS = ['Here to meet people and try new things.', 'Down for coffee, runs, and spontaneous plans.', 'Looking for my people on campus.', 'Always up for a study group or a pickup game.', 'New plans > scrolling. Say hi!'];
const INTEREST_POOL = ['Coffee', 'Running', 'Music', 'Coding', 'Soccer', 'Photography', 'Hiking', 'Cooking', 'Art', 'Gaming', 'Volunteering', 'Climbing', 'Boba', 'Reading'];

const POOL_SIZE = 50;

const ACTIVITIES = [
  { title: 'Frisbee on the Oval', description: 'Casual frisbee toss on the Oval. No experience needed.', category: 'Sports & Fitness', defaultLocation: 'The Oval' },
  { title: 'Trivia Night', description: 'Form a team and battle it out at weekly trivia. No expertise required.', category: 'Social', defaultLocation: 'The Lounge – High Street' },
  { title: 'Library Study Sprint', description: 'Focused co-working session. Bring your hardest assignment.', category: 'Study', defaultLocation: 'Thompson Library – 11th Floor' },
  { title: 'Boba Run', description: 'Walk to grab boba off campus. Try a new flavor every time.', category: 'Food & Drink', defaultLocation: 'High Street' },
  { title: 'Sunset Hammock Hang', description: 'String up a hammock and watch the sunset with good company.', category: 'Outdoors', defaultLocation: 'The Oval' },
  { title: 'Intramural Soccer', description: 'Friendly pickup soccer. All skill levels welcome.', category: 'Sports & Fitness', defaultLocation: 'Lincoln Tower Fields' },
];

const POD_CHAT = [
  'made a pod for trivia night this week 🧠',
  "i'm in! what should our team name be",
  'haha we need a good one, open to ideas',
  'how about "Let\'s Get Quizzical"',
  'incredible. instantly our team name',
  'what time does it start?',
  "8pm — let's grab a table early",
  'perfect, see everyone there 🙌',
];

const CLUB_CHAT_POOL = [
  'welcome to everyone who joined this week! 👋',
  'first meeting is thursday, hope to see you all there',
  'anyone want to grab food before the meeting?',
  "i'm in — been looking forward to this",
  'reminder: bring a friend next week, all welcome',
  'great turnout today, thanks everyone 🙌',
  'what time are we meeting again?',
  '6pm in the usual room. see you there!',
  'so glad i found this club honestly',
  'who\'s coming to the event this weekend?',
  'count me in for the weekend thing',
  'pinned the schedule in the about tab 📌',
];

async function main() {
  if (process.env.SEED_CONFIRM !== 'yes') {
    console.error(
      `\nRefusing to run without confirmation.\n` +
      `Target database host: ${dbHost()}\n` +
      `Re-run with SEED_CONFIRM=yes once you've verified that's the right database.\n`
    );
    process.exit(1);
  }
  console.log(`[seed] Seeding screenshot data into: ${dbHost()}`);

  const passwordHash = await bcrypt.hash(`oval-seed-${now}`, 10);

  // --- Users (detailed + generated pool) ---
  const users: { id: string }[] = [];
  for (let i = 0; i < POOL_SIZE; i++) {
    const d = DETAILED[i];
    const firstName = d?.firstName ?? FIRST[(i - DETAILED.length) % FIRST.length];
    const lastName = d?.lastName ?? LAST[((i - DETAILED.length) * 5) % LAST.length];
    const u = await prisma.user.create({
      data: {
        name: `${firstName} ${lastName}`,
        firstName,
        lastName,
        email: `oval-seed-${i}-${firstName.toLowerCase()}@osu.edu`,
        password: passwordHash,
        verifiedUniversity: true,
        accountStatus: 'ACTIVE',
        termsVersion: CURRENT_TERMS_VERSION,
        termsAcceptedAt: new Date(),
        ageAttestedAt: new Date(),
        classYear: d?.classYear ?? YEARS[i % YEARS.length],
        major: d?.major ?? MAJORS[i % MAJORS.length],
        bio: d?.bio ?? BIOS[i % BIOS.length],
        instagramHandle: d?.instagramHandle ?? `@${firstName.toLowerCase()}.${lastName.toLowerCase()}`,
        interestTags: JSON.stringify(d?.interests ?? [INTEREST_POOL[i % INTEREST_POOL.length], INTEREST_POOL[(i * 3) % INTEREST_POOL.length]]),
        campusZones: JSON.stringify(['Central Campus']),
      },
    });
    manifest.users.push(u.id);
    users.push({ id: u.id });
  }
  console.log(`[seed] created ${users.length} demo users`);

  // --- Activities ---
  const activityIds: string[] = [];
  for (const a of ACTIVITIES) {
    // Reuse an existing activity with the same title so re-running this seed
    // (or running it alongside the main seed) doesn't create duplicates.
    const existing = await prisma.activity.findFirst({ where: { title: a.title } });
    const act = existing ?? (await prisma.activity.create({ data: a }));
    manifest.activities.push(act.id);
    activityIds.push(act.id);
  }

  // --- Pods (first one gets a full chat thread) ---
  const ovalLat = 40.0076;
  const ovalLng = -83.0306;
  const podSpecs = [
    { actIdx: 1, location: 'The Lounge – High Street', inHours: 18, size: 4, max: 4, chat: true },
    { actIdx: 0, location: 'The Oval – South End', inHours: 26, size: 2, max: 6 },
    { actIdx: 2, location: 'Thompson Library – 11th Floor', inHours: 4, size: 3, max: 5 },
    { actIdx: 5, location: 'Lincoln Tower Fields', inHours: 50, size: 7, max: 10 },
    { actIdx: 4, location: 'The Oval', inHours: 8, size: 2, max: 4 },
    { actIdx: 3, location: 'High Street', inHours: 30, size: 3, max: 4 },
    { actIdx: 2, location: 'Thompson Library – Reading Room', inHours: 12, size: 4, max: 6 },
  ];
  let chatPodId = '';
  for (let i = 0; i < podSpecs.length; i++) {
    const s = podSpecs[i];
    const memberIdxs = shuffled(POOL_SIZE).slice(0, s.size);
    const pod = await prisma.pod.create({
      data: {
        activityId: activityIds[s.actIdx],
        meetupTime: hrs(s.inHours),
        location: s.location,
        minMembers: 2,
        maxMembers: s.max,
        status: 'FORMING',
        creatorId: users[memberIdxs[0]].id,
        latitude: ovalLat + (i - 2) * 0.001,
        longitude: ovalLng + (i - 2) * 0.001,
        members: { create: memberIdxs.map((m) => ({ userId: users[m].id, confirmedAt: new Date() })) },
      },
    });
    manifest.pods.push(pod.id);
    if (s.chat) {
      chatPodId = pod.id;
      for (let m = 0; m < POD_CHAT.length; m++) {
        await prisma.message.create({
          data: { podId: pod.id, userId: users[memberIdxs[m % memberIdxs.length]].id, content: POD_CHAT[m], createdAt: new Date(now - (POD_CHAT.length - m) * 6 * 60 * 1000) },
        });
      }
    }
  }
  console.log(`[seed] created ${podSpecs.length} pods`);

  // --- Clubs (big memberships, RSVP'd meetings, chat in every club) ---
  const clubSpecs = [
    { name: 'Campus Coding Club', description: 'Build projects, prep for interviews, and ship side hustles together. Weekly build nights, beginners welcome.', category: 'Technology', emoji: '💻', showcase: true, target: 41 },
    { name: 'Campus Photography Society', description: 'Photo walks, gear swaps, and monthly themed challenges around campus and the city.', category: 'Arts', emoji: '📷', target: 33 },
    { name: 'Sustainability Collective', description: 'Campus clean-ups, thrift swaps, and advocacy for a greener campus.', category: 'Environment', emoji: '🌱', target: 24 },
    { name: 'Salsa & Bachata Club', description: 'No-experience-needed social dancing every week. Come for the steps, stay for the people.', category: 'Dance', emoji: '💃', target: 19 },
    { name: 'Pre-Med Society', description: 'Study groups, shadowing leads, and guest speakers from the medical community.', category: 'Academic', emoji: '🩺', target: 36 },
    { name: 'Intramural Basketball League', description: 'Weekly pickup and league play for all skill levels. Teams formed on the spot.', category: 'Sports', emoji: '🏀', target: 38 },
    { name: 'Film & Cinema Club', description: 'Weekly screenings, short-film nights, and trips to the local theater.', category: 'Arts', emoji: '🎬', target: 22 },
    { name: 'Entrepreneurship Society', description: 'Pitch nights, founder talks, and a community building real projects together.', category: 'Business', emoji: '🚀', target: 29 },
    { name: 'Outdoor Adventure Club', description: 'Weekend hikes, climbing trips, and camping for everyone from beginners to pros.', category: 'Outdoors', emoji: '🏔️', target: 26 },
    { name: 'Game Night Collective', description: 'Board games, card games, and tournaments every week. Snacks included.', category: 'Social', emoji: '🎲', target: 31 },
  ];
  let showcaseClubId = '';
  for (let ci = 0; ci < clubSpecs.length; ci++) {
    const c = clubSpecs[ci];
    const memberIdxs = shuffled(POOL_SIZE).slice(0, Math.min(c.target, POOL_SIZE));
    const memberUserIds = memberIdxs.map((i) => users[i].id);
    const ownerId = memberUserIds[0];

    const club = await prisma.club.create({
      data: {
        name: c.name,
        description: c.description,
        category: c.category,
        emoji: c.emoji,
        isVerified: true,
        isPublic: true,
        university: 'OSU',
        createdById: ownerId,
        members: { create: memberUserIds.map((uid, idx) => ({ userId: uid, role: idx === 0 ? 'OWNER' : idx < 4 ? 'OFFICER' : 'MEMBER' })) },
        channels: {
          create: [
            { kind: 'ANNOUNCEMENTS', name: 'Announcements', position: 0, createdById: ownerId },
            { kind: 'GENERAL', name: 'General', position: 1, createdById: ownerId },
            { kind: 'OFFICERS', name: 'Officers', position: 2, createdById: ownerId },
          ],
        },
      },
    });
    manifest.clubs.push(club.id);

    // Meetings (+ RSVP attendees so "X going · Y maybe" looks real)
    const meetingDefs = [
      { title: `${c.name.split(/[ &]/)[0]} Weekly Meeting`, description: 'Our regular weekly get-together. New members always welcome.', location: 'Student Union – Meeting Room A', inHours: 48 },
    ];
    if (c.showcase) {
      meetingDefs.push({ title: 'Hackathon Prep Night', description: 'Form teams and lock in project ideas before the hackathon.', location: 'Engineering Building – Room 266', inHours: 72 });
    }
    for (const md of meetingDefs) {
      const meeting = await prisma.clubMeeting.create({
        data: { clubId: club.id, title: md.title, description: md.description, location: md.location, meetingTime: hrs(md.inHours), createdById: ownerId, isPublic: true },
      });
      const going = Math.round(memberUserIds.length * 0.6);
      const maybe = Math.round(memberUserIds.length * 0.25);
      const notGoing = Math.round(memberUserIds.length * 0.08);
      const rows: { meetingId: string; userId: string; status: string }[] = [];
      let k = 0;
      for (; k < going && k < memberUserIds.length; k++) rows.push({ meetingId: meeting.id, userId: memberUserIds[k], status: 'GOING' });
      for (; k < going + maybe && k < memberUserIds.length; k++) rows.push({ meetingId: meeting.id, userId: memberUserIds[k], status: 'MAYBE' });
      for (; k < going + maybe + notGoing && k < memberUserIds.length; k++) rows.push({ meetingId: meeting.id, userId: memberUserIds[k], status: 'NOT_GOING' });
      await prisma.clubMeetingAttendee.createMany({ data: rows, skipDuplicates: true });
    }

    // Announcements
    await prisma.clubAnnouncement.create({ data: { clubId: club.id, userId: ownerId, content: 'Welcome to everyone who signed up this week! Check the meetings tab for our next event. 🎉' } });
    if (c.showcase) {
      await prisma.clubAnnouncement.create({ data: { clubId: club.id, userId: ownerId, content: 'Build night Thursday at 6pm in Room 266. Pizza provided 🍕 bring a laptop!' } });
      showcaseClubId = club.id;
    }

    // General-channel chat (channelId null) — in EVERY club so each has a live chat
    const lines = c.showcase
      ? ['welcome to everyone who joined at the involvement fair! 👋', 'first build night is this thursday, bring a laptop', 'anyone want to pair on the hackathon project?', "i'm in — i've got some ideas for the frontend", 'we have pizza covered for thursday btw', 'what room are we in again?', 'Room 266, 6pm. see you all there!']
      : Array.from({ length: 7 }, (_, m) => CLUB_CHAT_POOL[(ci * 2 + m) % CLUB_CHAT_POOL.length]);
    for (let m = 0; m < lines.length; m++) {
      await prisma.clubMessage.create({
        data: { clubId: club.id, channelId: null, userId: memberUserIds[m % memberUserIds.length], content: lines[m], createdAt: new Date(now - (lines.length - m) * 9 * 60 * 1000) },
      });
    }
  }
  console.log(`[seed] created ${clubSpecs.length} clubs (mid-double-digit members, RSVP'd meetings, chat each)`);

  // --- Friendships among demo users ---
  const fp = shuffled(POOL_SIZE);
  for (let i = 0; i + 1 < Math.min(fp.length, 24); i += 2) {
    const [userAId, userBId] = [users[fp[i]].id, users[fp[i + 1]].id].sort();
    const f = await prisma.friendship.create({ data: { userAId, userBId } }).catch(() => null);
    if (f) manifest.friendships.push(f.id);
  }

  // --- A demo-to-demo DM thread (friends, so it opens) ---
  {
    const [a, b] = [users[0].id, users[1].id].sort();
    await prisma.friendship.create({ data: { userAId: a, userBId: b } }).then((f) => manifest.friendships.push(f.id)).catch(() => {});
    const thread = await prisma.directMessageThread.create({ data: { userAId: a, userBId: b } });
    manifest.dmThreads.push(thread.id);
    const dm = ['hey! great frisbee game earlier', 'right?? we should do it again this week', "for sure, i'll spin up a pod"];
    for (let m = 0; m < dm.length; m++) {
      await prisma.directMessage.create({ data: { threadId: thread.id, senderId: m % 2 === 0 ? a : b, content: dm[m], createdAt: new Date(now - (dm.length - m) * 7 * 60 * 1000) } });
    }
  }

  // --- Optional: attach a real account (e.g. you) to seed content ---
  const attachEmail = process.env.SEED_ATTACH_EMAIL?.trim().toLowerCase();
  if (attachEmail) {
    const acct = await prisma.user.findUnique({ where: { email: attachEmail } });
    if (!acct) {
      console.warn(`[seed] SEED_ATTACH_EMAIL ${attachEmail} not found — skipping attach (create that account first).`);
    } else {
      await prisma.podMember.create({ data: { podId: chatPodId, userId: acct.id, confirmedAt: new Date() } }).catch(() => {});
      await prisma.clubMember.create({ data: { clubId: showcaseClubId, userId: acct.id, role: 'MEMBER' } }).catch(() => {});

      // Befriend several demo users so your Friends list is populated, and the
      // DM (which requires friendship) opens correctly.
      for (let i = 0; i < 6; i++) {
        const [fa, fb] = [acct.id, users[i].id].sort();
        const exists = await prisma.friendship.findUnique({ where: { userAId_userBId: { userAId: fa, userBId: fb } } });
        if (!exists) {
          const fr = await prisma.friendship.create({ data: { userAId: fa, userBId: fb } });
          manifest.friendships.push(fr.id);
        }
      }

      const [ua, ub] = [acct.id, users[0].id].sort();
      const existing = await prisma.directMessageThread.findFirst({ where: { userAId: ua, userBId: ub } });
      if (!existing) {
        const thread = await prisma.directMessageThread.create({ data: { userAId: ua, userBId: ub } });
        manifest.dmThreads.push(thread.id);
        const dm = ['hey! welcome to Oval 👋', 'thanks! still figuring it out', 'come to the coffee walk tomorrow, i added you to the pod'];
        for (let m = 0; m < dm.length; m++) {
          await prisma.directMessage.create({ data: { threadId: thread.id, senderId: m % 2 === 0 ? users[0].id : acct.id, content: dm[m], createdAt: new Date(now - (dm.length - m) * 5 * 60 * 1000) } });
        }
      }
      console.log(`[seed] attached ${attachEmail} to a pod, a club, 6 friendships, and a DM thread`);
    }
  }

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  console.log(`[seed] done. Manifest written to ${MANIFEST_PATH}`);
  console.log(`[seed] users=${manifest.users.length} activities=${manifest.activities.length} pods=${manifest.pods.length} clubs=${manifest.clubs.length}`);
  console.log(`[seed] To remove all of this later: CLEANUP_CONFIRM=yes npx ts-node prisma/cleanup-screenshots.ts`);
}

main()
  .catch((e) => {
    console.error('[seed] failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
