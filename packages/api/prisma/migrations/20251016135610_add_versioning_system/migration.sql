/*
  Warnings:

  - You are about to drop the column `payloadJson` on the `Version` table. All the data in the column will be lost.
  - Added the required column `payloadGz` to the `Version` table without a default value. This is not possible if the table is not empty.
  - Added the required column `version` to the `Version` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "public"."Version_entityType_entityId_branchId_idx";

-- DropIndex
DROP INDEX "public"."Version_validFrom_validTo_idx";

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Character" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Encounter" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Kingdom" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Location" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Party" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Settlement" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Structure" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Version" DROP COLUMN "payloadJson",
ADD COLUMN     "comment" TEXT,
ADD COLUMN     "payloadGz" BYTEA NOT NULL,
ADD COLUMN     "version" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "World" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE INDEX "Version_entityType_entityId_branchId_validFrom_validTo_idx" ON "Version"("entityType", "entityId", "branchId", "validFrom", "validTo");

-- CreateIndex
CREATE INDEX "Version_entityType_entityId_version_idx" ON "Version"("entityType", "entityId", "version");
