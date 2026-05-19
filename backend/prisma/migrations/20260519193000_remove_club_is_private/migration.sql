UPDATE "Club"
SET "isPublic" = false
WHERE "isPrivate" = true;

DROP INDEX IF EXISTS "Club_isPrivate_category_idx";

ALTER TABLE "Club" DROP COLUMN "isPrivate";
