/*
  Warnings:

  - A unique constraint covering the columns `[billingOneShotId]` on the table `Facture` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `stripeProductId` to the `ItemBilling` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `facture` DROP FOREIGN KEY `Facture_subscriptionId_fkey`;

-- DropIndex
DROP INDEX `Facture_subscriptionId_fkey` ON `facture`;

-- AlterTable
ALTER TABLE `facture` ADD COLUMN `billingOneShotId` INTEGER NULL,
    MODIFY `subscriptionId` INTEGER NULL;

-- AlterTable
ALTER TABLE `itembilling` ADD COLUMN `stripeProductId` VARCHAR(191) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Facture_billingOneShotId_key` ON `Facture`(`billingOneShotId`);

-- AddForeignKey
ALTER TABLE `Facture` ADD CONSTRAINT `Facture_subscriptionId_fkey` FOREIGN KEY (`subscriptionId`) REFERENCES `Subscription`(`idSubscription`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Facture` ADD CONSTRAINT `Facture_billingOneShotId_fkey` FOREIGN KEY (`billingOneShotId`) REFERENCES `BillingOneShot`(`idBilling`) ON DELETE SET NULL ON UPDATE CASCADE;
