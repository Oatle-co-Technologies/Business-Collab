"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { activityAccess, requireIdentity } from "@/lib/safety-access";
import { activitySchema, saDate, attendanceTransition } from "@/lib/safety-rules";
import { notify } from "@/lib/chat";
export type SafetyState = { error?: string; success?: string; values?: Record<string, string> };
function refresh(id?: string) { revalidatePath("/", "layout"); if (id) revalidatePath(`/activities/${id}`); }
export async function saveActivity(projectId: string, activityId: string | null, _state: SafetyState, form: FormData): Promise<SafetyState> {
 const user = await getCurrentUser(); if (!user) return { error: "Please sign in." };
 const values = Object.fromEntries(["title", "start", "end", "venue", "reason"].map(k => [k, String(form.get(k) ?? "")]));
 const parsed = activitySchema.safeParse(values); if (!parsed.success) return { values, error: parsed.error.issues[0].message };
 if (saDate(parsed.data.start) <= new Date()) return { values, error: "Choose a future start time." };
 let id = "";
 try { await getDb().$transaction(async tx => {
  const project = await tx.collaboration.findUnique({ where: { id: projectId }, include: { organizer: { select: { ownerId: true } }, participants: { where: { status: "SELECTED" }, include: { business: { select: { ownerId: true } } } } } });
  if (!project || project.organizer.ownerId !== user.id || project.status === "COMPLETED") throw new Error("Only the organiser of an unfinished collaboration can schedule activities.");
  await requireIdentity(tx, user.id);
  const users = [...new Set([user.id, ...project.participants.map(p => p.business.ownerId).filter((v): v is string => !!v)])];
  if (users.length < 2) throw new Error("Select at least one collaborator before scheduling an activity.");
  for (const attendee of users) await requireIdentity(tx, attendee);
  let version = 1;
  if (activityId) {
   const previous = await activityAccess(tx, activityId, user.id);
   if (!previous?.organizer || previous.activity.collaborationId !== projectId || previous.activity.cancelledAt) throw new Error("Activity unavailable.");
   if (previous.current.attendees.some(a => a.checkedInAt)) throw new Error("An activity with check-ins cannot be rescheduled. Keep its attendance record and create a new activity instead.");
   if (previous.current.endsAt <= new Date()) throw new Error("Past activity dates cannot be rewritten. Create a new activity instead.");
   if (parsed.data.reason.trim().length < 5) throw new Error("Explain why the plan is changing (at least 5 characters).");
   version = previous.activity.currentVersion + 1;
   id = activityId;
   await tx.activity.update({ where: { id }, data: { currentVersion: version } });
  } else id = (await tx.activity.create({ data: { collaborationId: projectId } })).id;
  await tx.activityVersion.create({ data: { activityId: id, version, title: parsed.data.title, venue: parsed.data.venue, startsAt: saDate(parsed.data.start), endsAt: saDate(parsed.data.end), changeReason: parsed.data.reason || null, attendees: { create: users.map(userId => ({ userId })) } } });
  await notify(tx, users, version === 1 ? "Collaboration activity scheduled — confirm your plan" : "Activity plan changed — confirm the new details", `/activities/${id}`);
 }, { isolationLevel: "Serializable" }); } catch (error) { return { values, error: error instanceof Error && !("code" in error) ? error.message : "The plan could not be saved. Please try again." }; }
 refresh(id); revalidatePath(`/collaborations/${projectId}`); redirect(`/activities/${id}`);
}
export async function recordAttendance(activityId: string, _state: SafetyState, form: FormData): Promise<SafetyState> {
 const user = await getCurrentUser(); if (!user) return { error: "Please sign in." };
 try { await getDb().$transaction(async tx => {
  const access = await activityAccess(tx, activityId, user.id); if (!access || access.activity.cancelledAt) throw new Error("Activity unavailable.");
  if (String(form.get("versionId")) !== access.current.id) throw new Error("The plan changed. Read the new details and confirm them again.");
  const row = access.current.attendees.find(a => a.userId === user.id); if (!row) throw new Error("You can record only your own attendance on the current plan.");
  const decision = String(form.get("decision") ?? "");
  if (!["check-out", "decline"].includes(decision)) await requireIdentity(tx, user.id);
  if (["acknowledge", "check-in"].includes(decision) && !access.organizer) {
   const member = await tx.collaborationParticipant.findFirst({ where: { collaborationId: access.activity.collaborationId, status: "SELECTED", business: { ownerId: user.id } }, select: { id: true } });
   if (!member) throw new Error("You are no longer selected for this activity. Check-out and safety reporting remain available.");
  }
  const data = attendanceTransition(row, decision, access.current.startsAt, access.current.endsAt, new Date());
  await tx.activityAttendee.update({ where: { id: row.id }, data });
  await tx.activityEvent.create({ data: { versionId: row.versionId, actorId: user.id, action: decision } });
  if (decision === "check-out") {
   const safetyCase = await tx.safetyCase.findUnique({ where: { eventKey: `overdue:${row.id}` }, select: { id: true } });
   if (safetyCase) await tx.safetyAudit.create({ data: { caseId: safetyCase.id, actorId: user.id, action: "LATE_CHECKOUT", note: "The attendee recorded check-out. This does not automatically resolve the safety case." } });
  }
  if (decision === "decline") await notify(tx, [access.activity.collaboration.organizer.ownerId], "An attendee declined the activity plan", `/activities/${activityId}`);
 }, { isolationLevel: "Serializable" }); } catch (error) { return { error: error instanceof Error && !("code" in error) ? error.message : "Attendance could not be saved. Please try again." }; }
 refresh(activityId); return { success: "Your attendance choice has been saved." };
}
export async function cancelActivity(id: string, _state: SafetyState, form: FormData): Promise<SafetyState> {
 const user = await getCurrentUser(); if (!user) return { error: "Please sign in." };
 if (form.get("confirm") !== "yes") return { error: "Confirm cancellation." };
 try { await getDb().$transaction(async tx => {
  const access = await activityAccess(tx, id, user.id); if (!access?.organizer || access.activity.cancelledAt) throw new Error("Only the organiser can cancel an active plan.");
  if (access.current.attendees.some(a => a.checkedInAt)) throw new Error("An activity with check-ins cannot be cancelled. Each attendee must check out; safety reports remain available.");
  await tx.activity.update({ where: { id }, data: { cancelledAt: new Date() } });
  await tx.activityEvent.create({ data: { versionId: access.current.id, actorId: user.id, action: "CANCELLED" } });
  await notify(tx, access.current.attendees.map(a => a.userId), "A collaboration activity was cancelled", `/activities/${id}`);
 }, { isolationLevel: "Serializable" }); } catch (error) { return { error: error instanceof Error && !("code" in error) ? error.message : "Cancellation could not be saved." }; }
 refresh(id); return { success: "Activity cancelled. Its history is retained." };
}
