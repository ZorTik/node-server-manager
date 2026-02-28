-- DropForeignKey
ALTER TABLE `ImageBuildOption` DROP FOREIGN KEY `ImageBuildOption_imageId_fkey`;

-- AddForeignKey
ALTER TABLE `ImageBuildOption` ADD CONSTRAINT `ImageBuildOption_imageId_fkey` FOREIGN KEY (`imageId`) REFERENCES `Image`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
