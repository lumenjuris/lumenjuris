-- AlterTable
ALTER TABLE `billingoneshot` ADD COLUMN `aiSummary` JSON NULL,
    ADD COLUMN `generationCreditRefundedAt` DATETIME(3) NULL,
    ADD COLUMN `refundGenerationCredit` BOOLEAN NOT NULL DEFAULT false;
