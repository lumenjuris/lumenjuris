-- CreateTable
CREATE TABLE `User` (
    `idUser` INTEGER NOT NULL AUTO_INCREMENT,
    `role` ENUM('USER', 'ADMIN', 'JURISTE', 'LECTEUR') NOT NULL DEFAULT 'USER',
    `email` VARCHAR(191) NOT NULL,
    `nom` VARCHAR(191) NULL,
    `prenom` VARCHAR(191) NULL,
    `password` VARCHAR(191) NULL,
    `isVerified` BOOLEAN NOT NULL DEFAULT false,
    `twoFactorEnabled` BOOLEAN NOT NULL DEFAULT false,
    `isBanned` BOOLEAN NOT NULL DEFAULT false,
    `cgu` BOOLEAN NOT NULL DEFAULT false,
    `stripeCustomerId` VARCHAR(191) NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`idUser`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuthProviderAccount` (
    `idAuthProvider` INTEGER NOT NULL AUTO_INCREMENT,
    `providerId` VARCHAR(191) NOT NULL,
    `provider` ENUM('GOOGLE') NOT NULL,
    `avatarUrl` VARCHAR(191) NULL,
    `userId` INTEGER NOT NULL,

    UNIQUE INDEX `AuthProviderAccount_providerId_key`(`providerId`),
    PRIMARY KEY (`idAuthProvider`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserPreference` (
    `idUserPreference` INTEGER NOT NULL AUTO_INCREMENT,
    `preferenceUI` JSON NULL,
    `accountParameters` JSON NULL,
    `userId` INTEGER NOT NULL,

    UNIQUE INDEX `UserPreference_userId_key`(`userId`),
    PRIMARY KEY (`idUserPreference`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Enterprise` (
    `idEnterprise` INTEGER NOT NULL AUTO_INCREMENT,
    `siren` VARCHAR(191) NULL,
    `codeNaf` VARCHAR(191) NULL,
    `intituleNaf` VARCHAR(191) NULL,
    `name` VARCHAR(191) NULL,
    `statusJuridiqueCode` VARCHAR(191) NULL,
    `statusJuridique` VARCHAR(191) NULL,
    `idccSelections` JSON NULL,
    `selectedIdccKey` VARCHAR(191) NULL,
    `userId` INTEGER NOT NULL,

    UNIQUE INDEX `Enterprise_userId_key`(`userId`),
    PRIMARY KEY (`idEnterprise`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Address` (
    `idAddress` INTEGER NOT NULL AUTO_INCREMENT,
    `address` VARCHAR(191) NULL,
    `codePostal` VARCHAR(191) NULL,
    `pays` VARCHAR(191) NULL DEFAULT 'FRANCE',
    `enterpriseId` INTEGER NOT NULL,

    UNIQUE INDEX `Address_enterpriseId_key`(`enterpriseId`),
    PRIMARY KEY (`idAddress`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Token` (
    `idToken` INTEGER NOT NULL AUTO_INCREMENT,
    `token` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `status` ENUM('ACTIVE', 'EXPIRED', 'USED') NOT NULL DEFAULT 'ACTIVE',
    `userId` INTEGER NOT NULL,

    UNIQUE INDEX `Token_token_key`(`token`),
    PRIMARY KEY (`idToken`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Event` (
    `idEvent` INTEGER NOT NULL AUTO_INCREMENT,
    `type` VARCHAR(191) NOT NULL,
    `state` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `userId` INTEGER NOT NULL,

    PRIMARY KEY (`idEvent`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DocumentCustom` (
    `idDocumentCustom` INTEGER NOT NULL AUTO_INCREMENT,
    `type` VARCHAR(191) NOT NULL,
    `templateContent` TEXT NOT NULL,
    `userId` INTEGER NULL,
    `eventId` INTEGER NULL,

    UNIQUE INDEX `DocumentCustom_eventId_key`(`eventId`),
    PRIMARY KEY (`idDocumentCustom`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DocumentTemplate` (
    `idDocument` INTEGER NOT NULL AUTO_INCREMENT,
    `type` VARCHAR(191) NOT NULL,
    `templateContent` TEXT NOT NULL,

    PRIMARY KEY (`idDocument`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ChatHistory` (
    `idChatHistory` INTEGER NOT NULL AUTO_INCREMENT,
    `conversations` LONGTEXT NOT NULL,
    `userId` INTEGER NOT NULL,

    UNIQUE INDEX `ChatHistory_userId_key`(`userId`),
    PRIMARY KEY (`idChatHistory`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ContractHistory` (
    `idHistory` INTEGER NOT NULL AUTO_INCREMENT,
    `externalId` VARCHAR(191) NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `contractType` VARCHAR(191) NULL,
    `overallRiskScore` DOUBLE NULL,
    `wordCount` INTEGER NOT NULL DEFAULT 0,
    `clausesCount` INTEGER NOT NULL DEFAULT 0,
    `activePatchCount` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `lastOpenedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `encryptedSnapshot` LONGTEXT NOT NULL,
    `userId` INTEGER NOT NULL,

    UNIQUE INDEX `ContractHistory_externalId_key`(`externalId`),
    INDEX `ContractHistory_userId_idx`(`userId`),
    PRIMARY KEY (`idHistory`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserCredit` (
    `idUserCredit` INTEGER NOT NULL AUTO_INCREMENT,
    `creditIncluded` INTEGER NOT NULL,
    `creditAdded` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,

    UNIQUE INDEX `UserCredit_userId_key`(`userId`),
    PRIMARY KEY (`idUserCredit`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FeatureUsage` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `feature` VARCHAR(191) NOT NULL,
    `userId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `FeatureUsage_userId_idx`(`userId`),
    INDEX `FeatureUsage_feature_idx`(`feature`),
    INDEX `FeatureUsage_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Subscription` (
    `idSubscription` INTEGER NOT NULL AUTO_INCREMENT,
    `status` ENUM('ACTIVE', 'CANCELLED', 'EXPIRED', 'PENDING') NOT NULL,
    `startAt` DATETIME(3) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `stripeSubscriptionId` VARCHAR(191) NULL,
    `stripePriceId` VARCHAR(191) NULL,
    `userId` INTEGER NOT NULL,
    `planId` INTEGER NOT NULL,

    UNIQUE INDEX `Subscription_userId_key`(`userId`),
    PRIMARY KEY (`idSubscription`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Plan` (
    `idPlan` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `price` INTEGER NOT NULL,
    `interval` VARCHAR(191) NOT NULL,
    `creditIncluded` INTEGER NOT NULL,

    PRIMARY KEY (`idPlan`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Facture` (
    `idFacture` INTEGER NOT NULL AUTO_INCREMENT,
    `price` INTEGER NOT NULL,
    `stripeInvoiceId` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PAID',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `subscriptionId` INTEGER NOT NULL,

    PRIMARY KEY (`idFacture`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Llm` (
    `idLlm` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `tokenPriceInput` INTEGER NOT NULL,
    `tokenPriceOutput` INTEGER NOT NULL,

    UNIQUE INDEX `Llm_name_key`(`name`),
    PRIMARY KEY (`idLlm`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ContractTemplate` (
    `idTemplate` INTEGER NOT NULL AUTO_INCREMENT,
    `externalId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `contractType` VARCHAR(191) NULL,
    `sourceFilename` VARCHAR(191) NULL,
    `sourceFilePath` VARCHAR(191) NULL,
    `encryptedStructure` LONGTEXT NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `userId` INTEGER NOT NULL,

    UNIQUE INDEX `ContractTemplate_externalId_key`(`externalId`),
    INDEX `ContractTemplate_userId_idx`(`userId`),
    PRIMARY KEY (`idTemplate`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TemplatePlaybook` (
    `idPlaybook` INTEGER NOT NULL AUTO_INCREMENT,
    `rulesText` LONGTEXT NOT NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `templateId` INTEGER NOT NULL,

    UNIQUE INDEX `TemplatePlaybook_templateId_key`(`templateId`),
    PRIMARY KEY (`idPlaybook`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DoctrinalNote` (
    `idNote` INTEGER NOT NULL AUTO_INCREMENT,
    `externalId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `content` LONGTEXT NOT NULL,
    `clauseRef` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `templateId` INTEGER NOT NULL,

    UNIQUE INDEX `DoctrinalNote_externalId_key`(`externalId`),
    INDEX `DoctrinalNote_templateId_idx`(`templateId`),
    PRIMARY KEY (`idNote`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GenerationLog` (
    `idLog` INTEGER NOT NULL AUTO_INCREMENT,
    `externalId` VARCHAR(191) NOT NULL,
    `variables` JSON NOT NULL,
    `promptTokens` INTEGER NOT NULL DEFAULT 0,
    `completionTokens` INTEGER NOT NULL DEFAULT 0,
    `encryptedOutput` LONGTEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `templateId` INTEGER NOT NULL,

    UNIQUE INDEX `GenerationLog_externalId_key`(`externalId`),
    INDEX `GenerationLog_templateId_idx`(`templateId`),
    PRIMARY KEY (`idLog`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SignatureEnvelope` (
    `idEnvelope` INTEGER NOT NULL AUTO_INCREMENT,
    `externalId` VARCHAR(191) NOT NULL,
    `documentName` VARCHAR(191) NOT NULL,
    `documentFilePath` VARCHAR(191) NULL,
    `numPages` INTEGER NOT NULL DEFAULT 1,
    `signingToken` VARCHAR(191) NOT NULL,
    `encryptedFields` LONGTEXT NOT NULL,
    `status` ENUM('DRAFT', 'SENT', 'PARTIALLY_SIGNED', 'SIGNED', 'DECLINED', 'EXPIRED') NOT NULL DEFAULT 'DRAFT',
    `selfName` VARCHAR(191) NOT NULL,
    `selfEmail` VARCHAR(191) NOT NULL,
    `counterpartyName` VARCHAR(191) NOT NULL,
    `counterpartyEmail` VARCHAR(191) NOT NULL,
    `sentAt` DATETIME(3) NULL,
    `selfSignedAt` DATETIME(3) NULL,
    `counterpartySignedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `userId` INTEGER NOT NULL,

    UNIQUE INDEX `SignatureEnvelope_externalId_key`(`externalId`),
    UNIQUE INDEX `SignatureEnvelope_signingToken_key`(`signingToken`),
    INDEX `SignatureEnvelope_userId_idx`(`userId`),
    INDEX `SignatureEnvelope_status_idx`(`status`),
    PRIMARY KEY (`idEnvelope`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserUpload` (
    `idUserUpload` INTEGER NOT NULL AUTO_INCREMENT,
    `uploadedImages` JSON NOT NULL,
    `userId` INTEGER NOT NULL,

    UNIQUE INDEX `UserUpload_userId_key`(`userId`),
    PRIMARY KEY (`idUserUpload`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LlmUsage` (
    `idLlmUsage` INTEGER NOT NULL AUTO_INCREMENT,
    `startAt` DATETIME(3) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `totalCostUsd` DECIMAL(18, 6) NOT NULL,
    `tokenInput` INTEGER NOT NULL,
    `tokenOutput` INTEGER NOT NULL,
    `llmId` INTEGER NOT NULL,

    UNIQUE INDEX `LlmUsage_llmId_startAt_key`(`llmId`, `startAt`),
    PRIMARY KEY (`idLlmUsage`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserLlmUsage` (
    `idUserLlmUsage` INTEGER NOT NULL AUTO_INCREMENT,
    `startAt` DATETIME(3) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `totalCostUsd` DECIMAL(18, 6) NOT NULL,
    `tokenInput` INTEGER NOT NULL,
    `tokenOutput` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `llmId` INTEGER NOT NULL,

    INDEX `UserLlmUsage_userId_idx`(`userId`),
    UNIQUE INDEX `UserLlmUsage_llmId_startAt_userId_key`(`llmId`, `startAt`, `userId`),
    PRIMARY KEY (`idUserLlmUsage`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Contract` (
    `idContract` INTEGER NOT NULL AUTO_INCREMENT,
    `externalId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `contractType` VARCHAR(191) NULL,
    `counterpartyName` VARCHAR(191) NULL,
    `responsibleName` VARCHAR(191) NULL,
    `status` ENUM('DRAFT', 'IN_NEGOTIATION', 'ACTIVE', 'TACIT_RENEWAL', 'EXPIRED', 'TERMINATED') NOT NULL DEFAULT 'DRAFT',
    `signatureDate` DATETIME(3) NULL,
    `effectiveDate` DATETIME(3) NULL,
    `endDate` DATETIME(3) NULL,
    `durationMonths` INTEGER NULL,
    `renewalType` ENUM('NONE', 'TACIT', 'EXPRESS') NOT NULL DEFAULT 'NONE',
    `noticePeriodDays` INTEGER NULL,
    `isB2C` BOOLEAN NOT NULL DEFAULT false,
    `amount` DECIMAL(18, 2) NULL,
    `currency` VARCHAR(191) NULL DEFAULT 'EUR',
    `governingLaw` VARCHAR(191) NULL,
    `documentFilePath` VARCHAR(191) NULL,
    `documentMimeType` VARCHAR(191) NULL,
    `ocrText` LONGTEXT NULL,
    `approvalStatus` ENUM('DRAFT', 'PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'DRAFT',
    `approvalNote` TEXT NULL,
    `approvedById` INTEGER NULL,
    `approvedAt` DATETIME(3) NULL,
    `isArchived` BOOLEAN NOT NULL DEFAULT false,
    `retentionUntil` DATETIME(3) NULL,
    `signatureEnvelopeExternalId` VARCHAR(191) NULL,
    `templateExternalId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `userId` INTEGER NOT NULL,
    `folderId` INTEGER NULL,

    UNIQUE INDEX `Contract_externalId_key`(`externalId`),
    INDEX `Contract_userId_idx`(`userId`),
    INDEX `Contract_status_idx`(`status`),
    INDEX `Contract_endDate_idx`(`endDate`),
    INDEX `Contract_folderId_idx`(`folderId`),
    PRIMARY KEY (`idContract`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ContractMetadataField` (
    `idField` INTEGER NOT NULL AUTO_INCREMENT,
    `fieldKey` VARCHAR(191) NOT NULL,
    `value` TEXT NULL,
    `confidenceScore` DOUBLE NULL,
    `validationStatus` ENUM('AI_SUGGESTED', 'HUMAN_VALIDATED', 'HUMAN_CORRECTED') NOT NULL DEFAULT 'AI_SUGGESTED',
    `validatedById` INTEGER NULL,
    `validatedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `contractId` INTEGER NOT NULL,

    INDEX `ContractMetadataField_contractId_idx`(`contractId`),
    UNIQUE INDEX `ContractMetadataField_contractId_fieldKey_key`(`contractId`, `fieldKey`),
    PRIMARY KEY (`idField`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Amendment` (
    `idAmendment` INTEGER NOT NULL AUTO_INCREMENT,
    `externalId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `documentFilePath` VARCHAR(191) NULL,
    `signatureDate` DATETIME(3) NULL,
    `effectiveDate` DATETIME(3) NULL,
    `summary` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `parentContractId` INTEGER NOT NULL,

    UNIQUE INDEX `Amendment_externalId_key`(`externalId`),
    INDEX `Amendment_parentContractId_idx`(`parentContractId`),
    PRIMARY KEY (`idAmendment`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ContractVersion` (
    `idVersion` INTEGER NOT NULL AUTO_INCREMENT,
    `versionNumber` INTEGER NOT NULL DEFAULT 1,
    `documentFilePath` VARCHAR(191) NULL,
    `contentText` LONGTEXT NULL,
    `note` TEXT NULL,
    `createdById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `contractId` INTEGER NOT NULL,

    INDEX `ContractVersion_contractId_idx`(`contractId`),
    UNIQUE INDEX `ContractVersion_contractId_versionNumber_key`(`contractId`, `versionNumber`),
    PRIMARY KEY (`idVersion`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Tag` (
    `idTag` INTEGER NOT NULL AUTO_INCREMENT,
    `externalId` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `color` VARCHAR(191) NOT NULL DEFAULT '#354F99',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `userId` INTEGER NOT NULL,

    UNIQUE INDEX `Tag_externalId_key`(`externalId`),
    INDEX `Tag_userId_idx`(`userId`),
    UNIQUE INDEX `Tag_userId_label_key`(`userId`, `label`),
    PRIMARY KEY (`idTag`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ContractTag` (
    `contractId` INTEGER NOT NULL,
    `tagId` INTEGER NOT NULL,

    INDEX `ContractTag_tagId_idx`(`tagId`),
    PRIMARY KEY (`contractId`, `tagId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Folder` (
    `idFolder` INTEGER NOT NULL AUTO_INCREMENT,
    `externalId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `userId` INTEGER NOT NULL,
    `parentId` INTEGER NULL,

    UNIQUE INDEX `Folder_externalId_key`(`externalId`),
    INDEX `Folder_userId_idx`(`userId`),
    INDEX `Folder_parentId_idx`(`parentId`),
    PRIMARY KEY (`idFolder`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `idAudit` INTEGER NOT NULL AUTO_INCREMENT,
    `action` ENUM('IMPORT', 'AI_EXTRACTION', 'FIELD_VALIDATION', 'METADATA_UPDATE', 'AMENDMENT_ADDED', 'VERSION_ADDED', 'DOCUMENT_ACCESS', 'EXPORT', 'ARCHIVE', 'DELETE') NOT NULL,
    `entityType` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NOT NULL,
    `payloadBefore` JSON NULL,
    `payloadAfter` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `userId` INTEGER NOT NULL,
    `contractId` INTEGER NULL,

    INDEX `AuditLog_userId_idx`(`userId`),
    INDEX `AuditLog_contractId_idx`(`contractId`),
    INDEX `AuditLog_entityType_entityId_idx`(`entityType`, `entityId`),
    PRIMARY KEY (`idAudit`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Clause` (
    `idClause` INTEGER NOT NULL AUTO_INCREMENT,
    `externalId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `category` ENUM('CONFIDENTIALITE', 'RESPONSABILITE', 'RESILIATION', 'PROPRIETE_INTELLECTUELLE', 'DONNEES_PERSONNELLES', 'PAIEMENT', 'DUREE_RENOUVELLEMENT', 'FORCE_MAJEURE', 'LITIGES', 'GARANTIES', 'NON_CONCURRENCE', 'AUTRE') NOT NULL DEFAULT 'AUTRE',
    `position` ENUM('IDEALE', 'ACCEPTABLE', 'LIGNE_ROUGE') NOT NULL DEFAULT 'IDEALE',
    `body` LONGTEXT NOT NULL,
    `notes` TEXT NULL,
    `language` VARCHAR(191) NOT NULL DEFAULT 'fr',
    `tags` VARCHAR(191) NULL,
    `isApproved` BOOLEAN NOT NULL DEFAULT false,
    `usageCount` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `userId` INTEGER NOT NULL,

    UNIQUE INDEX `Clause_externalId_key`(`externalId`),
    INDEX `Clause_userId_idx`(`userId`),
    INDEX `Clause_category_idx`(`category`),
    PRIMARY KEY (`idClause`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ContractComment` (
    `idComment` INTEGER NOT NULL AUTO_INCREMENT,
    `externalId` VARCHAR(191) NOT NULL,
    `body` TEXT NOT NULL,
    `resolved` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `contractId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,

    UNIQUE INDEX `ContractComment_externalId_key`(`externalId`),
    INDEX `ContractComment_contractId_idx`(`contractId`),
    INDEX `ContractComment_userId_idx`(`userId`),
    PRIMARY KEY (`idComment`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `NegotiationSession` (
    `idNegotiation` INTEGER NOT NULL AUTO_INCREMENT,
    `externalId` VARCHAR(191) NOT NULL,
    `contractExternalId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `status` ENUM('DRAFT', 'IN_NEGOTIATION', 'VALIDATED', 'BLOCKED', 'CLOSED') NOT NULL DEFAULT 'DRAFT',
    `mode` ENUM('NEGOTIATION', 'COMPLETION') NOT NULL DEFAULT 'NEGOTIATION',
    `autoToSignature` BOOLEAN NOT NULL DEFAULT false,
    `ownerUserId` INTEGER NOT NULL,
    `finalVersionId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `NegotiationSession_externalId_key`(`externalId`),
    INDEX `NegotiationSession_contractExternalId_idx`(`contractExternalId`),
    INDEX `NegotiationSession_ownerUserId_idx`(`ownerUserId`),
    PRIMARY KEY (`idNegotiation`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

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

-- CreateTable
CREATE TABLE `NegotiationVersion` (
    `idVersion` INTEGER NOT NULL AUTO_INCREMENT,
    `externalId` VARCHAR(191) NOT NULL,
    `versionNumber` INTEGER NOT NULL DEFAULT 1,
    `label` VARCHAR(191) NULL,
    `contentText` LONGTEXT NOT NULL,
    `structuredJson` JSON NULL,
    `createdById` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `negotiationId` INTEGER NOT NULL,

    UNIQUE INDEX `NegotiationVersion_externalId_key`(`externalId`),
    INDEX `NegotiationVersion_negotiationId_idx`(`negotiationId`),
    UNIQUE INDEX `NegotiationVersion_negotiationId_versionNumber_key`(`negotiationId`, `versionNumber`),
    PRIMARY KEY (`idVersion`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ClauseProposal` (
    `idProposal` INTEGER NOT NULL AUTO_INCREMENT,
    `externalId` VARCHAR(191) NOT NULL,
    `clauseRef` VARCHAR(191) NOT NULL,
    `originalText` TEXT NULL,
    `proposedText` TEXT NOT NULL,
    `type` VARCHAR(191) NOT NULL DEFAULT 'PROPOSED',
    `status` ENUM('PROPOSED', 'ACCEPTED', 'REJECTED', 'COUNTERED') NOT NULL DEFAULT 'PROPOSED',
    `authorParticipantId` INTEGER NULL,
    `createdById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `negotiationId` INTEGER NOT NULL,

    UNIQUE INDEX `ClauseProposal_externalId_key`(`externalId`),
    INDEX `ClauseProposal_negotiationId_idx`(`negotiationId`),
    INDEX `ClauseProposal_clauseRef_idx`(`clauseRef`),
    PRIMARY KEY (`idProposal`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `NegotiationComment` (
    `idComment` INTEGER NOT NULL AUTO_INCREMENT,
    `externalId` VARCHAR(191) NOT NULL,
    `clauseRef` VARCHAR(191) NULL,
    `body` TEXT NOT NULL,
    `visibility` ENUM('INTERNAL', 'EXTERNAL') NOT NULL DEFAULT 'INTERNAL',
    `parentCommentId` INTEGER NULL,
    `authorParticipantId` INTEGER NULL,
    `createdById` INTEGER NULL,
    `anchorStart` INTEGER NULL,
    `anchorEnd` INTEGER NULL,
    `quote` TEXT NULL,
    `proposedText` TEXT NULL,
    `resolved` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `negotiationId` INTEGER NOT NULL,

    UNIQUE INDEX `NegotiationComment_externalId_key`(`externalId`),
    INDEX `NegotiationComment_negotiationId_idx`(`negotiationId`),
    INDEX `NegotiationComment_clauseRef_idx`(`clauseRef`),
    PRIMARY KEY (`idComment`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `NegotiationParticipant` (
    `idParticipant` INTEGER NOT NULL AUTO_INCREMENT,
    `externalId` VARCHAR(191) NOT NULL,
    `side` ENUM('INTERNAL', 'EXTERNAL') NOT NULL DEFAULT 'INTERNAL',
    `role` ENUM('READER', 'COMMENTER', 'PROPOSER', 'VALIDATOR', 'FILLER') NOT NULL DEFAULT 'COMMENTER',
    `userId` INTEGER NULL,
    `name` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `negotiationId` INTEGER NOT NULL,

    UNIQUE INDEX `NegotiationParticipant_externalId_key`(`externalId`),
    INDEX `NegotiationParticipant_negotiationId_idx`(`negotiationId`),
    PRIMARY KEY (`idParticipant`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GuestAccess` (
    `idGuest` INTEGER NOT NULL AUTO_INCREMENT,
    `externalId` VARCHAR(191) NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `participantId` INTEGER NULL,
    `name` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `fillSide` ENUM('OWNER', 'COUNTERPARTY', 'THIRD_PARTY') NULL,
    `lastSentAt` DATETIME(3) NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `revokedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `negotiationId` INTEGER NOT NULL,

    UNIQUE INDEX `GuestAccess_externalId_key`(`externalId`),
    UNIQUE INDEX `GuestAccess_token_key`(`token`),
    INDEX `GuestAccess_negotiationId_idx`(`negotiationId`),
    INDEX `GuestAccess_token_idx`(`token`),
    PRIMARY KEY (`idGuest`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LegalWatchSource` (
    `idSource` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `lastRunAt` DATETIME(3) NULL,

    UNIQUE INDEX `LegalWatchSource_name_key`(`name`),
    PRIMARY KEY (`idSource`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LegalWatchItem` (
    `idItem` INTEGER NOT NULL AUTO_INCREMENT,
    `externalId` VARCHAR(191) NOT NULL,
    `providerId` VARCHAR(191) NOT NULL,
    `contentHash` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `jurisdiction` VARCHAR(191) NULL,
    `decisionDate` DATETIME(3) NULL,
    `sourceUrl` VARCHAR(191) NOT NULL,
    `rawText` LONGTEXT NOT NULL,
    `summary` TEXT NULL,
    `legalDomain` VARCHAR(191) NULL,
    `concepts` JSON NULL,
    `impactLevel` ENUM('HAUT', 'MOYEN', 'FAIBLE') NULL,
    `isEvolution` BOOLEAN NULL,
    `confidence` DOUBLE NULL,
    `enrichedAt` DATETIME(3) NULL,
    `enrichError` TEXT NULL,
    `status` ENUM('INGESTED', 'ENRICHED', 'PUBLISHED', 'DISCARDED', 'ERROR') NOT NULL DEFAULT 'INGESTED',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `sourceId` INTEGER NOT NULL,

    UNIQUE INDEX `LegalWatchItem_externalId_key`(`externalId`),
    UNIQUE INDEX `LegalWatchItem_contentHash_key`(`contentHash`),
    INDEX `LegalWatchItem_status_idx`(`status`),
    INDEX `LegalWatchItem_decisionDate_idx`(`decisionDate`),
    INDEX `LegalWatchItem_legalDomain_idx`(`legalDomain`),
    UNIQUE INDEX `LegalWatchItem_sourceId_providerId_key`(`sourceId`, `providerId`),
    PRIMARY KEY (`idItem`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LegalConceptMapping` (
    `idConcept` INTEGER NOT NULL AUTO_INCREMENT,
    `concept` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `legalDomain` VARCHAR(191) NOT NULL,
    `keywords` JSON NOT NULL,
    `contractTypes` JSON NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `LegalConceptMapping_concept_key`(`concept`),
    PRIMARY KEY (`idConcept`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LegalWatchAlert` (
    `idAlert` INTEGER NOT NULL AUTO_INCREMENT,
    `externalId` VARCHAR(191) NOT NULL,
    `userId` INTEGER NOT NULL,
    `contractIds` JSON NOT NULL,
    `status` ENUM('UNREAD', 'READ', 'DISMISSED') NOT NULL DEFAULT 'UNREAD',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `itemId` INTEGER NOT NULL,

    UNIQUE INDEX `LegalWatchAlert_externalId_key`(`externalId`),
    INDEX `LegalWatchAlert_userId_status_idx`(`userId`, `status`),
    UNIQUE INDEX `LegalWatchAlert_itemId_userId_key`(`itemId`, `userId`),
    PRIMARY KEY (`idAlert`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `NegotiationAudit` (
    `idAudit` INTEGER NOT NULL AUTO_INCREMENT,
    `action` ENUM('SESSION_CREATED', 'STATUS_CHANGED', 'VERSION_CREATED', 'PROPOSAL_CREATED', 'PROPOSAL_STATUS_CHANGED', 'COMMENT_ADDED', 'PARTICIPANT_ADDED', 'PARTICIPANT_REMOVED', 'GUEST_INVITED', 'GUEST_REVOKED', 'GUEST_REMINDED', 'FIELD_FILLED', 'COMPLETION_FINISHED', 'VALIDATED', 'ABORTED') NOT NULL,
    `actorUserId` INTEGER NULL,
    `actorLabel` VARCHAR(191) NULL,
    `versionId` INTEGER NULL,
    `payload` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `negotiationId` INTEGER NOT NULL,

    INDEX `NegotiationAudit_negotiationId_idx`(`negotiationId`),
    PRIMARY KEY (`idAudit`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ContractSummary` (
    `idSummary` INTEGER NOT NULL AUTO_INCREMENT,
    `externalId` VARCHAR(191) NOT NULL,
    `identification` JSON NOT NULL,
    `resume_executif` TEXT NOT NULL,
    `parties` JSON NOT NULL,
    `dates` JSON NOT NULL,
    `objet` TEXT NOT NULL,
    `obligations` JSON NOT NULL,
    `conditions_financieres` JSON NOT NULL,
    `responsabilite` JSON NOT NULL,
    `clauses_particulieres` JSON NOT NULL,
    `delais_importants` JSON NOT NULL,
    `annexes` JSON NOT NULL,
    `resiliation` JSON NOT NULL,
    `points_attention` JSON NOT NULL,
    `niveau_risque` JSON NULL,
    `duree` VARCHAR(191) NULL,
    `fileName` VARCHAR(191) NULL,
    `rawText` LONGTEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `userId` INTEGER NOT NULL,
    `contractId` INTEGER NULL,

    UNIQUE INDEX `ContractSummary_externalId_key`(`externalId`),
    INDEX `ContractSummary_userId_idx`(`userId`),
    PRIMARY KEY (`idSummary`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `AuthProviderAccount` ADD CONSTRAINT `AuthProviderAccount_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`idUser`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserPreference` ADD CONSTRAINT `UserPreference_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`idUser`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Enterprise` ADD CONSTRAINT `Enterprise_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`idUser`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Address` ADD CONSTRAINT `Address_enterpriseId_fkey` FOREIGN KEY (`enterpriseId`) REFERENCES `Enterprise`(`idEnterprise`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Token` ADD CONSTRAINT `Token_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`idUser`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Event` ADD CONSTRAINT `Event_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`idUser`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DocumentCustom` ADD CONSTRAINT `DocumentCustom_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`idUser`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DocumentCustom` ADD CONSTRAINT `DocumentCustom_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`idEvent`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChatHistory` ADD CONSTRAINT `ChatHistory_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`idUser`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContractHistory` ADD CONSTRAINT `ContractHistory_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`idUser`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserCredit` ADD CONSTRAINT `UserCredit_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`idUser`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FeatureUsage` ADD CONSTRAINT `FeatureUsage_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`idUser`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Subscription` ADD CONSTRAINT `Subscription_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`idUser`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Subscription` ADD CONSTRAINT `Subscription_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `Plan`(`idPlan`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Facture` ADD CONSTRAINT `Facture_subscriptionId_fkey` FOREIGN KEY (`subscriptionId`) REFERENCES `Subscription`(`idSubscription`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContractTemplate` ADD CONSTRAINT `ContractTemplate_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`idUser`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TemplatePlaybook` ADD CONSTRAINT `TemplatePlaybook_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `ContractTemplate`(`idTemplate`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DoctrinalNote` ADD CONSTRAINT `DoctrinalNote_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `ContractTemplate`(`idTemplate`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GenerationLog` ADD CONSTRAINT `GenerationLog_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `ContractTemplate`(`idTemplate`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SignatureEnvelope` ADD CONSTRAINT `SignatureEnvelope_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`idUser`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserUpload` ADD CONSTRAINT `UserUpload_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`idUser`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LlmUsage` ADD CONSTRAINT `LlmUsage_llmId_fkey` FOREIGN KEY (`llmId`) REFERENCES `Llm`(`idLlm`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserLlmUsage` ADD CONSTRAINT `UserLlmUsage_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`idUser`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserLlmUsage` ADD CONSTRAINT `UserLlmUsage_llmId_fkey` FOREIGN KEY (`llmId`) REFERENCES `Llm`(`idLlm`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Contract` ADD CONSTRAINT `Contract_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`idUser`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Contract` ADD CONSTRAINT `Contract_folderId_fkey` FOREIGN KEY (`folderId`) REFERENCES `Folder`(`idFolder`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContractMetadataField` ADD CONSTRAINT `ContractMetadataField_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `Contract`(`idContract`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Amendment` ADD CONSTRAINT `Amendment_parentContractId_fkey` FOREIGN KEY (`parentContractId`) REFERENCES `Contract`(`idContract`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContractVersion` ADD CONSTRAINT `ContractVersion_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `Contract`(`idContract`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Tag` ADD CONSTRAINT `Tag_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`idUser`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContractTag` ADD CONSTRAINT `ContractTag_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `Contract`(`idContract`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContractTag` ADD CONSTRAINT `ContractTag_tagId_fkey` FOREIGN KEY (`tagId`) REFERENCES `Tag`(`idTag`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Folder` ADD CONSTRAINT `Folder_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`idUser`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Folder` ADD CONSTRAINT `Folder_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `Folder`(`idFolder`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`idUser`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `Contract`(`idContract`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Clause` ADD CONSTRAINT `Clause_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`idUser`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContractComment` ADD CONSTRAINT `ContractComment_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `Contract`(`idContract`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContractComment` ADD CONSTRAINT `ContractComment_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`idUser`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NegotiationField` ADD CONSTRAINT `NegotiationField_negotiationId_fkey` FOREIGN KEY (`negotiationId`) REFERENCES `NegotiationSession`(`idNegotiation`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NegotiationVersion` ADD CONSTRAINT `NegotiationVersion_negotiationId_fkey` FOREIGN KEY (`negotiationId`) REFERENCES `NegotiationSession`(`idNegotiation`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClauseProposal` ADD CONSTRAINT `ClauseProposal_negotiationId_fkey` FOREIGN KEY (`negotiationId`) REFERENCES `NegotiationSession`(`idNegotiation`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NegotiationComment` ADD CONSTRAINT `NegotiationComment_negotiationId_fkey` FOREIGN KEY (`negotiationId`) REFERENCES `NegotiationSession`(`idNegotiation`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NegotiationParticipant` ADD CONSTRAINT `NegotiationParticipant_negotiationId_fkey` FOREIGN KEY (`negotiationId`) REFERENCES `NegotiationSession`(`idNegotiation`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GuestAccess` ADD CONSTRAINT `GuestAccess_negotiationId_fkey` FOREIGN KEY (`negotiationId`) REFERENCES `NegotiationSession`(`idNegotiation`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LegalWatchItem` ADD CONSTRAINT `LegalWatchItem_sourceId_fkey` FOREIGN KEY (`sourceId`) REFERENCES `LegalWatchSource`(`idSource`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LegalWatchAlert` ADD CONSTRAINT `LegalWatchAlert_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `LegalWatchItem`(`idItem`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NegotiationAudit` ADD CONSTRAINT `NegotiationAudit_negotiationId_fkey` FOREIGN KEY (`negotiationId`) REFERENCES `NegotiationSession`(`idNegotiation`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContractSummary` ADD CONSTRAINT `ContractSummary_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`idUser`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContractSummary` ADD CONSTRAINT `ContractSummary_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `Contract`(`idContract`) ON DELETE SET NULL ON UPDATE CASCADE;