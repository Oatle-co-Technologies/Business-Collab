-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "discoveryArea" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE INDEX "BusinessMedia_updatedAt_id_idx" ON "BusinessMedia"("updatedAt", "id");
