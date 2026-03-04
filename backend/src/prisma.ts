import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Gracefully disconnect on process termination
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

export default prisma;
