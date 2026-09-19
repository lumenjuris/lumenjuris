-- Chiffrement applicatif des champs sensibles (voir documentation/chiffrement_bdd.md).
--   - colonnes chiffrées : VARCHAR(191) → TEXT (la valeur chiffrée est plus longue) ;
--   - anciennes colonnes `encrypted*` → colonnes JSON chiffrées par l'extension Prisma ;
--   - jetons : on stocke l'empreinte SHA-256 (`tokenHash`) pour la recherche.
-- ⚠️ Prévue pour une base VIDE (reset au déploiement) : les colonnes `tokenHash` /
--    `snapshot` / `structure`… sont NOT NULL sans valeur par défaut.
-- Noms de tables en PascalCase : en production (Linux), MariaDB est sensible à la casse.

-- DropIndex
DROP INDEX `GuestAccess_token_idx` ON `GuestAccess`;

-- DropIndex
DROP INDEX `GuestAccess_token_key` ON `GuestAccess`;

-- DropIndex
DROP INDEX `SignatureEnvelope_signingToken_key` ON `SignatureEnvelope`;

-- DropIndex
DROP INDEX `Token_token_key` ON `Token`;

-- AlterTable
ALTER TABLE `Amendment` MODIFY `title` TEXT NOT NULL;

-- AlterTable
ALTER TABLE `Contract` MODIFY `title` TEXT NOT NULL,
    MODIFY `counterpartyName` TEXT NULL,
    MODIFY `responsibleName` TEXT NULL;

-- AlterTable
ALTER TABLE `ContractHistory` DROP COLUMN `encryptedSnapshot`,
    ADD COLUMN `snapshot` JSON NOT NULL;

-- AlterTable
ALTER TABLE `ContractSummary` MODIFY `duree` TEXT NULL,
    MODIFY `fileName` TEXT NULL;

-- AlterTable
ALTER TABLE `ContractTemplate` DROP COLUMN `encryptedStructure`,
    ADD COLUMN `structure` JSON NOT NULL;

-- AlterTable
ALTER TABLE `GenerationLog` DROP COLUMN `encryptedOutput`,
    ADD COLUMN `output` JSON NOT NULL;

-- AlterTable
ALTER TABLE `GuestAccess` ADD COLUMN `tokenHash` VARCHAR(191) NOT NULL,
    MODIFY `token` TEXT NOT NULL,
    MODIFY `email` TEXT NULL,
    MODIFY `name` TEXT NULL;

-- AlterTable
ALTER TABLE `NegotiationParticipant` MODIFY `name` TEXT NULL,
    MODIFY `email` TEXT NULL;

-- AlterTable
ALTER TABLE `SignatureEnvelope` DROP COLUMN `encryptedFields`,
    ADD COLUMN `envelopeFields` JSON NOT NULL,
    ADD COLUMN `signingTokenHash` VARCHAR(191) NOT NULL,
    MODIFY `signingToken` TEXT NOT NULL,
    MODIFY `selfName` TEXT NOT NULL,
    MODIFY `selfEmail` TEXT NOT NULL,
    MODIFY `counterpartyName` TEXT NOT NULL,
    MODIFY `counterpartyEmail` TEXT NOT NULL;

-- AlterTable
ALTER TABLE `Token` DROP COLUMN `token`,
    ADD COLUMN `tokenHash` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `User` MODIFY `nom` TEXT NULL,
    MODIFY `prenom` TEXT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `GuestAccess_tokenHash_key` ON `GuestAccess`(`tokenHash`);

-- CreateIndex
CREATE INDEX `GuestAccess_tokenHash_idx` ON `GuestAccess`(`tokenHash`);

-- CreateIndex
CREATE UNIQUE INDEX `SignatureEnvelope_signingTokenHash_key` ON `SignatureEnvelope`(`signingTokenHash`);

-- CreateIndex
CREATE UNIQUE INDEX `Token_tokenHash_key` ON `Token`(`tokenHash`);
