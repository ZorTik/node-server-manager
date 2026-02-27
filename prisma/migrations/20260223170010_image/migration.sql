/*
  Warnings:

  - You are about to drop the `TemplateMeta` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE `Service` ADD COLUMN `imageId` VARCHAR(191) NULL;

-- DropTable
DROP TABLE `TemplateMeta`;

-- CreateTable
CREATE TABLE `Image` (
    `id` VARCHAR(191) NOT NULL,
    `templateId` VARCHAR(191) NOT NULL,
    `hash` VARCHAR(191) NOT NULL,
    `buildOptions` JSON NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Service` ADD CONSTRAINT `Service_imageId_fkey` FOREIGN KEY (`imageId`) REFERENCES `Image`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
