-- CreateTable
CREATE TABLE "PodWaitlist" (
    "id" TEXT NOT NULL,
    "podId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notifiedAt" TIMESTAMP(3),

    CONSTRAINT "PodWaitlist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PodWaitlist_podId_status_idx" ON "PodWaitlist"("podId", "status");

-- CreateIndex
CREATE INDEX "PodWaitlist_userId_idx" ON "PodWaitlist"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PodWaitlist_podId_userId_key" ON "PodWaitlist"("podId", "userId");

-- AddForeignKey
ALTER TABLE "PodWaitlist" ADD CONSTRAINT "PodWaitlist_podId_fkey" FOREIGN KEY ("podId") REFERENCES "Pod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PodWaitlist" ADD CONSTRAINT "PodWaitlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
