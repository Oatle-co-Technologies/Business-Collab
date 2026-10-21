"use server";
import { beginIdentitySession, IdentityStartError } from "@/lib/identity-session";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { getDb } from "@/lib/db";
import type { SafetyState } from "@/app/activities/actions";
export async function startIdentity(_state: SafetyState, form: FormData): Promise<SafetyState> {
 const user = await getCurrentUser(); if (!user) return { error: "Please sign in." };
 if (process.env.DIDIT_ENABLED !== "true" || !process.env.DIDIT_API_KEY || !process.env.DIDIT_WORKFLOW_ID || !process.env.DIDIT_APPLICATION_ID || !process.env.DIDIT_WEBHOOK_SECRET) return { error: "Identity checks are not connected yet. No identity documents have been requested or sent." };
 if (form.get("consent") !== "yes") return { error: "Read the identity-check notice and consent before continuing." };
 let url: string;
 try {
  const callback = new URL("/identity", process.env.BETTER_AUTH_URL);
  if (callback.protocol !== "https:" || callback.username || callback.password) return { error: "A secure hosted app address is required before identity checks can be enabled." };
  url = await beginIdentitySession(getDb(), user.id, async () => {
   const response = await fetch("https://verification.didit.me/v3/session/", { method: "POST", headers: { "x-api-key": process.env.DIDIT_API_KEY!, "Content-Type": "application/json" }, body: JSON.stringify({ workflow_id: process.env.DIDIT_WORKFLOW_ID, vendor_data: user.id, callback: callback.toString() }), signal: AbortSignal.timeout(15000), cache: "no-store" });
   if (!response.ok) throw new Error("Provider unavailable");
   const session = await response.json();
   if (typeof session.session_id !== "string" || typeof session.url !== "string") throw new Error("Invalid provider session");
   return session;
  });
 } catch (error) {
  const code = (error as { code?: string })?.code;
  return { error: error instanceof IdentityStartError ? error.message : ["P2002", "P2034"].includes(code ?? "") ? "Another identity request is in progress. Please refresh and try again." : "The identity check could not be started. Please try again later." };
 }
 redirect(url);
}
