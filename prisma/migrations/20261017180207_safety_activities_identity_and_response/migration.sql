-- CreateEnum
CREATE TYPE "IdentityStatus" AS ENUM ('NOT_STARTED', 'PENDING', 'VERIFIED', 'DECLINED', 'REVIEW', 'EXPIRED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "safetySuspended" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "IdentityCheck" (
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "sessionId" TEXT,
    "status" "IdentityStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "checkedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdentityCheck_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "collaborationId" TEXT NOT NULL,
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityVersion" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "venue" TEXT NOT NULL,
    "changeReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityAttendee" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "acknowledgedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "checkedInAt" TIMESTAMP(3),
    "checkedOutAt" TIMESTAMP(3),

    CONSTRAINT "ActivityAttendee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SafetyCase" (
    "id" TEXT NOT NULL,
    "eventKey" TEXT,
    "collaborationId" TEXT NOT NULL,
    "reporterId" TEXT,
    "assigneeId" TEXT,
    "priority" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "founderNotifiedAt" TIMESTAMP(3),
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SafetyCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SafetyAudit" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SafetyAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IdentityCheck_sessionId_key" ON "IdentityCheck"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityVersion_activityId_version_key" ON "ActivityVersion"("activityId", "version");

-- CreateIndex
CREATE INDEX "ActivityAttendee_checkedInAt_checkedOutAt_idx" ON "ActivityAttendee"("checkedInAt", "checkedOutAt");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityAttendee_versionId_userId_key" ON "ActivityAttendee"("versionId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "SafetyCase_eventKey_key" ON "SafetyCase"("eventKey");

-- CreateIndex
CREATE INDEX "SafetyCase_status_createdAt_idx" ON "SafetyCase"("status", "createdAt");

-- CreateIndex
CREATE INDEX "SafetyAudit_caseId_createdAt_idx" ON "SafetyAudit"("caseId", "createdAt");

-- AddForeignKey
ALTER TABLE "IdentityCheck" ADD CONSTRAINT "IdentityCheck_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_collaborationId_fkey" FOREIGN KEY ("collaborationId") REFERENCES "Collaboration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityVersion" ADD CONSTRAINT "ActivityVersion_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityAttendee" ADD CONSTRAINT "ActivityAttendee_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ActivityVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityAttendee" ADD CONSTRAINT "ActivityAttendee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyCase" ADD CONSTRAINT "SafetyCase_collaborationId_fkey" FOREIGN KEY ("collaborationId") REFERENCES "Collaboration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyCase" ADD CONSTRAINT "SafetyCase_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyCase" ADD CONSTRAINT "SafetyCase_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyAudit" ADD CONSTRAINT "SafetyAudit_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "SafetyCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyAudit" ADD CONSTRAINT "SafetyAudit_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
