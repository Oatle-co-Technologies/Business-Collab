import { z } from "zod";

const id = z.string().min(1, "Choose a business or request.").max(100);
export const collaborationSchema = z.object({
  organizerId: id,
  title: z.string().trim().min(5, "Enter a title of at least 5 characters.").max(120),
  description: z.string().trim().min(20, "Describe the project in at least 20 characters.").max(4000),
  servicesNeeded: z.string().trim().min(1, "Add the services you need.").max(500)
    .transform(value => [...new Set(value.split(",").map(item => item.trim()).filter(Boolean))])
    .refine(value => value.length > 0 && value.length <= 10 && value.every(item => item.length <= 80), "Enter 1–10 service categories, each no longer than 80 characters."),
  location: z.string().trim().min(2, "Enter the project town or city.").max(160),
  discoveryArea: z.string().trim().min(2, "Enter the project discovery area.").max(160).transform(value => value.replace(/\s+/g, " ")),
  visibility: z.enum(["OPEN", "INVITE_ONLY"]),
});
const note = z.string().trim().max(1000, "Keep your message to 1,000 characters or fewer.");
export const invitationSchema = z.object({ collaborationId: id, businessId: id, note });
export const applicationSchema = z.object({ businessId: id, note });
export type CollaborationFormState = { values?: Record<string, string>; errors?: Record<string, string[] | undefined>; error?: string; success?: string };
export type ParticipationStatus = "PENDING" | "INTERESTED" | "SELECTED" | "DECLINED" | "NOT_SELECTED" | "WITHDRAWN";

export function participantTransition(actor: "organizer" | "participant", status: ParticipationStatus, decision: string, open: boolean): ParticipationStatus {
  if (actor === "participant") {
    if (decision === "decline" && status === "PENDING") return "DECLINED";
    if (decision === "withdraw" && (status === "INTERESTED" || status === "SELECTED")) return "WITHDRAWN";
    if (decision === "accept" && status === "PENDING" && open) return "INTERESTED";
  }
  if (actor === "organizer" && open) {
    if (decision === "select" && status === "INTERESTED") return "SELECTED";
    if (decision === "reject" && status === "INTERESTED") return "NOT_SELECTED";
    if (decision === "unselect" && status === "SELECTED") return "INTERESTED";
  }
  throw new Error("This response is no longer available. Refresh the request and try again.");
}

export function participantLabel(status: ParticipationStatus) {
  return { PENDING: "Invited — awaiting response", INTERESTED: "Interested", SELECTED: "Selected", DECLINED: "Declined", NOT_SELECTED: "Not selected", WITHDRAWN: "Withdrawn" }[status];
}
