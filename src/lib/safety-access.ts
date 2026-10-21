import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { identityEligible } from "@/lib/safety-rules";
export const founderId = () => process.env.SAFETY_FOUNDER_USER_ID?.trim() || "";
export const teamIds = () => (process.env.SAFETY_TEAM_USER_IDS ?? "").split(",").map(v => v.trim()).filter(Boolean);
export class IdentityRequired extends Error {}
export async function requireIdentity(db: Prisma.TransactionClient, userId: string) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { safetySuspended: true, identityCheck: true } });
  if (!user || !identityEligible(user.identityCheck, user.safetySuspended)) throw new IdentityRequired(user?.safetySuspended ? "This account is restricted. Contact the safety team through Safety & identity." : "An identity check is required before participating. Open Safety & identity to see your status.");
}
export async function activityAccess(db: Prisma.TransactionClient, id: string, userId: string) {
  const activity = await db.activity.findUnique({ where: { id }, include: { collaboration: { select: { id: true, status: true, organizer: { select: { ownerId: true } } } }, versions: { orderBy: { version: "desc" }, include: { events: { orderBy: { createdAt: "asc" }, include: { actor: { select: { id: true, name: true } } } }, attendees: { include: { user: { select: { id: true, name: true } } } } } } } });
  if (!activity) return null;
  const organizer = activity.collaboration.organizer.ownerId === userId;
  const current = activity.versions.find(v => v.version === activity.currentVersion)!;
  return organizer || current.attendees.some(a => a.userId === userId) ? { activity, current, organizer } : null;
}
