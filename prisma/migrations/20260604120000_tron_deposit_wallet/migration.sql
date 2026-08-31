-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "walletPrivateKeyEnc" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "walletNetwork" TEXT;
