ALTER TABLE "User"
ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "accountStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN "accountStatusChangedAt" TIMESTAMP(3),
ADD COLUMN "moderationReason" TEXT,
ADD COLUMN "termsVersion" TEXT,
ADD COLUMN "termsAcceptedAt" TIMESTAMP(3),
ADD COLUMN "ageAttestedAt" TIMESTAMP(3);

ALTER TABLE "Report"
ADD COLUMN "contentRemovedAt" TIMESTAMP(3),
ADD COLUMN "accountAction" TEXT,
ADD COLUMN "accountActionAt" TIMESTAMP(3),
ADD COLUMN "reportedContent" TEXT;

ALTER TABLE "Report" DROP CONSTRAINT "Report_reporterId_fkey";
ALTER TABLE "Report" DROP CONSTRAINT "Report_targetUserId_fkey";
ALTER TABLE "Report" DROP CONSTRAINT "Report_podId_fkey";
ALTER TABLE "Report" DROP CONSTRAINT "Report_messageId_fkey";
ALTER TABLE "Report" ALTER COLUMN "reporterId" DROP NOT NULL;
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Report" ADD CONSTRAINT "Report_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Report" ADD CONSTRAINT "Report_podId_fkey" FOREIGN KEY ("podId") REFERENCES "Pod"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Report" ADD CONSTRAINT "Report_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "BannedIdentity" (
  "id" TEXT NOT NULL,
  "emailHash" TEXT NOT NULL,
  "reason" TEXT,
  "reportId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "BannedIdentity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AbuseEvent" (
  "id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "identifier" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AbuseEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BannedIdentity_emailHash_key" ON "BannedIdentity"("emailHash");
CREATE INDEX "BannedIdentity_createdAt_idx" ON "BannedIdentity"("createdAt");
CREATE INDEX "AbuseEvent_action_identifier_createdAt_idx" ON "AbuseEvent"("action", "identifier", "createdAt");
CREATE INDEX "AbuseEvent_createdAt_idx" ON "AbuseEvent"("createdAt");
