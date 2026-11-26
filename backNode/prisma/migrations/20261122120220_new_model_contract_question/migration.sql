-- CreateTable
CREATE TABLE `contractGeneratorQuestion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `contractType` VARCHAR(191) NOT NULL,
    `questions` JSON NOT NULL,
    `status` ENUM('COLLECTING', 'REVIEW', 'READY', 'DISABLED') NOT NULL DEFAULT 'COLLECTING',
    `generationCount` INTEGER NOT NULL DEFAULT 1,
    `lastGeneratedAt` DATETIME(3) NULL,
    `validatedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `contractGeneratorQuestion_contractType_key`(`contractType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
