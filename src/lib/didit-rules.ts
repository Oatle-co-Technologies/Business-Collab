import { createHmac, timingSafeEqual } from "node:crypto";
export function canonicalJson(value: unknown): string {
 if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
 if (value !== null && typeof value === "object") return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`).join(",")}}`;
 return JSON.stringify(value);
}
export function validDiditSignature(body: Record<string, unknown>, signature: string, headerTime: string, secret: string, now = Date.now()) {
 const timestamp = body.timestamp;
 if (!secret || !/^[a-f0-9]{64}$/i.test(signature) || !/^\d+$/.test(headerTime) || typeof timestamp !== "number" || !Number.isInteger(timestamp)) return false;
 if (Math.abs(now / 1000 - timestamp) > 300 || Math.abs(now / 1000 - Number(headerTime)) > 300) return false;
 const expected = createHmac("sha256", secret).update(canonicalJson(body), "utf8").digest();
 return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}
export function diditDecision(body: Record<string, unknown>): "VERIFIED" | "DECLINED" | "REVIEW" | "PENDING" | "EXPIRED" {
 if (body.status === "Declined") return "DECLINED";
 if (body.status === "Kyc Expired" || body.status === "Abandoned") return "EXPIRED";
 if (body.status === "In Review" || body.status === "Resubmitted") return "REVIEW";
 if (body.status !== "Approved") return "PENDING";
 if (body.environment !== "live" || body.session_kind === "business") return "REVIEW";
 const decision = body.decision as Record<string, unknown> | undefined;
 return ["id_verifications", "liveness_checks", "face_matches"].every(key => {
  const checks = decision?.[key];
  return Array.isArray(checks) && checks.length > 0 && checks.every(check => check && typeof check === "object" && check.status === "Approved");
 }) ? "VERIFIED" : "REVIEW";
}
