-- AlterTable UserCredit (idempotent : query 1 a déjà pu s'exécuter)
ALTER TABLE `UserCredit`
  DROP COLUMN IF EXISTS `creditIncluded`,
  DROP COLUMN IF EXISTS `creditAdded`;

ALTER TABLE `UserCredit`
  ADD COLUMN IF NOT EXISTS `quotas` JSON NULL;

UPDATE `UserCredit` SET `quotas` = '{}' WHERE `quotas` IS NULL;

ALTER TABLE `UserCredit`
  MODIFY COLUMN `quotas` JSON NOT NULL;

-- AlterTable Plan : colonnes nullable d'abord pour éviter l'erreur sur les lignes existantes
ALTER TABLE `Plan`
  DROP COLUMN IF EXISTS `creditIncluded`;

ALTER TABLE `Plan`
  MODIFY COLUMN `name` ENUM('Freemium', 'Betatesteur', 'Starter_mensuel', 'Starter_annuel', 'Pro_mensuel', 'Pro_annuel') NOT NULL,
  MODIFY COLUMN `interval` ENUM('monthly', 'yearly') NOT NULL;

ALTER TABLE `Plan`
  ADD COLUMN IF NOT EXISTS `creditsIncluded` JSON NULL,
  ADD COLUMN IF NOT EXISTS `stripeProductId` VARCHAR(191) NULL,
  ADD COLUMN IF NOT EXISTS `stripePriceId` VARCHAR(191) NULL;

UPDATE `Plan` SET `creditsIncluded` = '{}' WHERE `creditsIncluded` IS NULL;
UPDATE `Plan` SET `stripeProductId` = '' WHERE `stripeProductId` IS NULL;
UPDATE `Plan` SET `stripePriceId` = '' WHERE `stripePriceId` IS NULL;

ALTER TABLE `Plan`
  MODIFY COLUMN `creditsIncluded` JSON NOT NULL,
  MODIFY COLUMN `stripeProductId` VARCHAR(191) NOT NULL,
  MODIFY COLUMN `stripePriceId` VARCHAR(191) NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS `Plan_name_interval_key` ON `Plan` (`name`, `interval`);

-- CreateTable CreditTransaction
CREATE TABLE IF NOT EXISTS `CreditTransaction` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `feature` VARCHAR(191) NOT NULL,
    `amount` INTEGER NOT NULL,
    `balanceAfter` INTEGER NOT NULL,
    `type` ENUM('SUBSCRIPTION', 'PURCHASE', 'CONSUMPTION', 'BONUS', 'REFUND', 'ADMIN', 'EXPIRE') NOT NULL,
    `description` VARCHAR(191) NULL,
    `sourceId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `userId` INTEGER NOT NULL,

    INDEX `CreditTransaction_userId_idx`(`userId`),
    INDEX `CreditTransaction_feature_idx`(`feature`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable ProcessedStripeEvent
CREATE TABLE IF NOT EXISTS `ProcessedStripeEvent` (
    `idProcessed` INTEGER NOT NULL AUTO_INCREMENT,
    `eventId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `processedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ProcessedStripeEvent_eventId_key`(`eventId`),
    PRIMARY KEY (`idProcessed`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CreditTransaction` ADD CONSTRAINT `CreditTransaction_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`idUser`) ON DELETE CASCADE ON UPDATE CASCADE;
