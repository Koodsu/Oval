-- AlterTable
ALTER TABLE "DirectMessageThread" ADD COLUMN     "userALastReadAt" TIMESTAMP(3),
ADD COLUMN     "userBLastReadAt" TIMESTAMP(3);
