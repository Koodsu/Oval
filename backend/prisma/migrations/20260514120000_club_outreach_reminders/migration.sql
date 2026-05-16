ALTER TABLE "ClubMeeting" ADD COLUMN "rsvpReminderSentAt" TIMESTAMP(3);
ALTER TABLE "ClubMeeting" ADD COLUMN "rsvpReminderStatus" TEXT;
ALTER TABLE "ClubMeeting" ADD COLUMN "rsvpReminderCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ClubMeeting" ADD COLUMN "rsvpReminderError" TEXT;
