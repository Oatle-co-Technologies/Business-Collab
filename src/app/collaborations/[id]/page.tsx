import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/current-user";
import { getDb } from "@/lib/db";
import { visibleCollaboration } from "@/lib/collaboration-data";
import { participantLabel } from "@/lib/collaboration-rules";
import { ApplicationForm, EntryActions, InvitationForm, RequestStatusForm, CompleteForm, ReviewForm } from "@/components/collaboration-forms";

import { ActivityForm, SafetyReportForm } from "@/components/safety-forms";
import { StartChat } from "@/components/chat-ui";

async function Details({ params, searchParams }: PageProps<"/collaborations/[id]">) {
  const { id } = await params;
  const user = await requireUser(`/collaborations/${id}`);
  const visible = await visibleCollaboration(id, user.id);
  if (!visible) notFound();
  const { request, isOrganizer, ownEntries } = visible;
  const open = request.status === "OPEN";
  const query = await searchParams;
  const db = getDb();
  const candidates = isOrganizer && open ? await db.business.findMany({ where: { published: true, ownerId: { not: user.id }, id: { notIn: request.participants.map(item => item.businessId) } }, select: { id: true, name: true, location: true, categories: true, ownerId: true }, orderBy: { name: "asc" } }) : [];
  const eligible = !isOrganizer && open && request.visibility === "OPEN" ? await db.business.findMany({ where: { ownerId: user.id, published: true, id: { notIn: request.participants.map(item => item.businessId) } }, select: { id: true, name: true, location: true } }) : [];
  const selected = request.participants.filter(item => item.status === "SELECTED");
  const activities = (isOrganizer || ownEntries.length > 0) ? await db.activity.findMany({ where: { collaborationId: id }, include: { versions: { where: isOrganizer ? {} : { attendees: { some: { userId: user.id } } }, orderBy: { version: "desc" }, take: 1, select: { title: true, version: true, startsAt: true } } }, orderBy: { createdAt: "desc" } }) : [];
  const completed = request.status === "COMPLETED";
  const team = [request.organizer, ...selected.map(p => p.business)];
  const myTeam = team.filter(b => b.ownerId === user.id);
  const written = completed && myTeam.length ? await db.review.findMany({ where: { collaborationId: id, authorId: { in: myTeam.map(b => b.id) } }, select: { authorId: true, targetId: true } }) : [];

  return <div className="space-y-6">
    {(isOrganizer || ownEntries.some(e => e.status === "SELECTED")) && <section className="panel"><h2 className="mb-3">Project conversation</h2><StartChat collaborationId={id} /></section>}
    <section className="panel"><h1>{request.title}</h1><p className="mt-3">Organised by {request.organizer.published ? <Link href={`/businesses/${request.organizerId}`}>{request.organizer.name}</Link> : request.organizer.name}</p>
      <p className="mt-2 text-sm text-neutral-600">{request.location} · {request.discoveryArea}</p><p className="mt-3 text-sm">{request.visibility === "OPEN" ? "Public request" : "Invitation only"} · {completed ? "Completed" : open ? "Accepting responses" : "Closed to responses"}</p>
      <h2 className="mt-6">Project brief</h2><p className="mt-2 whitespace-pre-wrap break-words">{request.description}</p><h2 className="mt-6">Services needed</h2><p className="mt-2">{request.servicesNeeded.join(", ")}</p>
    </section>
    {ownEntries.map(entry => <section className="panel" key={entry.id}><h2>{entry.source === "INVITATION" ? "Your invitation" : "Your application"}: {entry.business.name}</h2><p className="mt-2 font-medium">{participantLabel(entry.status)}</p>
      {entry.invitationNote && <p className="mt-3 whitespace-pre-wrap break-words">Invitation message: {entry.invitationNote}</p>}{entry.responseNote && <p className="mt-3 whitespace-pre-wrap break-words">Your response: {entry.responseNote}</p>}
      {!completed && <EntryActions entryId={entry.id} status={entry.status} mode="participant" open={open} />}
      {entry.source === "INVITATION" && ["INTERESTED", "SELECTED"].includes(entry.status) && <div className="mt-4"><StartChat entryId={entry.id} /></div>}
    </section>)}
    {isOrganizer && <section className="panel"><h2 className="mb-4">Invitations and applications</h2>
      {!request.participants.length ? <p>No responses yet. Invite businesses or let them apply to an open request.</p> : <ul className="space-y-5">{request.participants.map(entry => <li key={entry.id} className="border-b border-neutral-200 pb-5 last:border-0">
        <h3 className="font-semibold">{entry.business.published ? <Link href={`/businesses/${entry.businessId}`}>{entry.business.name}</Link> : entry.business.name}</h3><p className="mt-1 text-sm">{entry.status !== "PENDING" && `${entry.source === "INVITATION" ? "Invited" : "Applied"} · `}{participantLabel(entry.status)}</p>
        <p className="mt-2 text-sm text-neutral-600">{entry.business.location} · {entry.business.categories.join(", ")}</p>
        {entry.invitationNote && <p className="mt-3 whitespace-pre-wrap break-words">Invitation: {entry.invitationNote}</p>}{entry.responseNote && <p className="mt-3 whitespace-pre-wrap break-words">Response: {entry.responseNote}</p>}
        <EntryActions entryId={entry.id} status={entry.status} mode="organizer" open={open} />
        {entry.source === "INVITATION" && ["INTERESTED", "SELECTED"].includes(entry.status) && <div className="mt-4"><StartChat entryId={entry.id} /></div>}
      </li>)}</ul>}
    </section>}
    <section className="panel"><h2>Selected collaborators ({selected.length})</h2>{selected.length ? <ul className="mt-3 list-inside list-disc">{selected.map(entry => <li key={entry.id}>{entry.business.published ? <Link href={`/businesses/${entry.businessId}`}>{entry.business.name}</Link> : entry.business.name}</li>)}</ul> : <p className="mt-2 text-neutral-600">No collaborators selected yet.</p>}</section>
    {isOrganizer && open && <section className="panel"><h2 className="mb-4">Invite a business</h2>{candidates.filter(item => item.ownerId).length ? <InvitationForm collaborationId={id} businesses={candidates.filter(item => item.ownerId)} defaultBusinessId={typeof query.invite === "string" ? query.invite : ""} /> : <p>There are no other published businesses available to invite yet.</p>}</section>}
    {!isOrganizer && open && request.visibility === "OPEN" && (eligible.length > 0 || ownEntries.length === 0) && <section className="panel"><h2 className="mb-4">Interested in this project?</h2>{eligible.length ? <ApplicationForm requestId={id} businesses={eligible} /> : <p>To apply, you need a published business that has not already applied or been invited. <Link href="/my-businesses">Manage your businesses</Link></p>}</section>}
    {(isOrganizer || ownEntries.length > 0) && <section className="panel space-y-4"><h2>Scheduled activities</h2><ul className="space-y-3">{activities.filter(a => a.versions[0]?.version === a.currentVersion).map(a => <li key={a.id}><Link href={`/activities/${a.id}`}>{a.versions[0].title}</Link> · {a.cancelledAt ? "Cancelled" : a.versions[0].startsAt.toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" })}</li>)}</ul>{isOrganizer && !completed && <details><summary>Schedule an activity</summary><div className="mt-4"><ActivityForm projectId={id} /></div></details>}</section>}
    {(isOrganizer || ownEntries.length > 0) && <details className="panel"><summary>Report a safety concern</summary><div className="mt-4"><SafetyReportForm projectId={id} /></div></details>}
    {isOrganizer && !completed && <section className="panel"><h2 className="mb-4">Finish collaboration</h2><CompleteForm requestId={id} /></section>}
    {completed && <section className="panel"><h2>Completed collaboration</h2><p className="mt-3">The final team is locked. Reviews are available only to the organiser and selected collaborators.</p>{request.completedAt && <p className="mt-2 text-sm">Completed {request.completedAt.toLocaleDateString("en-ZA", { timeZone: "Africa/Johannesburg" })}</p>}</section>}
    {completed && myTeam.length > 0 && <section className="space-y-4"><h2>Review your collaborators</h2>{myTeam.flatMap(author => team.filter(target => target.ownerId && target.ownerId !== user.id).map(target => written.some(r => r.authorId === author.id && r.targetId === target.id) ? <p key={`${author.id}-${target.id}`}>Review of {target.name} from {author.name} published.</p> : <ReviewForm key={`${author.id}-${target.id}`} requestId={id} author={author} target={target} />))}</section>}
    {isOrganizer && !completed && <section className="panel"><h2 className="mb-4">Manage responses</h2><RequestStatusForm requestId={id} open={open} /></section>}
  </div>;
}
export default function Page(props: PageProps<"/collaborations/[id]">) {
  return <main className="page"><Link className="mb-6 inline-block" href="/collaborations">Back to collaborations</Link><Suspense fallback={<p role="status">Loading collaboration request…</p>}><Details {...props} /></Suspense></main>;
}
