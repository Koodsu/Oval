/// <reference types="node" />
import { PrismaClient } from '@prisma/client';
import { ACTIVITY_CATALOG } from './activityCatalog';

const prisma = new PrismaClient();

async function main() {
  // This seed is intentionally destructive and is only for local/test databases.
  await prisma.report.deleteMany();
  await prisma.message.deleteMany();
  await prisma.podMember.deleteMany();
  await prisma.pod.deleteMany();
  await prisma.activity.deleteMany();
  await prisma.block.deleteMany();

  await prisma.activity.createMany({
    data: ACTIVITY_CATALOG.map((activity) => ({ ...activity, isActive: true })),
  });
  console.log(`Seeded ${ACTIVITY_CATALOG.length} activities.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
