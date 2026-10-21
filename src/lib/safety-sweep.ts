import type { PrismaClient, Prisma } from "../generated/prisma/client.ts";
import { CHECKOUT_GRACE_MS } from "./safety-rules.ts";
export async function notifyFounder(tx: Prisma.TransactionClient, caseId: string, founder: string, now = new Date()) {
  if (!founder || !await tx.user.findUnique({ where: { id: founder }, select: { id: true } })) return false;
  const claimed = await tx.safetyCase.updateMany({ where: { id: caseId, founderNotifiedAt: null }, data: { founderNotifiedAt: now } });
  if (claimed.count) await tx.notification.create({ data: { userId: founder, title: "Safety case needs your attention", href: `/safety/${caseId}`, createdAt: now } });
  await tx.safetyEmail.upsert({ where: { caseId }, create: { caseId, founderId: founder }, update: {} });
  return true;
}
export async function sweepSafety(db: PrismaClient, founder: string, now = new Date(), scope?: { activityIds: string[]; collaborationIds: string[] }) {
  let cursor: string | undefined; let count = 0;
  for (;;) {
  const overdue = await db.activityAttendee.findMany({ where: { checkedInAt: { not: null }, checkedOutAt: null, version: { ...(scope ? { activityId: { in: scope.activityIds } } : {}), endsAt: { lte: new Date(now.getTime() - CHECKOUT_GRACE_MS) } } }, include: { version: { select: { activity: { select: { collaborationId: true } } } } }, take: 200, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}), orderBy: { id: "asc" } });
  for (const attendee of overdue) await db.$transaction(async tx => {
    const current = await tx.activityAttendee.findUnique({ where: { id: attendee.id } });
    if (!current?.checkedInAt || current.checkedOutAt) return;
    const eventKey = `overdue:${attendee.id}`;
    const existing = await tx.safetyCase.findUnique({ where: { eventKey }, select: { id: true } });
    const record = existing ?? await tx.safetyCase.create({ data: { eventKey, collaborationId: attendee.version.activity.collaborationId, reporterId: attendee.userId, kind: "OVERDUE_CHECKOUT", priority: "URGENT", detail: `Check-out overdue for attendance ${attendee.id}. This is not confirmation of an emergency.`, createdAt: now } });
    if (!existing) await tx.safetyAudit.create({ data: { caseId: record.id, action: "CREATED", note: "Automatic overdue check-out case; founder is the first recipient.", createdAt: now } });
    await notifyFounder(tx, record.id, founder, now);
  }, { isolationLevel: "Serializable" }).catch(error => { if (!["P2002", "P2034"].includes(error?.code)) throw error; });
  count += overdue.length;
  if (overdue.length < 200) break;
  cursor = overdue[overdue.length - 1].id;
  }
  const waiting = await db.safetyCase.findMany({ where: { founderNotifiedAt: null, ...(scope ? { collaborationId: { in: scope.collaborationIds } } : {}) }, select: { id: true }, take: 200, orderBy: { createdAt: "asc" } });
  for (const record of waiting) await db.$transaction(tx => notifyFounder(tx, record.id, founder, now));
  return count;
}
