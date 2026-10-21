-- CreateEnum
CREATE TYPE "MediaKind" AS ENUM ('INTRODUCTION', 'SHOWCASE', 'PHOTO');

-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "published" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "BusinessMedia" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "kind" "MediaKind" NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "contentType" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessMedia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BusinessMedia_businessId_kind_position_key" ON "BusinessMedia"("businessId", "kind", "position");

-- AddForeignKey
ALTER TABLE "BusinessMedia" ADD CONSTRAINT "BusinessMedia_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
