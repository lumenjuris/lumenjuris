-- CreateTable
CREATE TABLE `NegotiationPlaybookAnalysis` (
    `idAnalysis` INTEGER NOT NULL AUTO_INCREMENT,
    `externalId` VARCHAR(191) NOT NULL,
    `fileName` TEXT NOT NULL,
    `compliantCount` INTEGER NOT NULL DEFAULT 0,
    `nonCompliantCount` INTEGER NOT NULL DEFAULT 0,
    `toCheckCount` INTEGER NOT NULL DEFAULT 0,
    `snapshot` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `playbookId` INTEGER NULL,
    `userId` INTEGER NOT NULL,

    UNIQUE INDEX `NegotiationPlaybookAnalysis_externalId_key`(`externalId`),
    INDEX `NegotiationPlaybookAnalysis_userId_idx`(`userId`),
    PRIMARY KEY (`idAnalysis`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `NegotiationPlaybookAnalysis` ADD CONSTRAINT `NegotiationPlaybookAnalysis_playbookId_fkey` FOREIGN KEY (`playbookId`) REFERENCES `NegotiationPlaybook`(`idPlaybook`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NegotiationPlaybookAnalysis` ADD CONSTRAINT `NegotiationPlaybookAnalysis_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`idUser`) ON DELETE CASCADE ON UPDATE CASCADE;
