-- CreateTable
CREATE TABLE `TemplateMeta` (
    `templateId` VARCHAR(191) NOT NULL,
    `image` VARCHAR(191) NULL,
    `hash` VARCHAR(191) NULL,

    PRIMARY KEY (`templateId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
