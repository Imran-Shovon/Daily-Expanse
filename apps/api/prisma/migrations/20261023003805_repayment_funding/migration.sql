-- CreateEnum
CREATE TYPE "RepaymentSource" AS ENUM ('SALARY', 'SAVINGS', 'SALARY_AND_SAVINGS', 'LOAN', 'OTHER');

-- AlterTable
ALTER TABLE "loan_repayments" ADD COLUMN     "fundingLoanId" TEXT,
ADD COLUMN     "savingsEntryId" TEXT,
ADD COLUMN     "source" "RepaymentSource",
ADD COLUMN     "sourceNote" VARCHAR(300),
ADD COLUMN     "transactionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "loan_repayments_transactionId_key" ON "loan_repayments"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "loan_repayments_savingsEntryId_key" ON "loan_repayments"("savingsEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "loan_repayments_fundingLoanId_key" ON "loan_repayments"("fundingLoanId");

-- AddForeignKey
ALTER TABLE "loan_repayments" ADD CONSTRAINT "loan_repayments_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_repayments" ADD CONSTRAINT "loan_repayments_savingsEntryId_fkey" FOREIGN KEY ("savingsEntryId") REFERENCES "savings_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_repayments" ADD CONSTRAINT "loan_repayments_fundingLoanId_fkey" FOREIGN KEY ("fundingLoanId") REFERENCES "loans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

