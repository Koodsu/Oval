ALTER TABLE "ClubMessage" ADD COLUMN "replyToId" TEXT;

ALTER TABLE "ClubMessage"
ADD CONSTRAINT "ClubMessage_replyToId_fkey"
FOREIGN KEY ("replyToId") REFERENCES "ClubMessage"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ClubMessageReaction" (
  "id" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "emoji" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClubMessageReaction_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ClubMessageReaction"
ADD CONSTRAINT "ClubMessageReaction_messageId_fkey"
FOREIGN KEY ("messageId") REFERENCES "ClubMessage"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClubMessageReaction"
ADD CONSTRAINT "ClubMessageReaction_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "ClubMessageReaction_messageId_userId_emoji_key"
ON "ClubMessageReaction"("messageId", "userId", "emoji");
CREATE INDEX "ClubMessageReaction_messageId_idx" ON "ClubMessageReaction"("messageId");
CREATE INDEX "ClubMessageReaction_userId_idx" ON "ClubMessageReaction"("userId");
