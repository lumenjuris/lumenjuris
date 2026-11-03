-- CreateTable
CREATE TABLE `ItemBilling` (
    `idItemBilling` INTEGER NOT NULL AUTO_INCREMENT,
    `stripePriceId` VARCHAR(191) NOT NULL,
    `item` ENUM('CONTRACT_SANS_FILIGRANE') NOT NULL,

    UNIQUE INDEX `ItemBilling_item_key`(`item`),
    PRIMARY KEY (`idItemBilling`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BillingOneShot` (
    `idBilling` INTEGER NOT NULL AUTO_INCREMENT,
    `item` ENUM('CONTRACT_SANS_FILIGRANE') NOT NULL,
    `status` ENUM('PENDING', 'PAID', 'EXPIRED') NOT NULL DEFAULT 'PENDING',
    `contractRef` VARCHAR(191) NOT NULL,
    `amount` INTEGER NULL,
    `stripeCheckoutSessionId` VARCHAR(191) NOT NULL,
    `stripePaymentIntentId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `paidAt` DATETIME(3) NULL,
    `userId` INTEGER NOT NULL,

    UNIQUE INDEX `BillingOneShot_stripeCheckoutSessionId_key`(`stripeCheckoutSessionId`),
    INDEX `BillingOneShot_userId_contractRef_idx`(`userId`, `contractRef`),
    PRIMARY KEY (`idBilling`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `BillingOneShot` ADD CONSTRAINT `BillingOneShot_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`idUser`) ON DELETE RESTRICT ON UPDATE CASCADE;
