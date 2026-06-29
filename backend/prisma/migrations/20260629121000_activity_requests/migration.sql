CREATE TABLE "ActivityRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "defaultLocation" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewerId" TEXT,
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ActivityRequest_status_createdAt_idx" ON "ActivityRequest"("status", "createdAt");
CREATE INDEX "ActivityRequest_userId_createdAt_idx" ON "ActivityRequest"("userId", "createdAt");

ALTER TABLE "ActivityRequest"
ADD CONSTRAINT "ActivityRequest_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

