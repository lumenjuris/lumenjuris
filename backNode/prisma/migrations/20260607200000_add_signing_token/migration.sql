-- Add signingToken: fill NULL if column already exists, else add it
SET @exist := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='SignatureEnvelope' AND COLUMN_NAME='signingToken');
SET @sql := IF(@exist=0, 'ALTER TABLE `SignatureEnvelope` ADD COLUMN `signingToken` VARCHAR(191) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE `SignatureEnvelope` SET `signingToken` = CONCAT(LPAD(HEX(FLOOR(RAND()*4294967295)),8,'0'),LPAD(HEX(FLOOR(RAND()*4294967295)),8,'0'),LPAD(HEX(FLOOR(RAND()*4294967295)),8,'0'),LPAD(HEX(FLOOR(RAND()*4294967295)),8,'0')) WHERE `signingToken` IS NULL OR `signingToken` = '';

ALTER TABLE `SignatureEnvelope` MODIFY `signingToken` VARCHAR(191) NOT NULL;

SET @idx := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='SignatureEnvelope' AND INDEX_NAME='SignatureEnvelope_signingToken_key');
SET @sql2 := IF(@idx=0, 'CREATE UNIQUE INDEX `SignatureEnvelope_signingToken_key` ON `SignatureEnvelope`(`signingToken`)', 'SELECT 1');
PREPARE stmt2 FROM @sql2; EXECUTE stmt2; DEALLOCATE PREPARE stmt2;
