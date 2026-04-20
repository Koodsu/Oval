-- DropForeignKey
ALTER TABLE "Message" DROP CONSTRAINT "Message_podId_fkey";

-- DropForeignKey
ALTER TABLE "Message" DROP CONSTRAINT "Message_userId_fkey";

-- DropForeignKey
ALTER TABLE "PodMember" DROP CONSTRAINT "PodMember_podId_fkey";

-- DropForeignKey
ALTER TABLE "PodMember" DROP CONSTRAINT "PodMember_userId_fkey";

-- CreateIndex
CREATE INDEX "Message_podId_createdAt_idx" ON "Message"("podId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_userId_idx" ON "Message"("userId");

-- CreateIndex
CREATE INDEX "Pod_activityId_idx" ON "Pod"("activityId");

-- CreateIndex
CREATE INDEX "Pod_creatorId_idx" ON "Pod"("creatorId");

-- CreateIndex
CREATE INDEX "PodMember_userId_idx" ON "PodMember"("userId");

-- AddForeignKey
ALTER TABLE "PodMember" ADD CONSTRAINT "PodMember_podId_fkey" FOREIGN KEY ("podId") REFERENCES "Pod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PodMember" ADD CONSTRAINT "PodMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_podId_fkey" FOREIGN KEY ("podId") REFERENCES "Pod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
