-- CreateTable
CREATE TABLE `NegotiationPlaybook` (
    `idPlaybook` INTEGER NOT NULL AUTO_INCREMENT,
    `externalId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `contractType` VARCHAR(191) NULL,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `enterpriseId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `userId` INTEGER NOT NULL,

    UNIQUE INDEX `NegotiationPlaybook_externalId_key`(`externalId`),
    INDEX `NegotiationPlaybook_userId_idx`(`userId`),
    PRIMARY KEY (`idPlaybook`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `NegotiationRule` (
    `idRule` INTEGER NOT NULL AUTO_INCREMENT,
    `externalId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL DEFAULT 'Autre',
    `description` TEXT NULL,
    `ruleType` ENUM('MAX', 'MIN', 'REQUIRED', 'FORBIDDEN', 'ALLOWED_VALUES', 'INSTRUCTION') NOT NULL DEFAULT 'INSTRUCTION',
    `expectedValue` TEXT NULL,
    `unit` VARCHAR(191) NULL,
    `severity` ENUM('LOW', 'MEDIUM', 'HIGH') NOT NULL DEFAULT 'MEDIUM',
    `suggestion` TEXT NULL,
    `keywords` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `playbookId` INTEGER NOT NULL,

    UNIQUE INDEX `NegotiationRule_externalId_key`(`externalId`),
    INDEX `NegotiationRule_playbookId_idx`(`playbookId`),
    PRIMARY KEY (`idRule`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `NegotiationPlaybook` ADD CONSTRAINT `NegotiationPlaybook_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`idUser`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NegotiationRule` ADD CONSTRAINT `NegotiationRule_playbookId_fkey` FOREIGN KEY (`playbookId`) REFERENCES `NegotiationPlaybook`(`idPlaybook`) ON DELETE CASCADE ON UPDATE CASCADE;
