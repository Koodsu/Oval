ALTER TABLE "Report" ADD COLUMN "directMessageId" TEXT;
ALTER TABLE "Report" ADD COLUMN "clubId" TEXT;
ALTER TABLE "Report" ADD COLUMN "clubMessageId" TEXT;
ALTER TABLE "Report" ADD COLUMN "clubOfficerMessageId" TEXT;
ALTER TABLE "Report" ADD COLUMN "clubAnnouncementId" TEXT;
ALTER TABLE "Report" ADD COLUMN "targetType" TEXT;

CREATE INDEX "Report_directMessageId_idx" ON "Report"("directMessageId");
CREATE INDEX "Report_clubId_idx" ON "Report"("clubId");
CREATE INDEX "Report_clubMessageId_idx" ON "Report"("clubMessageId");
CREATE INDEX "Report_clubOfficerMessageId_idx" ON "Report"("clubOfficerMessageId");
CREATE INDEX "Report_clubAnnouncementId_idx" ON "Report"("clubAnnouncementId");
