import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const activities = [
  {
    title: 'Morning Coffee Walk',
    description: 'A casual 20-minute walk to grab coffee and chat with new people.',
    defaultLocation: 'Campus Coffee Cart – Main Quad',
  },
  {
    title: 'Study Group Sprint',
    description: '90-minute focused study session — bring your own work, share the energy.',
    defaultLocation: 'Library – Group Study Room 3',
  },
  {
    title: 'Frisbee on the Lawn',
    description: 'Casual frisbee toss on the main lawn. No experience needed.',
    defaultLocation: 'Main Lawn – Near the Fountain',
  },
  {
    title: 'Lunch Together',
    description: 'Meet up at the dining hall for lunch and good conversation.',
    defaultLocation: 'Dining Hall – East Entrance',
  },
  {
    title: 'Evening Campus Walk',
    description: 'A relaxed evening walk around campus to unwind and meet people.',
    defaultLocation: 'Front Steps – Student Union',
  },
];

async function main() {
  const existing = await prisma.activity.count();

  if (existing > 0) {
    console.log(`Activities already seeded (${existing} found). Skipping.`);
    return;
  }

  await prisma.activity.createMany({ data: activities });
  console.log(`Seeded ${activities.length} activities.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
