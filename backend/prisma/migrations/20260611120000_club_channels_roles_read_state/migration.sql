-- Club channels, per-channel read state, and role extras (color, self-assign)

-- ── ClubRole extras ───────────────────────────────────────────────────────────
ALTER TABLE "ClubRole"
ADD COLUMN "color" TEXT,
ADD COLUMN "isSelfAssignable" BOOLEAN NOT NULL DEFAULT false;

-- ── ClubChannel ───────────────────────────────────────────────────────────────
CREATE TABLE "ClubChannel" (
  "id" TEXT NOT NULL,
  "clubId" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'CUSTOM',
  "name" TEXT NOT NULL,
  "description" TEXT,
  "allowedRoleIds" TEXT,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ClubChannel_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClubChannel_clubId_name_key" ON "ClubChannel"("clubId", "name");
CREATE INDEX "ClubChannel_clubId_position_idx" ON "ClubChannel"("clubId", "position");

ALTER TABLE "ClubChannel"
ADD CONSTRAINT "ClubChannel_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── ClubChannelReadState ──────────────────────────────────────────────────────
CREATE TABLE "ClubChannelReadState" (
  "id" TEXT NOT NULL,
  "channelId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "lastReadAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ClubChannelReadState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClubChannelReadState_channelId_userId_key" ON "ClubChannelReadState"("channelId", "userId");
CREATE INDEX "ClubChannelReadState_userId_idx" ON "ClubChannelReadState"("userId");

ALTER TABLE "ClubChannelReadState"
ADD CONSTRAINT "ClubChannelReadState_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "ClubChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClubChannelReadState"
ADD CONSTRAINT "ClubChannelReadState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── ClubMessage: channel link + role pings ────────────────────────────────────
ALTER TABLE "ClubMessage"
ADD COLUMN "channelId" TEXT,
ADD COLUMN "mentionRoleIds" TEXT;

CREATE INDEX "ClubMessage_channelId_createdAt_idx" ON "ClubMessage"("channelId", "createdAt");

ALTER TABLE "ClubMessage"
ADD CONSTRAINT "ClubMessage_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "ClubChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Backfill built-in channels for existing clubs ─────────────────────────────
-- (The API also lazily ensures these exist, so this is belt-and-suspenders.)
INSERT INTO "ClubChannel" ("id", "clubId", "kind", "name", "position", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, c."id", 'ANNOUNCEMENTS', 'Announcements', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Club" c
ON CONFLICT ("clubId", "name") DO NOTHING;

INSERT INTO "ClubChannel" ("id", "clubId", "kind", "name", "position", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, c."id", 'GENERAL', 'General', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Club" c
ON CONFLICT ("clubId", "name") DO NOTHING;

INSERT INTO "ClubChannel" ("id", "clubId", "kind", "name", "position", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, c."id", 'OFFICERS', 'Officers', 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Club" c
ON CONFLICT ("clubId", "name") DO NOTHING;
