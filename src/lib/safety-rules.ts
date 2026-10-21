import { z } from "zod";
export const CHECKOUT_GRACE_MS = 30 * 60_000;
export function saDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return new Date(NaN);
  const date = new Date(`${value}:00+02:00`);
  return Number.isFinite(date.getTime()) && new Date(date.getTime() + 2 * 3600_000).toISOString().slice(0, 16) === value ? date : new Date(NaN);
}
export const activitySchema = z.object({
  title: z.string().trim().min(3).max(120),
  start: z.string().refine(v => Number.isFinite(saDate(v).getTime()), "Choose a valid start date and time."),
  end: z.string().refine(v => Number.isFinite(saDate(v).getTime()), "Choose a valid end date and time."),
  venue: z.string().trim().min(5, "Add the private meeting details or remote meeting arrangement.").max(1000),
  reason: z.string().trim().max(500),
}).refine(v => saDate(v.end) > saDate(v.start), { path: ["end"], message: "End time must be after the start time." });
export function identityEligible(check: { status: string; expiresAt: Date | null } | null, suspended: boolean, now = new Date()) {
  return !suspended && check?.status === "VERIFIED" && (!check.expiresAt || check.expiresAt > now);
}
export function attendanceTransition(row: { acknowledgedAt: Date | null; declinedAt: Date | null; checkedInAt: Date | null; checkedOutAt: Date | null }, decision: string, start: Date, end: Date, now: Date) {
  if (decision === "acknowledge" && !row.checkedInAt && !row.checkedOutAt) return { acknowledgedAt: now, declinedAt: null };
  if (decision === "decline" && !row.checkedInAt && !row.checkedOutAt) return { declinedAt: now, acknowledgedAt: null };
  if (decision === "check-in" && row.acknowledgedAt && !row.declinedAt && !row.checkedInAt && now.getTime() >= start.getTime() - 60 * 60_000 && now <= end) return { checkedInAt: now };
  if (decision === "check-out" && row.checkedInAt && !row.checkedOutAt) return { checkedOutAt: now };
  throw new Error("This attendance action is unavailable. Confirm the current plan before checking in, within one hour of its start and before its end.");
}
export function verifiedOwnerFilter(now = new Date()) {
 return { is: { safetySuspended: false, identityCheck: { is: { status: "VERIFIED" as const, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] } } } };
}
