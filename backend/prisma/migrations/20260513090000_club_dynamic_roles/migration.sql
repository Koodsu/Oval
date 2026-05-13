ALTER TABLE "Club" ADD COLUMN "officerPermissions" TEXT NOT NULL DEFAULT '[]';

ALTER TABLE "ClubMeeting" ADD COLUMN "targetRoleIds" TEXT;

ALTER TABLE "ClubAnnouncement" ADD COLUMN "targetRoleIds" TEXT;

UPDATE "ClubMember"
SET "role" = 'OWNER'
FROM "Club"
WHERE "ClubMember"."clubId" = "Club"."id"
  AND "ClubMember"."userId" = "Club"."createdById"
  AND "ClubMember"."role" = 'ADMIN';

CREATE TABLE "ClubRole" (
  "id" TEXT NOT NULL,
  "clubId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "permissions" TEXT NOT NULL DEFAULT '[]',
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ClubRole_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClubMemberRole" (
  "id" TEXT NOT NULL,
  "clubId" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "roleId" TEXT NOT NULL,
  "assignedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ClubMemberRole_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClubRole_clubId_name_key" ON "ClubRole"("clubId", "name");
CREATE INDEX "ClubRole_clubId_idx" ON "ClubRole"("clubId");
CREATE UNIQUE INDEX "ClubMemberRole_memberId_roleId_key" ON "ClubMemberRole"("memberId", "roleId");
CREATE INDEX "ClubMemberRole_clubId_idx" ON "ClubMemberRole"("clubId");
CREATE INDEX "ClubMemberRole_roleId_idx" ON "ClubMemberRole"("roleId");

ALTER TABLE "ClubRole" ADD CONSTRAINT "ClubRole_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClubRole" ADD CONSTRAINT "ClubRole_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClubMemberRole" ADD CONSTRAINT "ClubMemberRole_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "ClubMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClubMemberRole" ADD CONSTRAINT "ClubMemberRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "ClubRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;
