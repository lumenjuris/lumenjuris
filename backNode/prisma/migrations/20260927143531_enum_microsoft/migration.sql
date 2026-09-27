-- AlterTable
ALTER TABLE `AuthProviderAccount`
MODIFY `provider` ENUM('GOOGLE', 'MICROSOFT') NOT NULL;