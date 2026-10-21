-- CreateEnum
CREATE TYPE "CollaborationVisibility" AS ENUM ('OPEN', 'INVITE_ONLY');

-- CreateEnum
CREATE TYPE "CollaborationStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "ParticipationSource" AS ENUM ('INVITATION', 'APPLICATION');

-- CreateEnum
CREATE TYPE "ParticipationStatus" AS ENUM ('PENDING', 'INTERESTED', 'SELECTED', 'DECLINED', 'NOT_SELECTED', 'WITHDRAWN');

-- CreateTable
CREATE TABLE "Collaboration" (
    "id" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "servicesNeeded" TEXT[],
    "location" TEXT NOT NULL,
    "discoveryArea" TEXT NOT NULL,
    "visibility" "CollaborationVisibility" NOT NULL DEFAULT 'OPEN',
    "status" "CollaborationStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Collaboration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollaborationParticipant" (
    "id" TEXT NOT NULL,
    "collaborationId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "source" "ParticipationSource" NOT NULL,
    "status" "ParticipationStatus" NOT NULL,
    "invitationNote" TEXT,
    "responseNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollaborationParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Collaboration_organizerId_status_idx" ON "Collaboration"("organizerId", "status");

-- CreateIndex
CREATE INDEX "Collaboration_visibility_status_createdAt_idx" ON "Collaboration"("visibility", "status", "createdAt");

-- CreateIndex
CREATE INDEX "CollaborationParticipant_businessId_status_idx" ON "CollaborationParticipant"("businessId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CollaborationParticipant_collaborationId_businessId_key" ON "CollaborationParticipant"("collaborationId", "businessId");

-- AddForeignKey
ALTER TABLE "Collaboration" ADD CONSTRAINT "Collaboration_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollaborationParticipant" ADD CONSTRAINT "CollaborationParticipant_collaborationId_fkey" FOREIGN KEY ("collaborationId") REFERENCES "Collaboration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollaborationParticipant" ADD CONSTRAINT "CollaborationParticipant_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
