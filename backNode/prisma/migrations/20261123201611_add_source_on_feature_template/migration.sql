-- AlterTable
ALTER TABLE `featureusage` ADD COLUMN `source` VARCHAR(191) NOT NULL DEFAULT 'web';

-- CreateIndex
CREATE INDEX `FeatureUsage_source_idx` ON `FeatureUsage`(`source`);
