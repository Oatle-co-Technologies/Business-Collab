"use server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { getDb } from "@/lib/db";
import type { SafetyState } from "@/app/activities/actions";
export async function startIdentity(_state: SafetyState, form: FormData): Promise<SafetyState> {
 const user = await getCurrentUser(); if (!user) return { error: "Please sign in." };
 if (process.env.DIDIT_ENABLED !== "true" || !process.env.DIDIT_API_KEY || !process.env.DIDIT_WORKFLOW_ID || !process.env.DIDIT_APPLICATION_ID || !process.env.DIDIT_WEBHOOK_SECRET) return { error: "Identity checks are not connected yet. No identity documents have been requested or sent." };
 if (form.get("consent") !== "yes") return { error: "Read the identity-check notice and consent before continuing." };
 const db = getDb(); const account = await db.user.findUnique({ where: { id: user.id }, select: { safetySuspended: true, identityCheck: true } });
 if (account?.safetySuspended) return { error: "Your account is restricted. Use the safety inbox to contact the founder." };
 if (account?.identityCheck?.status === "PENDING" && account.identityCheck.updatedAt.getTime() > Date.now() - 30 * 60_000) return { error: "A check is already in progress. Finish the provider session or wait 30 minutes before retrying." };
 if (account?.identityCheck?.updatedAt && account.identityCheck.updatedAt.getTime() > Date.now() - 60_000) return { error: "Please wait a minute before starting another check." };
 let url: URL;
 try {
  const callback = new URL("/identity", process.env.BETTER_AUTH_URL); if (callback.protocol !== "https:") return { error: "A secure hosted app address is required before identity checks can be enabled." };
  const response = await fetch("https://verification.didit.me/v3/session/", { method: "POST", headers: { "x-api-key": process.env.DIDIT_API_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ workflow_id: process.env.DIDIT_WORKFLOW_ID, vendor_data: user.id, callback: callback.toString() }), signal: AbortSignal.timeout(15000), cache: "no-store" });
  if (!response.ok) return { error: "The identity provider could not start a check. Please try again later." };
  const session = await response.json(); url = new URL(session.url);
  if (url.protocol !== "https:" || url.hostname !== "verify.didit.me" || typeof session.session_id !== "string" || session.session_id.length > 100) throw new Error("Invalid session");
  await db.$transaction(async tx => {
  await tx.identityCheck.upsert({ where: { userId: user.id }, create: { userId: user.id, provider: "DIDIT", sessionId: session.session_id, status: "PENDING" }, update: { provider: "DIDIT", sessionId: session.session_id, status: "PENDING", checkedAt: null, expiresAt: null, lastEventAt: null } });
  await tx.identityEvent.create({ data: { id: `started:${session.session_id}`, userId: user.id, sessionId: session.session_id, status: "PENDING", occurredAt: new Date() } });
  });
 } catch { return { error: "The identity check could not be started. Please try again later." }; }
 redirect(url.toString());
}
