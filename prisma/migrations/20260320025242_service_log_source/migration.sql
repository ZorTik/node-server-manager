/*
  Warnings:

  - Added the required column `source` to the `ServiceLogRecord` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `ServiceLogRecord` ADD COLUMN `source` ENUM('ENGINE', 'CONTAINER') NOT NULL;
