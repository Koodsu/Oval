-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Pod" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "activityId" TEXT NOT NULL,
    "meetupTime" DATETIME NOT NULL,
    "location" TEXT NOT NULL,
    "locationType" TEXT NOT NULL DEFAULT 'public',
    "minMembers" INTEGER NOT NULL DEFAULT 2,
    "maxMembers" INTEGER NOT NULL DEFAULT 4,
    "status" TEXT NOT NULL DEFAULT 'FORMING',
    "creatorId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Pod_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Pod_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Pod" ("activityId", "createdAt", "id", "location", "meetupTime", "status") SELECT "activityId", "createdAt", "id", "location", "meetupTime", "status" FROM "Pod";
DROP TABLE "Pod";
ALTER TABLE "new_Pod" RENAME TO "Pod";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
