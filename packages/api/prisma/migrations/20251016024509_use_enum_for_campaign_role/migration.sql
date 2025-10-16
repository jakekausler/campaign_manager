/*
  Warnings:

  - Changed the type of `role` on the `CampaignMembership` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "CampaignRole" AS ENUM ('OWNER', 'GM', 'PLAYER', 'VIEWER');

-- AlterTable
ALTER TABLE "CampaignMembership" DROP COLUMN "role",
ADD COLUMN     "role" "CampaignRole" NOT NULL;

-- CreateIndex
CREATE INDEX "CampaignMembership_role_idx" ON "CampaignMembership"("role");
