-- AlterTable
ALTER TABLE "Club" ADD COLUMN     "isPrivate" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ClubMeeting" ADD COLUMN     "attendanceCode" TEXT,
ADD COLUMN     "attendanceOpen" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "ClubOfficerMessage" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClubOfficerMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClubOfficerMessage_clubId_createdAt_idx" ON "ClubOfficerMessage"("clubId", "createdAt");

-- CreateIndex
CREATE INDEX "ClubOfficerMessage_userId_idx" ON "ClubOfficerMessage"("userId");

-- CreateIndex
CREATE INDEX "Club_isPrivate_category_idx" ON "Club"("isPrivate", "category");

-- CreateIndex
CREATE INDEX "ClubMeeting_createdById_idx" ON "ClubMeeting"("createdById");

-- AddForeignKey
ALTER TABLE "ClubOfficerMessage" ADD CONSTRAINT "ClubOfficerMessage_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubOfficerMessage" ADD CONSTRAINT "ClubOfficerMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
