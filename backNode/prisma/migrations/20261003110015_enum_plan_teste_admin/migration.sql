-- AlterTable
ALTER TABLE `plan` MODIFY `name` ENUM('Freemium', 'Betatesteur', 'Starter_mensuel', 'Starter_annuel', 'Pro_mensuel', 'Pro_annuel', 'Teste_admin') NOT NULL;
