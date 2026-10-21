"use client";

import { useActionState, useId } from "react";
import { createCollaboration, sendInvitation, applyToCollaboration, respondToInvitation, reviewApplicant, setCollaborationStatus } from "@/app/collaborations/actions";
import type { CollaborationFormState, ParticipationStatus } from "@/lib/collaboration-rules";

import { completeCollaboration, leaveReview } from "@/app/collaborations/review-actions";

type BusinessOption = { id: string; name: string; location: string; discoveryArea?: string; categories?: string[] };
function Feedback({ state }: { state: CollaborationFormState }) {
  return <>{state.error && <p role="alert" className="error">{state.error}</p>}
    {state.errors && <ul role="alert" className="error list-inside list-disc">{Object.entries(state.errors).flatMap(([key, values]) => values?.map(value => <li key={`${key}-${value}`}>{value}</li>) ?? [])}</ul>}
    {state.success && <p role="status" className="rounded border border-neutral-300 p-3 text-sm">{state.success}</p>}</>;
}
function TextField({ name, label, state, multiline = false, required = false, maxLength = 160, defaultValue = "" }: { name: string; label: string; state: CollaborationFormState; multiline?: boolean; required?: boolean; maxLength?: number; defaultValue?: string }) {
  const inputId = useId();
  const props = { id: inputId, name, required, maxLength, defaultValue: state.values?.[name] ?? defaultValue, "aria-invalid": !!state.errors?.[name] };
  return <div><label htmlFor={inputId}>{label}</label>{multiline ? <textarea {...props} rows={4} /> : <input {...props} />}</div>;
}
const selectClass = "w-full rounded-md border border-neutral-400 bg-white px-3 py-2";

export function CreateRequestForm({ businesses, inviteBusinessId = "" }: { businesses: BusinessOption[]; inviteBusinessId?: string }) {
  const [state, action, pending] = useActionState<CollaborationFormState, FormData>(createCollaboration, {});
  return <form action={action} className="space-y-5"><Feedback state={state} />
    <input type="hidden" name="inviteBusinessId" value={inviteBusinessId} />
    <div><label htmlFor="organizerId">Organising business</label><select className={selectClass} id="organizerId" name="organizerId" required defaultValue={state.values?.organizerId ?? businesses[0]?.id}>
      {businesses.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
    </select></div>
    <TextField name="title" label="Project title" state={state} required maxLength={120} />
    <TextField name="description" label="Project brief" state={state} required multiline maxLength={4000} />
    <TextField name="servicesNeeded" label="Services needed (separate with commas)" state={state} required maxLength={500} />
    <TextField name="location" label="Project town or city" state={state} required defaultValue={businesses[0]?.location} />
    <TextField name="discoveryArea" label="Project discovery area" state={state} required defaultValue={businesses[0]?.discoveryArea} />
    <div><label htmlFor="visibility">Who can respond?</label><select className={selectClass} id="visibility" name="visibility" defaultValue={state.values?.visibility ?? "OPEN"}>
      <option value="OPEN">Open to applications</option><option value="INVITE_ONLY">Invitation only</option>
    </select><p className="mt-2 text-sm text-neutral-600">Open requests can be discovered by other members. Invitation-only requests are visible to the organiser and invited businesses.</p></div>
    <button disabled={pending}>{pending ? "Creating…" : "Create request"}</button>
  </form>;
}

export function InvitationForm({ collaborationId, businessId, requests = [], businesses = [], defaultBusinessId = "" }: { collaborationId?: string; businessId?: string; requests?: { id: string; title: string }[]; businesses?: BusinessOption[]; defaultBusinessId?: string }) {
  const [state, action, pending] = useActionState<CollaborationFormState, FormData>(sendInvitation, {});
  return <form action={action} className="space-y-4"><Feedback state={state} />
    {collaborationId ? <input type="hidden" name="collaborationId" value={collaborationId} /> : <div><label htmlFor="collaborationId">Your collaboration request</label><select className={selectClass} name="collaborationId" id="collaborationId" required defaultValue={state.values?.collaborationId ?? ""}>
      <option value="">Choose a request</option>{requests.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
    </select></div>}
    {businessId ? <input type="hidden" name="businessId" value={businessId} /> : <div><label htmlFor="invite-business">Business to invite</label><select className={selectClass} name="businessId" id="invite-business" required defaultValue={state.values?.businessId ?? defaultBusinessId}>
      <option value="">Choose a business</option>{businesses.map(item => <option key={item.id} value={item.id}>{item.name} — {item.location}{item.categories?.length ? ` — ${item.categories.join(", ")}` : ""}</option>)}
    </select></div>}
    <TextField name="note" label="Invitation message (optional)" state={state} multiline maxLength={1000} />
    <button disabled={pending}>{pending ? "Sending…" : "Send invitation"}</button>
  </form>;
}

export function ApplicationForm({ requestId, businesses }: { requestId: string; businesses: BusinessOption[] }) {
  const [state, action, pending] = useActionState<CollaborationFormState, FormData>(applyToCollaboration.bind(null, requestId), {});
  return <form action={action} className="space-y-4"><Feedback state={state} />
    <div><label htmlFor="apply-business">Your business</label><select className={selectClass} name="businessId" id="apply-business" defaultValue={state.values?.businessId ?? businesses[0]?.id} required>{businesses.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
    <TextField name="note" label="How can your business contribute? (optional)" state={state} multiline maxLength={1000} />
    <button disabled={pending}>{pending ? "Sending…" : "Express interest"}</button>
  </form>;
}

export function EntryActions({ entryId, status, mode, open }: { entryId: string; status: ParticipationStatus; mode: "organizer" | "participant"; open: boolean }) {
  const [state, action, pending] = useActionState<CollaborationFormState, FormData>((mode === "organizer" ? reviewApplicant : respondToInvitation).bind(null, entryId), {});
  const choices = mode === "organizer" ? open && status === "INTERESTED" ? [["select", "Select collaborator"], ["reject", "Decline application"]] : open && status === "SELECTED" ? [["unselect", "Remove selection"]] : []
    : status === "PENDING" ? [...(open ? [["accept", "Accept invitation"]] : []), ["decline", "Decline invitation"]] : ["INTERESTED", "SELECTED"].includes(status) ? [["withdraw", "Withdraw"]] : [];
  if (!choices.length) return null;
  return <form action={action} className="mt-4 space-y-3"><Feedback state={state} />
    {mode === "participant" && status === "PENDING" && <><p className="text-sm text-neutral-600">Accepting confirms your interest. The organiser makes the final selection.</p><TextField name="note" label="Response message (optional)" state={state} multiline maxLength={1000} /></>}
    <div className="flex flex-wrap gap-3">{choices.map(([decision, label]) => <button key={decision} name="decision" value={decision} disabled={pending}>{pending ? "Saving…" : label}</button>)}</div>
  </form>;
}

export function RequestStatusForm({ requestId, open }: { requestId: string; open: boolean }) {
  const [state, action, pending] = useActionState<CollaborationFormState, FormData>(setCollaborationStatus.bind(null, requestId), {});
  return <form action={action} className="space-y-3"><Feedback state={state} /><input type="hidden" name="status" value={open ? "CLOSED" : "OPEN"} />
    <p className="text-sm text-neutral-600">Closing stops new responses and selections. It does not mark the project complete.</p>
    <button disabled={pending}>{pending ? "Saving…" : open ? "Close to new responses" : "Reopen request"}</button>
  </form>;
}

export function CompleteForm({ requestId }: { requestId: string }) {
  const [state, action, pending] = useActionState<CollaborationFormState, FormData>(completeCollaboration.bind(null, requestId), {});
  return <form action={action} className="space-y-4"><Feedback state={state} /><p>Complete the project once the work is finished. This locks the final team, stops further applications and selections, and enables reviews. Completed projects cannot be reopened.</p><label className="flex items-start gap-2"><input className="w-auto" type="checkbox" name="confirm" value="yes" required disabled={pending} />I confirm that this collaboration’s work is finished.</label><button disabled={pending}>{pending ? "Saving…" : "Mark collaboration complete"}</button></form>;
}
export function ReviewForm({ requestId, author, target }: { requestId: string; author: { id: string; name: string }; target: { id: string; name: string } }) {
  const [state, action, pending] = useActionState<CollaborationFormState, FormData>(leaveReview.bind(null, requestId), {});
  const ratingId = useId();
  return <form action={action} className="panel space-y-4"><h3 className="font-semibold">Review {target.name}</h3><p className="text-sm">From {author.name}. Your rating and review will appear on their business profile. One review per business pair for this project.</p><Feedback state={state} /><input type="hidden" name="authorId" value={author.id} /><input type="hidden" name="targetId" value={target.id} /><label htmlFor={ratingId}>Rating</label><select id={ratingId} name="rating" required defaultValue={state.values?.rating ?? ""}><option value="">Choose a rating</option>{[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{n} out of 5</option>)}</select><TextField name="body" label="Your experience working together" state={state} required multiline maxLength={2000} /><button disabled={pending}>{pending ? "Publishing…" : "Publish review"}</button></form>;
}
