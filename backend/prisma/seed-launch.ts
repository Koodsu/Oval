/// <reference types="node" />
import { PrismaClient } from '@prisma/client';
import { getLocationsForCategory } from '../src/config/locations';

const prisma = new PrismaClient();

const LAUNCH_PLANS = [
  { activityTitle: 'Grab coffee or tea', podTitle: 'Coffee after class' },
  { activityTitle: 'Study group', podTitle: 'Midterm study sprint' },
  { activityTitle: 'Pickup basketball', podTitle: '3v3 at the RPAC' },
  { activityTitle: 'Board games', podTitle: 'Catan at the Union' },
  { activityTitle: 'Draw / paint together', podTitle: 'Watercolor on the Oval' },
  { activityTitle: 'Other volunteering', podTitle: 'Campus cleanup crew' },
];

function ambassadorEmails(): string[] {
  return (process.env.SEED_AMBASSADOR_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function meetupTimeFor(index: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + 1 + (index % 5));
  const weekend = [0, 6].includes(date.getDay());
  date.setHours(weekend ? 13 + (index % 2) * 2 : 18 + (index % 2), index % 2 === 0 ? 0 : 30, 0, 0);
  return date;
}

async function main() {
  const emails = ambassadorEmails();
  if (emails.length === 0) {
    console.log('SEED_AMBASSADOR_EMAILS is empty; no launch pods created.');
    return;
  }

  const ambassadors = await prisma.user.findMany({
    where: { email: { in: emails }, verifiedUniversity: true },
    select: { id: true, email: true },
  });

  if (ambassadors.length === 0) {
    console.log('No verified ambassador accounts matched SEED_AMBASSADOR_EMAILS.');
    return;
  }

  const activities = await prisma.activity.findMany({
    where: { title: { in: LAUNCH_PLANS.map((plan) => plan.activityTitle) }, isActive: true },
  });
  const activityByTitle = new Map(activities.map((activity) => [activity.title, activity]));

  let created = 0;
  for (const [index, plan] of LAUNCH_PLANS.entries()) {
    const activity = activityByTitle.get(plan.activityTitle);
    if (!activity) {
      console.log(`Skipping "${plan.activityTitle}" because the activity does not exist.`);
      continue;
    }

    const ambassador = ambassadors[index % ambassadors.length];
    const existing = await prisma.pod.findFirst({
      where: {
        activityId: activity.id,
        title: plan.podTitle,
        creatorId: { in: ambassadors.map((user) => user.id) },
        meetupTime: { gt: new Date() },
        status: { in: ['FORMING', 'LOCKED'] },
      },
      select: { id: true },
    });
    if (existing) continue;

    const locations = getLocationsForCategory(activity.category);
    const location = locations[index % locations.length] ?? activity.defaultLocation;
    const pod = await prisma.pod.create({
      data: {
        activityId: activity.id,
        creatorId: ambassador.id,
        meetupTime: meetupTimeFor(index),
        location,
        locationType: 'public',
        minMembers: 2,
        maxMembers: 6 + (index % 5),
        status: 'FORMING',
      },
    });
    await prisma.podMember.create({
      data: { podId: pod.id, userId: ambassador.id },
    });
    created += 1;
  }

  console.log(`Created ${created} launch pods.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
