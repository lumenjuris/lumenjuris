/*
  Warnings:

  - Added the required column `questionsFinal` to the `contractGeneratorQuestion` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `contractgeneratorquestion` ADD COLUMN `questionsFinal` JSON NOT NULL;
