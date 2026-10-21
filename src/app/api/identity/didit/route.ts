import { getDb } from "@/lib/db";
import { diditDecision, validDiditSignature } from "@/lib/didit-rules";
export async function POST(request: Request) {
 if (process.env.DIDIT_ENABLED !== "true" || !process.env.DIDIT_WEBHOOK_SECRET || !process.env.DIDIT_APPLICATION_ID || !process.env.DIDIT_WORKFLOW_ID) return new Response("Identity integration disabled", { status: 503 });
 const reader = request.body?.getReader(); if (!reader) return new Response(null, { status: 400 });
 let raw = ""; const decoder = new TextDecoder(); let length = 0;
 for (;;) { const { value, done } = await reader.read(); if (done) break; length += value.byteLength; if (length > 1_000_000) { await reader.cancel(); return new Response(null, { status: 413 }); } raw += decoder.decode(value, { stream: true }); } raw += decoder.decode();
 let body: Record<string, unknown>;
 try { body = JSON.parse(raw); if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error(); } catch { return new Response(null, { status: 400 }); }
 if (!validDiditSignature(body, request.headers.get("x-signature-v2") ?? "", request.headers.get("x-timestamp") ?? "", process.env.DIDIT_WEBHOOK_SECRET)) return new Response(null, { status: 401 });
 if (!["status.updated", "data.updated"].includes(String(body.webhook_type))) return new Response(null, { status: 204 });
 if (body.environment !== "live" || body.application_id !== process.env.DIDIT_APPLICATION_ID || body.workflow_id !== process.env.DIDIT_WORKFLOW_ID || body.session_kind === "business" || typeof body.session_id !== "string" || typeof body.vendor_data !== "string" || typeof body.event_id !== "string" || body.event_id.length > 100 || typeof body.created_at !== "number" || !Number.isInteger(body.created_at) || body.created_at * 1000 > Date.now() + 300000) return new Response(null, { status: 400 });
 try {
  await getDb().$transaction(async tx => {
   const check = await tx.identityCheck.findUnique({ where: { sessionId: String(body.session_id) } });
   if (!check) {
    const pending = await tx.identityCheck.findUnique({ where: { userId: String(body.vendor_data) } });
    if (pending?.provider === "DIDIT" && pending.sessionId?.startsWith("starting:")) throw new Error("Session registration pending");
    return;
   }
   if (check.userId !== body.vendor_data || check.provider !== "DIDIT") return;
   if (await tx.identityEvent.findUnique({ where: { id: String(body.event_id) } })) return;
   const occurredAt = new Date(Number(body.created_at) * 1000);
   await tx.identityEvent.create({ data: { id: String(body.event_id), userId: check.userId, sessionId: check.sessionId, status: diditDecision(body), occurredAt } });
   if (check.lastEventAt && occurredAt < check.lastEventAt) return;
   let status = diditDecision(body);
   if (check.lastEventAt?.getTime() === occurredAt.getTime() && status === "VERIFIED" && check.status !== "VERIFIED") status = "REVIEW";
   let expiresAt: Date | null = null;
   const details = body.decision as { id_verifications?: { expiration_date?: string }[] } | undefined;
   for (const doc of details?.id_verifications ?? []) if (doc.expiration_date && /^\d{4}-\d{2}-\d{2}$/.test(doc.expiration_date)) { const expiry = new Date(`${doc.expiration_date}T23:59:59Z`); if (Number.isFinite(expiry.getTime()) && (!expiresAt || expiry < expiresAt)) expiresAt = expiry; }
   if (expiresAt && expiresAt <= new Date()) status = "EXPIRED";
   await tx.identityCheck.update({ where: { userId: check.userId }, data: { status, checkedAt: status === "VERIFIED" ? new Date() : null, expiresAt, lastEventAt: occurredAt } });
  }, { isolationLevel: "Serializable" });
 } catch { return new Response(null, { status: 500 }); }
 return new Response(null, { status: 204 });
}
