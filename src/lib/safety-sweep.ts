import { Prisma, type PrismaClient } from "../generated/prisma/client.ts";
import { CHECKOUT_GRACE_MS } from "./safety-rules.ts";
export async function notifyFounder(tx: Prisma.TransactionClient, caseId: string, founder: string, now = new Date()) {
  if (!founder || !await tx.user.findUnique({ where: { id: founder }, select: { id: true } })) return false;
  const claimed = await tx.safetyCase.updateMany({ where: { id: caseId, founderNotifiedAt: null }, data: { founderNotifiedAt: now } });
  if (claimed.count) await tx.notification.create({ data: { userId: founder, title: "Safety case needs your attention", href: `/safety/${caseId}`, createdAt: now } });
  await tx.safetyEmail.upsert({ where: { caseId }, create: { caseId, founderId: founder }, update: {} });
  return true;
}
export async function sweepSafety(db: PrismaClient, founder: string, now = new Date(), scope?: { activityIds: string[]; collaborationIds: string[] }) {
  if (!founder || !await db.user.findUnique({ where: { id: founder }, select: { id: true } })) throw new Error("Safety recipient is unavailable.");
  const deadline = Date.now() + 20_000;
  let incomplete = false;
  // Query only attendance that has no case, so unresolved older cases do not
  // monopolise each bounded invocation. All values are bound SQL parameters.
  const ids = await db.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT a.id FROM "ActivityAttendee" a
    JOIN "ActivityVersion" v ON v.id = a."versionId"
    WHERE a."checkedInAt" IS NOT NULL AND a."checkedOutAt" IS NULL
      AND v."endsAt" <= ${new Date(now.getTime() - CHECKOUT_GRACE_MS)}
      AND (${!scope} OR v."activityId" = ANY(${scope?.activityIds ?? []}::text[]))
      AND NOT EXISTS (SELECT 1 FROM "SafetyCase" c WHERE c."eventKey" = 'overdue:' || a.id)
    ORDER BY v."endsAt", a.id LIMIT 100
  `);
  const overdue = await db.activityAttendee.findMany({ where: { id: { in: ids.map(row => row.id) } }, include: { version: { select: { activity: { select: { collaborationId: true } } } } }, orderBy: { id: "asc" } });
  for (const attendee of overdue) {
    if (Date.now() >= deadline) { incomplete = true; break; }
    await db.$transaction(async tx => {
      const current = await tx.activityAttendee.findUnique({ where: { id: attendee.id } });
      if (!current?.checkedInAt || current.checkedOutAt) return;
      const eventKey = `overdue:${attendee.id}`;
      const existing = await tx.safetyCase.findUnique({ where: { eventKey }, select: { id: true } });
      const record = existing ?? await tx.safetyCase.create({ data: { eventKey, collaborationId: attendee.version.activity.collaborationId, reporterId: attendee.userId, kind: "OVERDUE_CHECKOUT", priority: "URGENT", detail: `Check-out overdue for attendance ${attendee.id}. This is not confirmation of an emergency.`, createdAt: now } });
      if (!existing) await tx.safetyAudit.create({ data: { caseId: record.id, action: "CREATED", note: "Automatic overdue check-out case; founder is the first recipient.", createdAt: now } });
      if (!await notifyFounder(tx, record.id, founder, now)) throw new Error("Safety recipient became unavailable.");
    }, { isolationLevel: "Serializable" }).catch(error => {
      if (!["P2002", "P2034"].includes(error?.code)) throw error;
      incomplete = true;
    });
  }
  if (ids.length === 100) incomplete = true;
  const waiting = await db.safetyCase.findMany({ where: { founderNotifiedAt: null, ...(scope ? { collaborationId: { in: scope.collaborationIds } } : {}) }, select: { id: true }, take: 100, orderBy: { createdAt: "asc" } });
  for (const record of waiting) {
    if (Date.now() >= deadline) { incomplete = true; break; }
    const notified = await db.$transaction(tx => notifyFounder(tx, record.id, founder, now));
    if (!notified) incomplete = true;
  }
  if (incomplete) throw new Error("Safety sweep has unfinished work; retry required.");
  return overdue.length;
}
