-- CreateIndex
CREATE INDEX "Club_isPublic_category_idx" ON "Club"("isPublic", "category");

-- CreateIndex
CREATE INDEX "ClubMeeting_clubId_meetingTime_idx" ON "ClubMeeting"("clubId", "meetingTime");

-- CreateIndex
CREATE INDEX "ClubMeeting_meetingTime_idx" ON "ClubMeeting"("meetingTime");
