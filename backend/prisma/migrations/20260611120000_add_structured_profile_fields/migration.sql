-- Structured onboarding/profile fields (previously stuffed into bio text)
ALTER TABLE "User" ADD COLUMN     "purpose" TEXT;
ALTER TABLE "User" ADD COLUMN     "campusZones" TEXT;
ALTER TABLE "User" ADD COLUMN     "clubInterests" TEXT;
