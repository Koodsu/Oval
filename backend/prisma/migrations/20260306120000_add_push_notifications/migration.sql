-- AlterTable: add push notification fields to User
ALTER TABLE "User" ADD COLUMN "pushToken" TEXT;
ALTER TABLE "User" ADD COLUMN "notificationPreferences" TEXT;
