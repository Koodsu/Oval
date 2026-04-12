-- AlterTable
ALTER TABLE "Pod" ADD COLUMN     "recapNotifiedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "interestTags" TEXT;

-- CreateTable
CREATE TABLE "PodRecap" (
    "id" TEXT NOT NULL,
    "podId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PodRecap_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PodRecap_podId_idx" ON "PodRecap"("podId");

-- CreateIndex
CREATE INDEX "PodRecap_userId_idx" ON "PodRecap"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PodRecap_podId_userId_key" ON "PodRecap"("podId", "userId");

-- AddForeignKey
ALTER TABLE "PodRecap" ADD CONSTRAINT "PodRecap_podId_fkey" FOREIGN KEY ("podId") REFERENCES "Pod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PodRecap" ADD CONSTRAINT "PodRecap_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
