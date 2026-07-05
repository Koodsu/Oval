-- Durable Expo push-ticket persistence so receipt checks survive serverless
-- instance turnover (the previous in-memory queue was always empty by the
-- time the cron instance ran).
CREATE TABLE "PushReceipt" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushReceipt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PushReceipt_createdAt_idx" ON "PushReceipt"("createdAt");
