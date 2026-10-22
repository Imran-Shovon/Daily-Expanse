-- CreateEnum
CREATE TYPE "LoanDirection" AS ENUM ('BORROWED', 'LENT');

-- DropIndex
DROP INDEX "loans_userId_idx";

-- AlterTable
ALTER TABLE "loans" ADD COLUMN     "direction" "LoanDirection" NOT NULL DEFAULT 'BORROWED';

-- CreateIndex
CREATE INDEX "loans_userId_direction_idx" ON "loans"("userId", "direction");
