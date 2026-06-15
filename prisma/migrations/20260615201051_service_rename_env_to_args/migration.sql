/*
  Warnings:

  - You are about to drop the column `env` on the `Service` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `Service` DROP COLUMN `env`,
    ADD COLUMN `args` JSON NOT NULL;
