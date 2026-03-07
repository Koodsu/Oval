-- AlterTable: add pre-meetup RSVP timestamp to PodMember
ALTER TABLE "PodMember" ADD COLUMN "confirmedAt" DATETIME;

-- CreateTable: NoShowReport
CREATE TABLE "NoShowReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "podId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NoShowReport_podId_fkey" FOREIGN KEY ("podId") REFERENCES "Pod" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "NoShowReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "NoShowReport_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "NoShowReport_podId_reporterId_targetUserId_key" ON "NoShowReport"("podId", "reporterId", "targetUserId");

-- CreateIndex
CREATE INDEX "NoShowReport_targetUserId_idx" ON "NoShowReport"("targetUserId");

-- CreateIndex
CREATE INDEX "NoShowReport_podId_idx" ON "NoShowReport"("podId");
