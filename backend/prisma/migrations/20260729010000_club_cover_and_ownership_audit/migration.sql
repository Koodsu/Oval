-- Add an independently managed club cover image.
ALTER TABLE "Club" ADD COLUMN "coverUrl" TEXT;
ALTER TABLE "ClubMember" ADD COLUMN "permissions" TEXT;

-- Keep a durable audit trail for high-impact ownership handoffs.
CREATE TABLE "ClubOwnershipTransfer" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "fromUserId" TEXT,
    "toUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClubOwnershipTransfer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClubOwnershipTransfer_clubId_createdAt_idx"
ON "ClubOwnershipTransfer"("clubId", "createdAt");

CREATE INDEX "ClubOwnershipTransfer_fromUserId_idx"
ON "ClubOwnershipTransfer"("fromUserId");

CREATE INDEX "ClubOwnershipTransfer_toUserId_idx"
ON "ClubOwnershipTransfer"("toUserId");

ALTER TABLE "ClubOwnershipTransfer"
ADD CONSTRAINT "ClubOwnershipTransfer_clubId_fkey"
FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClubOwnershipTransfer"
ADD CONSTRAINT "ClubOwnershipTransfer_fromUserId_fkey"
FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ClubOwnershipTransfer"
ADD CONSTRAINT "ClubOwnershipTransfer_toUserId_fkey"
FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Club membership roles are the runtime authorization source. Enforce the
-- invariant in PostgreSQL so concurrent requests cannot create co-owners.
CREATE UNIQUE INDEX "ClubMember_single_owner_per_club_idx"
ON "ClubMember"("clubId")
WHERE "role" = 'OWNER';
