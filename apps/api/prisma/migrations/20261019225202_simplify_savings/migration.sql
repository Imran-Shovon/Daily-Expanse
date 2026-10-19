-- DropForeignKey
ALTER TABLE "savings_entries" DROP CONSTRAINT "savings_entries_goalId_fkey";

-- DropForeignKey
ALTER TABLE "savings_goals" DROP CONSTRAINT "savings_goals_userId_fkey";

-- DropIndex
DROP INDEX "savings_entries_goalId_date_idx";

-- AlterTable
ALTER TABLE "savings_entries" DROP COLUMN "goalId",
ADD COLUMN     "userId" TEXT NOT NULL;

-- DropTable
DROP TABLE "savings_goals";

-- CreateIndex
CREATE INDEX "savings_entries_userId_date_idx" ON "savings_entries"("userId", "date");

-- AddForeignKey
ALTER TABLE "savings_entries" ADD CONSTRAINT "savings_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

