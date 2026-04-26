ALTER TABLE "ClubMeeting"
ADD COLUMN "visibility" TEXT NOT NULL DEFAULT 'PUBLIC';

UPDATE "ClubMeeting"
SET "visibility" = CASE
  WHEN "isPublic" = TRUE THEN 'PUBLIC'
  ELSE 'MEMBERS'
END;

ALTER TABLE "ClubAnnouncement"
ADD COLUMN "visibility" TEXT NOT NULL DEFAULT 'PUBLIC';
