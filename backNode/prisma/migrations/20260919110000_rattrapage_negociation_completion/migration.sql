-- Rattrapage : modifications du schéma (mode « complétion guidée » de la négociation)
-- qui n'avaient jamais été transformées en migration.
-- Noms de tables en PascalCase : en production (Linux), MariaDB est sensible à la casse.

-- AlterTable
ALTER TABLE `GuestAccess` ADD COLUMN `email` VARCHAR(191) NULL,
    ADD COLUMN `fillSide` ENUM('OWNER', 'COUNTERPARTY', 'THIRD_PARTY') NULL,
    ADD COLUMN `lastSentAt` DATETIME(3) NULL,
    ADD COLUMN `name` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `NegotiationAudit` MODIFY `action` ENUM('SESSION_CREATED', 'STATUS_CHANGED', 'VERSION_CREATED', 'PROPOSAL_CREATED', 'PROPOSAL_STATUS_CHANGED', 'COMMENT_ADDED', 'PARTICIPANT_ADDED', 'PARTICIPANT_REMOVED', 'GUEST_INVITED', 'GUEST_REVOKED', 'GUEST_REMINDED', 'FIELD_FILLED', 'COMPLETION_FINISHED', 'VALIDATED', 'ABORTED') NOT NULL;

-- AlterTable
ALTER TABLE `NegotiationParticipant` MODIFY `role` ENUM('READER', 'COMMENTER', 'PROPOSER', 'VALIDATOR', 'FILLER') NOT NULL DEFAULT 'COMMENTER';

-- AlterTable
ALTER TABLE `NegotiationSession` ADD COLUMN `autoToSignature` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `mode` ENUM('NEGOTIATION', 'COMPLETION') NOT NULL DEFAULT 'NEGOTIATION';

-- CreateTable
CREATE TABLE `NegotiationField` (
    `idField` INTEGER NOT NULL AUTO_INCREMENT,
    `externalId` VARCHAR(191) NOT NULL,
    `variableId` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL DEFAULT 'text',
    `side` ENUM('OWNER', 'COUNTERPARTY', 'THIRD_PARTY') NOT NULL DEFAULT 'COUNTERPARTY',
    `required` BOOLEAN NOT NULL DEFAULT true,
    `position` INTEGER NOT NULL DEFAULT 0,
    `value` TEXT NULL,
    `filledById` INTEGER NULL,
    `filledAt` DATETIME(3) NULL,
    `negotiationId` INTEGER NOT NULL,

    UNIQUE INDEX `NegotiationField_externalId_key`(`externalId`),
    INDEX `NegotiationField_negotiationId_idx`(`negotiationId`),
    UNIQUE INDEX `NegotiationField_negotiationId_variableId_key`(`negotiationId`, `variableId`),
    PRIMARY KEY (`idField`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `NegotiationField` ADD CONSTRAINT `NegotiationField_negotiationId_fkey` FOREIGN KEY (`negotiationId`) REFERENCES `NegotiationSession`(`idNegotiation`) ON DELETE CASCADE ON UPDATE CASCADE;
