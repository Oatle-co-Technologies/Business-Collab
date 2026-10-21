-- AlterTable
ALTER TABLE "SafetyCase" ADD COLUMN     "targetBusinessId" TEXT,
ALTER COLUMN "collaborationId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "SafetyCase" ADD CONSTRAINT "SafetyCase_targetBusinessId_fkey" FOREIGN KEY ("targetBusinessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
