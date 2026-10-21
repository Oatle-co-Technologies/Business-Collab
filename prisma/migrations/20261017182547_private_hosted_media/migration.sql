-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "logoPath" TEXT;

-- AlterTable
ALTER TABLE "BusinessMedia" ADD COLUMN     "byteSize" INTEGER,
ADD COLUMN     "storagePath" TEXT,
ALTER COLUMN "data" DROP NOT NULL;

-- CreateTable
CREATE TABLE "MediaUpload" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "businessId" TEXT,
    "kind" TEXT NOT NULL,
    "rawPath" TEXT NOT NULL,
    "storagePath" TEXT,
    "contentType" TEXT,
    "byteSize" INTEGER,
    "state" TEXT NOT NULL DEFAULT 'PENDING',
    "tokenIssuedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaUpload_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MediaUpload_rawPath_key" ON "MediaUpload"("rawPath");

-- CreateIndex
CREATE INDEX "MediaUpload_userId_createdAt_idx" ON "MediaUpload"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "MediaUpload_expiresAt_idx" ON "MediaUpload"("expiresAt");

-- AddForeignKey
ALTER TABLE "MediaUpload" ADD CONSTRAINT "MediaUpload_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
