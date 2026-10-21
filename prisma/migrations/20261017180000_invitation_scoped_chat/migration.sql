ALTER TABLE "Conversation" ADD COLUMN "participationId" TEXT;
CREATE UNIQUE INDEX "Conversation_participationId_key" ON "Conversation"("participationId");
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_participationId_fkey" FOREIGN KEY ("participationId") REFERENCES "CollaborationParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
