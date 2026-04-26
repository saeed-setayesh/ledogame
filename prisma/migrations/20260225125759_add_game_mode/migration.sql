-- CreateEnum
CREATE TYPE "GameMode" AS ENUM ('CLASSIC', 'RUSH');

-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "gameMode" "GameMode" NOT NULL DEFAULT 'CLASSIC';
