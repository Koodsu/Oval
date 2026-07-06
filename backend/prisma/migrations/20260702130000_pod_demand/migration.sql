-- Phase 4 growth loops: lightweight demand pooling and first-pod nudge guard.
ALTER TABLE "PodMember" ADD COLUMN "firstPodNudgeSentAt" TIMESTAMP(3);

CREATE TABLE "PodDemand" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),

    CONSTRAINT "PodDemand_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PodDemand_userId_activityId_key" ON "PodDemand"("userId", "activityId");
CREATE INDEX "PodDemand_activityId_expiresAt_idx" ON "PodDemand"("activityId", "expiresAt");
CREATE INDEX "PodDemand_userId_expiresAt_idx" ON "PodDemand"("userId", "expiresAt");
CREATE INDEX "PodDemand_consumedAt_idx" ON "PodDemand"("consumedAt");

ALTER TABLE "PodDemand" ADD CONSTRAINT "PodDemand_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PodDemand" ADD CONSTRAINT "PodDemand_activityId_fkey"
  FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
