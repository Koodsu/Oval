ALTER TABLE "ClubAnnouncement"
ADD COLUMN "meetingId" TEXT,
ADD COLUMN "notifyMembers" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "ClubAnnouncement"
ADD CONSTRAINT "ClubAnnouncement_meetingId_fkey"
FOREIGN KEY ("meetingId") REFERENCES "ClubMeeting"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ClubAnnouncement_meetingId_idx" ON "ClubAnnouncement"("meetingId");
