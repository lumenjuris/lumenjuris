-- AlterTable
ALTER TABLE `billingoneshot` ADD COLUMN `deliveryStatus` ENUM('PENDING', 'READY', 'FAILED') NOT NULL DEFAULT 'PENDING',
    ADD COLUMN `documentContent` JSON NULL,
    ADD COLUMN `emailSentAt` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `LivrableAchat` (
    `idLivrable` INTEGER NOT NULL AUTO_INCREMENT,
    `kind` ENUM('PDF', 'DOCX', 'FICHE') NOT NULL,
    `filePath` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `billingOneShotId` INTEGER NOT NULL,

    UNIQUE INDEX `LivrableAchat_billingOneShotId_kind_key`(`billingOneShotId`, `kind`),
    PRIMARY KEY (`idLivrable`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `LivrableAchat` ADD CONSTRAINT `LivrableAchat_billingOneShotId_fkey` FOREIGN KEY (`billingOneShotId`) REFERENCES `BillingOneShot`(`idBilling`) ON DELETE CASCADE ON UPDATE CASCADE;
