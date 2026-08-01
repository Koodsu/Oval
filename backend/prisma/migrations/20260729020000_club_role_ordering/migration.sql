ALTER TABLE "ClubRole" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;

WITH ranked AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "clubId"
      ORDER BY "createdAt" ASC, "name" ASC
    ) - 1 AS next_position
  FROM "ClubRole"
)
UPDATE "ClubRole"
SET "position" = ranked.next_position
FROM ranked
WHERE "ClubRole"."id" = ranked."id";

CREATE INDEX "ClubRole_clubId_position_idx" ON "ClubRole"("clubId", "position");
