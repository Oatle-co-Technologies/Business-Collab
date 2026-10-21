-- AlterTable
ALTER TABLE "IdentityEvent" ADD COLUMN     "occurredAt" TIMESTAMP(3),
ADD COLUMN     "sessionId" TEXT,
ADD COLUMN     "status" TEXT;
