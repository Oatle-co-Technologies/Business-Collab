-- AlterTable
ALTER TABLE "IdentityCheck" ADD COLUMN     "lastEventAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "IdentityEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdentityEvent_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "IdentityEvent" ADD CONSTRAINT "IdentityEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
