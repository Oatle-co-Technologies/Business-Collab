"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { collaborationSchema, invitationSchema, applicationSchema, participantTransition, type CollaborationFormState } from "@/lib/collaboration-rules";

import { notify } from "@/lib/chat";

import { requireIdentity, IdentityRequired } from "@/lib/safety-access";

class RequestError extends Error {}
const fields = (form: FormData, keys: string[]) => Object.fromEntries(keys.map(key => [key, typeof form.get(key) === "string" ? String(form.get(key)).trim() : ""]));
function failure(error: unknown, values?: Record<string, string>): CollaborationFormState {
  const code = (error as { code?: string })?.code;
  return { values, error: error instanceof RequestError || error instanceof IdentityRequired ? error.message : code === "P2002" ? "This business has already applied or been invited to this request." : code === "P2034" ? "The request changed. Please refresh and try again." : "We could not save this change. Please try again." };
}
function refresh(id: string) { revalidatePath("/collaborations"); revalidatePath(`/collaborations/${id}`); revalidatePath("/collaborations/invite"); }

export async function createCollaboration(_state: CollaborationFormState, form: FormData): Promise<CollaborationFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Please sign in to create a collaboration request." };
  const values = fields(form, ["organizerId", "title", "description", "servicesNeeded", "location", "discoveryArea", "visibility"]);
  const parsed = collaborationSchema.safeParse(values);
  if (!parsed.success) return { values, errors: parsed.error.flatten().fieldErrors };
  let id: string;
  let inviteId = "";
  try {
    const db = getDb();
    id = await db.$transaction(async tx => {
      await requireIdentity(tx, user.id);
      const organizer = await tx.business.findFirst({ where: { id: parsed.data.organizerId, ownerId: user.id, published: true }, select: { id: true } });
      if (!organizer) throw new RequestError("Choose a published business that you own to organise this request.");
      const wanted = String(form.get("inviteBusinessId") ?? "");
      if (wanted) {
        const target = await tx.business.findFirst({ where: { id: wanted, published: true, ownerId: { not: user.id } }, select: { id: true, ownerId: true } });
        if (target?.ownerId) inviteId = target.id;
      }
      return (await tx.collaboration.create({ data: parsed.data, select: { id: true } })).id;
    }, { isolationLevel: "Serializable" });
  } catch (error) { return failure(error, values); }
  refresh(id);
  redirect(`/collaborations/${id}${inviteId ? `?${new URLSearchParams({ invite: inviteId })}` : ""}`);
}

export async function sendInvitation(_state: CollaborationFormState, form: FormData): Promise<CollaborationFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Please sign in to send an invitation." };
  const values = fields(form, ["collaborationId", "businessId", "note"]);
  const parsed = invitationSchema.safeParse(values);
  if (!parsed.success) return { values, errors: parsed.error.flatten().fieldErrors };
  try {
    await getDb().$transaction(async tx => {
      const request = await tx.collaboration.findUnique({ where: { id: parsed.data.collaborationId }, include: { organizer: { select: { ownerId: true, published: true } } } });
      if (!request || request.organizer.ownerId !== user.id) throw new RequestError("You do not have permission to invite businesses to this request.");
      if (request.status !== "OPEN") throw new RequestError("Reopen this request before sending another invitation.");
      await requireIdentity(tx, user.id);
      if (!request.organizer.published) throw new RequestError("Publish your organising business profile before inviting collaborators.");
      const target = await tx.business.findFirst({ where: { id: parsed.data.businessId, published: true }, select: { id: true, ownerId: true } });
      if (!target?.ownerId) throw new RequestError("Choose a published business to invite.");
      await requireIdentity(tx, target.ownerId);
      if (target.ownerId === user.id) throw new RequestError("You cannot invite one of your own businesses to your request.");
      await tx.collaborationParticipant.create({ data: { collaborationId: request.id, businessId: target.id, source: "INVITATION", status: "PENDING", invitationNote: parsed.data.note || null } });
      await notify(tx, [target.ownerId], "New collaboration invitation", `/collaborations/${request.id}`);
    }, { isolationLevel: "Serializable" });
  } catch (error) { return failure(error, values); }
  refresh(parsed.data.collaborationId);
  return { success: "Invitation sent. The business can respond from Collaborations." };
}

export async function applyToCollaboration(id: string, _state: CollaborationFormState, form: FormData): Promise<CollaborationFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Please sign in to express interest." };
  const values = fields(form, ["businessId", "note"]);
  const parsed = applicationSchema.safeParse(values);
  if (!parsed.success) return { values, errors: parsed.error.flatten().fieldErrors };
  try {
    await getDb().$transaction(async tx => {
      const request = await tx.collaboration.findUnique({ where: { id }, include: { organizer: { select: { ownerId: true, published: true } } } });
      if (!request || request.visibility !== "OPEN" || !request.organizer.ownerId || !request.organizer.published) throw new RequestError("This request is not open to applications.");
      if (request.organizer.ownerId === user.id) throw new RequestError("You cannot apply to your own request.");
      if (request.status !== "OPEN") throw new RequestError("This request is closed to new responses.");
      await requireIdentity(tx, user.id);
      const business = await tx.business.findFirst({ where: { id: parsed.data.businessId, ownerId: user.id, published: true }, select: { id: true } });
      if (!business) throw new RequestError("Choose a published business that you own.");
      await tx.collaborationParticipant.create({ data: { collaborationId: id, businessId: business.id, source: "APPLICATION", status: "INTERESTED", responseNote: parsed.data.note || null } });
      await notify(tx, [request.organizer.ownerId], "New collaboration application", `/collaborations/${id}`);
    }, { isolationLevel: "Serializable" });
  } catch (error) { return failure(error, values); }
  refresh(id);
  return { success: "Your interest has been sent to the organiser. They will review your business." };
}

export async function respondToInvitation(entryId: string, _state: CollaborationFormState, form: FormData): Promise<CollaborationFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Please sign in to respond." };
  const values = fields(form, ["decision", "note"]);
  if (values.note.length > 1000) return { values, error: "Keep your message to 1,000 characters or fewer." };
  let requestId = "";
  try {
    await getDb().$transaction(async tx => {
      const entry = await tx.collaborationParticipant.findUnique({ where: { id: entryId }, include: { business: { select: { ownerId: true, published: true } }, collaboration: { select: { status: true, organizer: { select: { ownerId: true } } } } } });
      if (!entry || entry.business.ownerId !== user.id) throw new RequestError("You do not have permission to respond for this business.");
      if (entry.collaboration.status === "COMPLETED") throw new RequestError("Completed collaborations cannot change their final team or responses.");
      let status;
      try { status = participantTransition("participant", entry.status, values.decision, entry.collaboration.status === "OPEN"); }
      catch (error) { throw new RequestError((error as Error).message); }
      if (values.decision === "accept") await requireIdentity(tx, user.id);
      if (values.decision === "accept" && !entry.business.published) throw new RequestError("Publish your business profile before expressing interest.");
      if (["withdraw", "unselect"].includes(String(form.get("decision")))) {
        const ongoing = await tx.activityAttendee.findFirst({ where: { userId: entry.business.ownerId!, checkedInAt: { not: null }, checkedOutAt: null, version: { activity: { collaborationId: entry.collaborationId } } }, select: { id: true } });
        if (ongoing) throw new RequestError("Check-out is still outstanding for this collaborator. Finish the attendance record before changing the team.");
      }
      requestId = entry.collaborationId;
      await tx.collaborationParticipant.update({ where: { id: entry.id }, data: { status, ...(values.decision === "accept" ? { responseNote: values.note || null } : {}) } });
      await notify(tx, [entry.collaboration.organizer.ownerId], values.decision === "accept" ? "Collaboration invitation accepted" : values.decision === "decline" ? "Collaboration invitation declined" : "Collaborator withdrew", `/collaborations/${requestId}`);
    }, { isolationLevel: "Serializable" });
  } catch (error) { return failure(error, values); }
  refresh(requestId);
  return { success: values.decision === "accept" ? "Interest confirmed. The organiser can now review your business." : values.decision === "decline" ? "Invitation declined." : "Your business has withdrawn from this request." };
}

export async function reviewApplicant(entryId: string, _state: CollaborationFormState, form: FormData): Promise<CollaborationFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Please sign in to review applicants." };
  let requestId = "";
  try {
    await getDb().$transaction(async tx => {
      const entry = await tx.collaborationParticipant.findUnique({ where: { id: entryId }, include: { business: { select: { published: true, ownerId: true } }, collaboration: { include: { organizer: { select: { ownerId: true } } } } } });
      if (!entry || entry.collaboration.organizer.ownerId !== user.id) throw new RequestError("Only the organiser can select collaborators.");
      await requireIdentity(tx, user.id);
      if (entry.collaboration.status === "COMPLETED") throw new RequestError("Completed collaborations cannot change their final team or responses.");
      let status;
      try { status = participantTransition("organizer", entry.status, String(form.get("decision") ?? ""), entry.collaboration.status === "OPEN"); }
      catch (error) { throw new RequestError((error as Error).message); }
      if (status === "SELECTED") {
        await requireIdentity(tx, user.id);
        if (!entry.business.ownerId) throw new RequestError("The selected business needs an identity-checked owner.");
        await requireIdentity(tx, entry.business.ownerId);
      }
      if (status === "SELECTED" && !entry.business.published) throw new RequestError("This business must publish its profile before being selected.");
      if (["withdraw", "unselect"].includes(String(form.get("decision")))) {
        const ongoing = await tx.activityAttendee.findFirst({ where: { userId: entry.business.ownerId!, checkedInAt: { not: null }, checkedOutAt: null, version: { activity: { collaborationId: entry.collaborationId } } }, select: { id: true } });
        if (ongoing) throw new RequestError("Check-out is still outstanding for this collaborator. Finish the attendance record before changing the team.");
      }
      requestId = entry.collaborationId;
      await tx.collaborationParticipant.update({ where: { id: entry.id }, data: { status } });
      await notify(tx, [entry.business.ownerId], status === "SELECTED" ? "Your business was selected for a collaboration" : "Collaboration selection updated", `/collaborations/${requestId}`);
    }, { isolationLevel: "Serializable" });
  } catch (error) { return failure(error); }
  refresh(requestId);
  return { success: "Collaborator response updated." };
}

export async function setCollaborationStatus(id: string, _state: CollaborationFormState, form: FormData): Promise<CollaborationFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Please sign in to manage this request." };
  const status = form.get("status");
  if (status !== "OPEN" && status !== "CLOSED") return { error: "Choose a valid request status." };
  try {
    await requireIdentity(getDb(), user.id);
    const updated = await getDb().collaboration.updateMany({ where: { id, organizer: { ownerId: user.id }, status: { not: "COMPLETED" } }, data: { status } });
    if (!updated.count) throw new RequestError("Only the organiser can change an unfinished request. Completed collaborations cannot be reopened.");
  } catch (error) { return failure(error); }
  refresh(id);
  return { success: status === "CLOSED" ? "Request closed to new responses. Existing selections are retained." : "Request reopened." };
}
