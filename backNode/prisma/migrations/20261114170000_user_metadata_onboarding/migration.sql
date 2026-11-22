-- CreateTable
CREATE TABLE `UserMetadata` (
    `idUserMetadata` INTEGER NOT NULL AUTO_INCREMENT,
    `onboardingStatus` ENUM('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED') NOT NULL DEFAULT 'NOT_STARTED',
    `onboardingVersion` INTEGER NOT NULL DEFAULT 1,
    `currentStep` INTEGER NOT NULL DEFAULT 0,
    `completedAt` DATETIME(3) NULL,
    `profession` VARCHAR(40) NULL,
    `professionOther` VARCHAR(60) NULL,
    `primaryIntents` JSON NULL,
    `contractVolume` VARCHAR(20) NULL,
    `teamSize` VARCHAR(20) NULL,
    `hasNoEnterprise` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `userId` INTEGER NOT NULL,

    UNIQUE INDEX `UserMetadata_userId_key`(`userId`),
    PRIMARY KEY (`idUserMetadata`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `UserMetadata` ADD CONSTRAINT `UserMetadata_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`idUser`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Comptes existants : ils ne sont pas de « nouveaux utilisateurs ». On leur
-- cree une ligne SKIPPED pour que le formulaire d'accueil ne leur soit pas
-- impose. Les comptes crees apres cette migration n'ont pas de ligne : elle
-- nait en NOT_STARTED au premier GET /user-metadata.
INSERT INTO `UserMetadata` (`userId`, `onboardingStatus`, `updatedAt`)
SELECT `idUser`, 'SKIPPED', CURRENT_TIMESTAMP(3) FROM `User`;
