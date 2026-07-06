-- Pod-level read state for unread counts across Plans and Inbox.
CREATE TABLE "PodReadState" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "podId" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PodReadState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PodReadState_userId_podId_key" ON "PodReadState"("userId", "podId");
CREATE INDEX "PodReadState_userId_idx" ON "PodReadState"("userId");

ALTER TABLE "PodReadState" ADD CONSTRAINT "PodReadState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PodReadState" ADD CONSTRAINT "PodReadState_podId_fkey" FOREIGN KEY ("podId") REFERENCES "Pod"("id") ON DELETE CASCADE ON UPDATE CASCADE;
