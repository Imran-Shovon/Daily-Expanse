-- CreateEnum
CREATE TYPE "SavingsEntryType" AS ENUM ('DEPOSIT', 'WITHDRAWAL');

-- CreateTable
CREATE TABLE "savings_goals" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "targetAmount" DECIMAL(14,2),
    "targetDate" DATE,
    "icon" VARCHAR(40) NOT NULL,
    "color" VARCHAR(7) NOT NULL,
    "notes" VARCHAR(1000),
    "startedOn" DATE NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "savings_goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "savings_entries" (
    "id" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "type" "SavingsEntryType" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "date" DATE NOT NULL,
    "notes" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "savings_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "savings_goals_userId_idx" ON "savings_goals"("userId");

-- CreateIndex
CREATE INDEX "savings_entries_goalId_date_idx" ON "savings_entries"("goalId", "date");

-- AddForeignKey
ALTER TABLE "savings_goals" ADD CONSTRAINT "savings_goals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "savings_entries" ADD CONSTRAINT "savings_entries_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "savings_goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
