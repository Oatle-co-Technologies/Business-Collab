"use server";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { notify } from "@/lib/chat";
import { reviewSchema, reviewPairAllowed } from "@/lib/review-rules";
import type { CollaborationFormState } from "@/lib/collaboration-rules";
import { requireIdentity, IdentityRequired } from "@/lib/safety-access";

class ReviewError extends Error {}
function failure(error: unknown): CollaborationFormState {
  return { error: error instanceof ReviewError || error instanceof IdentityRequired ? error.message : (error as { code?: string })?.code === "P2002" ? "You have already reviewed this business for this collaboration." : "We could not save this change. Please try again." };
}
export async function completeCollaboration(id: string, _state: CollaborationFormState, form: FormData): Promise<CollaborationFormState> {
  const user = await getCurrentUser(); if (!user) return { error: "Please sign in." };
  if (form.get("confirm") !== "yes") return { error: "Confirm that the project work is finished before marking it complete." };
  try {
    await getDb().$transaction(async tx => {
      await requireIdentity(tx, user.id);
      const request = await tx.collaboration.findUnique({ where: { id }, include: { organizer: { select: { ownerId: true } }, participants: { where: { status: "SELECTED" }, include: { business: { select: { ownerId: true } } } } } });
      if (!request || request.organizer.ownerId !== user.id) throw new ReviewError("Only the organiser can mark this collaboration complete.");
      if (request.status === "COMPLETED") throw new ReviewError("This collaboration is already complete.");
      if (!request.participants.length) throw new ReviewError("Select at least one collaborator before completing the project.");
      const outstanding = await tx.activity.findMany({ where: { collaborationId: id, cancelledAt: null }, include: { versions: { include: { attendees: true } } } });
      if (outstanding.some(a => a.versions.find(v => v.version === a.currentVersion)?.attendees.some(person => !person.declinedAt && !person.checkedOutAt))) throw new ReviewError("Finish each attendee’s check-out or cancel unstarted activities before completing the collaboration.");
      await tx.collaboration.update({ where: { id }, data: { status: "COMPLETED", completedAt: new Date() } });
      await notify(tx, request.participants.map(p => p.business.ownerId), "Collaboration completed — you can now leave reviews", `/collaborations/${id}`);
    }, { isolationLevel: "Serializable" });
  } catch (error) { return failure(error); }
  revalidatePath(`/collaborations/${id}`); revalidatePath("/collaborations"); revalidatePath("/", "layout");
  return { success: "Collaboration completed. The final team is saved and reviews are now available." };
}
export async function leaveReview(id: string, _state: CollaborationFormState, form: FormData): Promise<CollaborationFormState> {
  const user = await getCurrentUser(); if (!user) return { error: "Please sign in." };
  const values = Object.fromEntries(["authorId", "targetId", "rating", "body"].map(key => [key, String(form.get(key) ?? "")]));
  const parsed = reviewSchema.safeParse(values); if (!parsed.success) return { values, errors: parsed.error.flatten().fieldErrors };
  try {
    await getDb().$transaction(async tx => {
      await requireIdentity(tx, user.id);
      const request = await tx.collaboration.findUnique({ where: { id }, include: { organizer: { select: { id: true, ownerId: true } }, participants: { where: { status: "SELECTED" }, include: { business: { select: { id: true, ownerId: true } } } } } });
      if (!request || request.status !== "COMPLETED") throw new ReviewError("Reviews are available only after the collaboration is completed.");
      const team = [request.organizer, ...request.participants.map(p => p.business)];
      const author = team.find(b => b.id === parsed.data.authorId); const target = team.find(b => b.id === parsed.data.targetId);
      if (!author || !target || !reviewPairAllowed(author, target, user.id)) throw new ReviewError("You can review only another business you worked with on this completed project.");
      await tx.review.create({ data: { collaborationId: id, ...parsed.data } });
      await notify(tx, [target.ownerId], "Your business received a collaboration review", `/businesses/${target.id}`);
    }, { isolationLevel: "Serializable" });
  } catch (error) { return { ...failure(error), values }; }
  revalidatePath(`/collaborations/${id}`); revalidatePath(`/businesses/${parsed.data.targetId}`); revalidatePath("/"); revalidatePath("/notifications");
  return { success: "Review published on the business profile." };
}
