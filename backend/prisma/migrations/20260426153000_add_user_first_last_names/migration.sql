ALTER TABLE "User"
ADD COLUMN "firstName" TEXT,
ADD COLUMN "lastName" TEXT NOT NULL DEFAULT '';

UPDATE "User"
SET
  "firstName" = CASE
    WHEN POSITION(' ' IN BTRIM("name")) > 0 THEN SPLIT_PART(BTRIM("name"), ' ', 1)
    ELSE BTRIM("name")
  END,
  "lastName" = CASE
    WHEN POSITION(' ' IN BTRIM("name")) > 0
      THEN BTRIM(SUBSTRING(BTRIM("name") FROM POSITION(' ' IN BTRIM("name")) + 1))
    ELSE ''
  END;

ALTER TABLE "User"
ALTER COLUMN "firstName" SET NOT NULL;
