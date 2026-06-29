-- Club lifecycle, onboarding & verification (Phase 0)
-- See docs/CLUB_LIFECYCLE_IMPLEMENTATION.md. String columns (not Postgres enums)
-- match the repo convention (cf. ClubMeeting.visibility, ClubMember.role).

-- ── User: reviewer capability ─────────────────────────────────────────────────
ALTER TABLE "User"
ADD COLUMN "isClubReviewer" BOOLEAN NOT NULL DEFAULT false;

-- ── Club: four lifecycle axes + verification metadata ─────────────────────────
ALTER TABLE "Club"
ADD COLUMN "isDiscoverable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "verification" TEXT NOT NULL DEFAULT 'UNVERIFIED',
ADD COLUMN "joinPolicy" TEXT NOT NULL DEFAULT 'OPEN',
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN "verificationMethod" TEXT,
ADD COLUMN "verifiedAt" TIMESTAMP(3),
ADD COLUMN "verifiedByUserId" TEXT,
ADD COLUMN "instagramHandle" TEXT,
ADD COLUMN "officialEmail" TEXT,
ADD COLUMN "lastReaffirmedAt" TIMESTAMP(3),
ADD COLUMN "discoverableSince" TIMESTAMP(3),
ADD COLUMN "suspendedAt" TIMESTAMP(3),
ADD COLUMN "suspendedReason" TEXT;

CREATE INDEX "Club_isDiscoverable_status_category_idx" ON "Club"("isDiscoverable", "status", "category");
CREATE INDEX "Club_university_isDiscoverable_idx" ON "Club"("university", "isDiscoverable");

-- ── ClubFollower ──────────────────────────────────────────────────────────────
CREATE TABLE "ClubFollower" (
  "id" TEXT NOT NULL,
  "clubId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ClubFollower_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClubFollower_clubId_userId_key" ON "ClubFollower"("clubId", "userId");
CREATE INDEX "ClubFollower_clubId_idx" ON "ClubFollower"("clubId");
CREATE INDEX "ClubFollower_userId_idx" ON "ClubFollower"("userId");

ALTER TABLE "ClubFollower"
ADD CONSTRAINT "ClubFollower_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClubFollower"
ADD CONSTRAINT "ClubFollower_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── ClubClaim ─────────────────────────────────────────────────────────────────
CREATE TABLE "ClubClaim" (
  "id" TEXT NOT NULL,
  "clubId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "method" TEXT NOT NULL,
  "handleOrEmail" TEXT NOT NULL,
  "challengeCode" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "reviewerId" TEXT,
  "reviewNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "resolvedAt" TIMESTAMP(3),

  CONSTRAINT "ClubClaim_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClubClaim_clubId_status_idx" ON "ClubClaim"("clubId", "status");
CREATE INDEX "ClubClaim_status_createdAt_idx" ON "ClubClaim"("status", "createdAt");

ALTER TABLE "ClubClaim"
ADD CONSTRAINT "ClubClaim_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClubClaim"
ADD CONSTRAINT "ClubClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── ClubInvite ────────────────────────────────────────────────────────────────
CREATE TABLE "ClubInvite" (
  "id" TEXT NOT NULL,
  "clubId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "maxUses" INTEGER,
  "uses" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ClubInvite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClubInvite_code_key" ON "ClubInvite"("code");
CREATE INDEX "ClubInvite_clubId_idx" ON "ClubInvite"("clubId");

ALTER TABLE "ClubInvite"
ADD CONSTRAINT "ClubInvite_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── ClubApplicationCycle ──────────────────────────────────────────────────────
CREATE TABLE "ClubApplicationCycle" (
  "id" TEXT NOT NULL,
  "clubId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "questionsJson" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "opensAt" TIMESTAMP(3),
  "closesAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ClubApplicationCycle_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClubApplicationCycle_clubId_status_idx" ON "ClubApplicationCycle"("clubId", "status");

ALTER TABLE "ClubApplicationCycle"
ADD CONSTRAINT "ClubApplicationCycle_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── ClubApplication ───────────────────────────────────────────────────────────
CREATE TABLE "ClubApplication" (
  "id" TEXT NOT NULL,
  "cycleId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "answersJson" TEXT NOT NULL,
  "stage" TEXT NOT NULL DEFAULT 'APPLIED',
  "reviewNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ClubApplication_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClubApplication_cycleId_userId_key" ON "ClubApplication"("cycleId", "userId");
CREATE INDEX "ClubApplication_cycleId_stage_idx" ON "ClubApplication"("cycleId", "stage");

ALTER TABLE "ClubApplication"
ADD CONSTRAINT "ClubApplication_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "ClubApplicationCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClubApplication"
ADD CONSTRAINT "ClubApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Backfill from legacy booleans ─────────────────────────────────────────────
-- Existing public clubs become discoverable; existing verified clubs keep the badge.
UPDATE "Club" SET "isDiscoverable" = "isPublic";
UPDATE "Club" SET "discoverableSince" = "createdAt" WHERE "isPublic" = true;
UPDATE "Club"
SET "verification" = 'VERIFIED',
    "verificationMethod" = 'MANUAL',
    "verifiedAt" = "updatedAt",
    "lastReaffirmedAt" = "updatedAt"
WHERE "isVerified" = true;
