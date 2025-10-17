-- DropIndex
DROP INDEX "public"."Location_geom_gist_idx";

-- CreateTable
CREATE TABLE "FieldCondition" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "field" TEXT NOT NULL,
    "expression" JSONB NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "FieldCondition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FieldCondition_entityType_entityId_field_idx" ON "FieldCondition"("entityType", "entityId", "field");

-- CreateIndex
CREATE INDEX "FieldCondition_entityType_field_idx" ON "FieldCondition"("entityType", "field");

-- CreateIndex
CREATE INDEX "FieldCondition_isActive_idx" ON "FieldCondition"("isActive");

-- CreateIndex
CREATE INDEX "FieldCondition_deletedAt_idx" ON "FieldCondition"("deletedAt");

-- CreateIndex
CREATE INDEX "FieldCondition_createdBy_idx" ON "FieldCondition"("createdBy");

-- CreateIndex
CREATE INDEX "FieldCondition_updatedBy_idx" ON "FieldCondition"("updatedBy");

-- AddForeignKey
ALTER TABLE "FieldCondition" ADD CONSTRAINT "FieldCondition_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldCondition" ADD CONSTRAINT "FieldCondition_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Recreate PostGIS spatial index (Prisma cannot track indexes on Unsupported geometry types)
CREATE INDEX "Location_geom_gist_idx" ON "Location" USING gist (geom);
