import "server-only";
import { getDb } from "@/lib/db";

export const businessSummary = { id: true, name: true, location: true, discoveryArea: true, categories: true, ownerId: true, published: true } as const;

export async function visibleCollaboration(id: string, userId: string) {
  const request = await getDb().collaboration.findUnique({ where: { id }, include: {
    organizer: { select: businessSummary },
    participants: { include: { business: { select: businessSummary } }, orderBy: { createdAt: "asc" } },
  } });
  if (!request) return null;
  const isOrganizer = request.organizer.ownerId === userId;
  const ownEntries = request.participants.filter(item => item.business.ownerId === userId);
  if (!isOrganizer && !ownEntries.length && !(request.visibility === "OPEN" && request.organizer.published && request.organizer.ownerId)) return null;
  return { request, isOrganizer, ownEntries };
}
