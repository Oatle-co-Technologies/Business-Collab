-- CreateTable
CREATE TABLE "SafetyEmail" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "founderId" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseId" TEXT,
    "leaseUntil" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "lastFailureAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SafetyEmail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SafetyEmail_caseId_key" ON "SafetyEmail"("caseId");

-- CreateIndex
CREATE INDEX "SafetyEmail_sentAt_nextAttemptAt_idx" ON "SafetyEmail"("sentAt", "nextAttemptAt");

-- AddForeignKey
ALTER TABLE "SafetyEmail" ADD CONSTRAINT "SafetyEmail_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "SafetyCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
