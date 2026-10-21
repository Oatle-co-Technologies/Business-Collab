import { randomUUID } from "node:crypto";
import type { PrismaClient } from "../generated/prisma/client.ts";
import { identityEligible } from "./safety-rules.ts";

export class IdentityStartError extends Error {}
export async function beginIdentitySession(db: PrismaClient, userId: string, createSession: () => Promise<{ session_id: string; url: string }>) {
  const reservation = `starting:${randomUUID()}`;
  const now = new Date();
  const previous = await db.$transaction(async tx => {
    const user = await tx.user.findUnique({ where: { id: userId }, include: { identityCheck: true } });
    if (!user || user.safetySuspended) throw new IdentityStartError("This account is restricted or unavailable. Contact the founder through Safety.");
    const check = user.identityCheck;
    if (identityEligible(check, false, now)) throw new IdentityStartError("Your identity is already checked. No new check is needed.");
    if (check?.status === "PENDING" && check.updatedAt.getTime() > now.getTime() - 30 * 60_000) throw new IdentityStartError("A check is already in progress. Finish the provider session or wait 30 minutes before retrying.");
    if (check && check.updatedAt.getTime() > now.getTime() - 60_000) throw new IdentityStartError("Please wait a minute before starting another check.");
    const data = { provider: "DIDIT", sessionId: reservation, status: "PENDING" as const, checkedAt: null, expiresAt: null, lastEventAt: null };
    if (!check) await tx.identityCheck.create({ data: { userId, ...data } });
    else {
      const claimed = await tx.identityCheck.updateMany({ where: { userId, updatedAt: check.updatedAt, sessionId: check.sessionId }, data });
      if (!claimed.count) throw new IdentityStartError("Another identity request is in progress. Please refresh.");
    }
    return check;
  }, { isolationLevel: "Serializable" });
  try {
    const session = await createSession();
    const url = new URL(session.url);
    if (url.protocol !== "https:" || url.hostname !== "verify.didit.me" || url.username || url.password || !session.session_id || session.session_id.length > 100) throw new Error("Invalid provider session");
    await db.$transaction(async tx => {
      const account = await tx.user.findUnique({ where: { id: userId }, select: { safetySuspended: true } });
      if (!account || account.safetySuspended) throw new IdentityStartError("This account is restricted. Contact the founder through Safety.");
      const updated = await tx.identityCheck.updateMany({ where: { userId, sessionId: reservation }, data: { sessionId: session.session_id } });
      if (!updated.count) throw new IdentityStartError("The identity request changed. Please refresh.");
      await tx.identityEvent.create({ data: { id: `started:${session.session_id}`, userId, sessionId: session.session_id, status: "PENDING", occurredAt: new Date() } });
    }, { isolationLevel: "Serializable" });
    return url.toString();
  } catch (error) {
    // Compare the reservation before restoring: never overwrite a newer request or callback.
    await db.identityCheck.updateMany({ where: { userId, sessionId: reservation }, data: previous ? {
      provider: previous.provider, sessionId: previous.sessionId, status: previous.status,
      checkedAt: previous.checkedAt, expiresAt: previous.expiresAt, lastEventAt: previous.lastEventAt,
    } : { sessionId: null, status: "NOT_STARTED" } });
    throw error;
  }
}
