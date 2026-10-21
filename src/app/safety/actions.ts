"use server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/current-user";
import { getDb } from "@/lib/db";
import { activityAccess, founderId, teamIds } from "@/lib/safety-access";
import { notifyFounder } from "@/lib/safety-sweep";
import type { SafetyState } from "@/app/activities/actions";
export async function fileSafetyReport(_state: SafetyState, form: FormData): Promise<SafetyState> {
 const user = await getCurrentUser(); if (!user) return { error: "Please sign in to save a report." };
 const detail = String(form.get("detail") ?? "").trim(), priority = String(form.get("priority") ?? "ROUTINE");
 if (detail.length < 10 || detail.length > 4000 || !["ROUTINE", "URGENT"].includes(priority)) return { error: "Describe the issue in 10–4,000 characters and choose a priority." };
 try { await getDb().$transaction(async tx => {
  let projectId: string | null = String(form.get("collaborationId") ?? "") || null;
  const businessId = String(form.get("businessId") ?? "") || null;
  const activityId = String(form.get("activityId") ?? "") || null;
  if (activityId) { const access = await activityAccess(tx, activityId, user.id); if (!access) throw new Error("Activity unavailable."); projectId = access.activity.collaborationId; }
  else if (projectId) {
   const project = await tx.collaboration.findFirst({ where: { id: projectId, OR: [{ organizer: { ownerId: user.id } }, { participants: { some: { business: { ownerId: user.id } } } }] }, select: { id: true } });
   if (!project) throw new Error("You can report collaborations you are involved in.");
  } else if (!businessId) throw new Error("Open the report form from a business, collaboration or activity.");
  if (businessId && !await tx.business.findFirst({ where: { id: businessId, OR: [{ published: true, ownerId: { not: null } }, { ownerId: user.id }] }, select: { id: true } })) throw new Error("Business unavailable.");
  const recent = await tx.safetyCase.count({ where: { reporterId: user.id, kind: "MEMBER_REPORT", createdAt: { gte: new Date(Date.now() - 3600_000) } } });
  if (recent >= 10) throw new Error("You have saved several reports recently. Please wait before sending another.");
  const report = await tx.safetyCase.create({ data: { collaborationId: projectId, targetBusinessId: businessId, reporterId: user.id, priority, kind: "MEMBER_REPORT", detail: activityId ? `Activity reference: ${activityId}\n${detail}` : detail } });
  await tx.safetyAudit.create({ data: { caseId: report.id, actorId: user.id, action: "CREATED", note: "Member report saved. Founder is the first recipient." } });
  await notifyFounder(tx, report.id, founderId());
 }, { isolationLevel: "Serializable" }); } catch (error) { return { error: error instanceof Error && !("code" in error) ? error.message : "Your report could not be saved. Please try again." }; }
 revalidatePath("/safety"); return { success: "Report saved privately for the founder. Saved does not mean read. This prototype provides in-app alerts only and is not an emergency response service." };
}
export async function manageSafetyCase(id: string, _state: SafetyState, form: FormData): Promise<SafetyState> {
 const user = await getCurrentUser(); if (!user) return { error: "Please sign in." };
 const action = String(form.get("decision") ?? ""), note = String(form.get("note") ?? "").trim();
 if (note.length < 5 || note.length > 2000) return { error: "Record a follow-up note of 5–2,000 characters." };
 try { await getDb().$transaction(async tx => {
  const record = await tx.safetyCase.findUnique({ where: { id } });
  const founder = user.id === founderId();
  if (!record || !(founder || (teamIds().includes(user.id) && record.assigneeId === user.id))) throw new Error("Safety case unavailable.");
  if (action === "acknowledge") {
   if (!founder || record.status !== "NEW") throw new Error("The founder must acknowledge a new case first.");
   await tx.safetyCase.update({ where: { id }, data: { status: "ACKNOWLEDGED", acknowledgedAt: new Date() } });
  } else if (action === "assign") {
   const assigneeId = String(form.get("assigneeId") ?? "");
   if (!founder || !record.acknowledgedAt || record.resolvedAt || !teamIds().includes(assigneeId)) throw new Error("The founder can assign an acknowledged open case only to an authorised team member.");
   if (!await tx.user.findUnique({ where: { id: assigneeId }, select: { id: true } })) throw new Error("Team account unavailable.");
   await tx.safetyCase.update({ where: { id }, data: { assigneeId, status: "ASSIGNED" } });
   await tx.notification.create({ data: { userId: assigneeId, title: "A safety case was assigned to you by the founder", href: `/safety/${id}` } });
  } else if (action === "resolve") {
   if (!record.acknowledgedAt || record.resolvedAt) throw new Error("Acknowledge the case before resolving it.");
   await tx.safetyCase.update({ where: { id }, data: { status: "RESOLVED", resolvedAt: new Date() } });
  } else if (action === "restrict" || action === "restore") {
   if (!founder || !record.acknowledgedAt) throw new Error("Only the founder can restrict or restore an account after reviewing a case.");
   const subject = String(form.get("subjectId") ?? "");
   const involved = await tx.business.findFirst({ where: { ownerId: subject, OR: [...(record.targetBusinessId ? [{ id: record.targetBusinessId }] : []), ...(record.collaborationId ? [{ organizedCollaborations: { some: { id: record.collaborationId } } }, { collaborationEntries: { some: { collaborationId: record.collaborationId } } }] : [])] }, select: { id: true } });
   if (!involved || subject === founderId()) throw new Error("Choose an involved business owner; the founder cannot be restricted here.");
   await tx.user.update({ where: { id: subject }, data: { safetySuspended: action === "restrict" } });
  } else if (action !== "note") throw new Error("Choose a valid follow-up action.");
  await tx.safetyAudit.create({ data: { caseId: id, actorId: user.id, action: action.toUpperCase(), note } });
 }, { isolationLevel: "Serializable" }); } catch (error) { return { error: error instanceof Error && !("code" in error) ? error.message : "The case could not be updated." }; }
 revalidatePath("/safety"); revalidatePath(`/safety/${id}`); return { success: "Follow-up saved in the case history." };
}
