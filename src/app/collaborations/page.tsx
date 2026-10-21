import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/current-user";
import { getDb } from "@/lib/db";
import { participantLabel } from "@/lib/collaboration-rules";

async function Hub() {
  const user = await requireUser("/collaborations");
  const db = getDb();
  const [own, opportunities, entries] = await Promise.all([
    db.collaboration.findMany({ where: { organizer: { ownerId: user.id } }, include: { organizer: { select: { name: true } } }, orderBy: { updatedAt: "desc" } }),
    db.collaboration.findMany({ where: { visibility: "OPEN", status: "OPEN", organizer: { published: true, ownerId: { not: user.id } } }, include: { organizer: { select: { name: true, ownerId: true } } }, orderBy: { createdAt: "desc" } }),
    db.collaborationParticipant.findMany({ where: { business: { ownerId: user.id } }, include: { business: { select: { name: true } }, collaboration: { select: { id: true, title: true, status: true } } }, orderBy: { updatedAt: "desc" } }),
  ]);
  const invitations = entries.filter(item => item.status === "PENDING" && item.collaboration.status !== "COMPLETED");
  const responses = entries.filter(item => item.status !== "PENDING" || item.collaboration.status === "COMPLETED");
  return <div className="space-y-8">
    <section id="invitations" aria-labelledby="invitations-heading"><h2 id="invitations-heading" className="mb-4">Invitations ({invitations.length})</h2>
      {invitations.length ? <ul className="grid gap-4 sm:grid-cols-2">{invitations.map(item => <li key={item.id} className="panel"><h3 className="font-semibold"><Link href={`/collaborations/${item.collaborationId}`}>{item.collaboration.title}</Link></h3><p className="mt-2">For {item.business.name}</p><p className="mt-2 text-sm">{item.collaboration.status === "OPEN" ? "Awaiting your response" : "Closed to new responses"}</p><Link className="mt-3 inline-block" href={`/collaborations/${item.collaborationId}`}>Review invitation</Link></li>)}</ul> : <p className="text-neutral-600">No invitations waiting for you.</p>}
    </section>
    <section aria-labelledby="own-heading"><h2 id="own-heading" className="mb-4">Your requests</h2>
      {own.length ? <ul className="grid gap-4 sm:grid-cols-2">{own.map(item => <li className="panel" key={item.id}><h3 className="font-semibold"><Link href={`/collaborations/${item.id}`}>{item.title}</Link></h3><p className="mt-2">{item.organizer.name}</p><p className="mt-2 text-sm">{item.visibility === "OPEN" ? "Public request" : "Invitation only"} · {item.status === "COMPLETED" ? "Completed" : item.status === "OPEN" ? "Accepting responses" : "Closed to responses"}</p><Link className="mt-3 inline-block" href={`/collaborations/${item.id}`}>Manage request</Link></li>)}</ul> : <p className="text-neutral-600">You have not created a request yet.</p>}
    </section>
    <section aria-labelledby="responses-heading"><h2 id="responses-heading" className="mb-4">Your responses and selections</h2>
      {responses.length ? <ul className="grid gap-4 sm:grid-cols-2">{responses.map(item => <li className="panel" key={item.id}><h3 className="font-semibold"><Link href={`/collaborations/${item.collaborationId}`}>{item.collaboration.title}</Link></h3><p className="mt-2">{item.business.name} · {item.collaboration.status === "COMPLETED" ? "Completed · " : ""}{participantLabel(item.status)}</p></li>)}</ul> : <p className="text-neutral-600">Your applications and selections will appear here.</p>}
    </section>
    <section aria-labelledby="opportunities-heading"><h2 id="opportunities-heading" className="mb-4">Open opportunities</h2>
      {opportunities.length ? <ul className="grid gap-4 sm:grid-cols-2">{opportunities.filter(item => item.organizer.ownerId).map(item => <li className="panel" key={item.id}><h3 className="font-semibold"><Link href={`/collaborations/${item.id}`}>{item.title}</Link></h3><p className="mt-2">Organised by {item.organizer.name}</p><p className="mt-2 text-sm">{item.location} · {item.discoveryArea}</p><p className="mt-2">Needed: {item.servicesNeeded.join(", ")}</p><Link className="mt-3 inline-block" href={`/collaborations/${item.id}`}>View opportunity</Link></li>)}</ul> : <p className="text-neutral-600">No open opportunities yet.</p>}
    </section>
  </div>;
}

export default function Page() {
  return <main className="page"><div className="mb-8 flex flex-wrap items-center justify-between gap-4"><div><h1>Collaborations</h1><p className="mt-2 text-neutral-600">Bring businesses together around a client project.</p></div><Link className="button" href="/collaborations/new">Create request</Link></div>
    <Suspense fallback={<p role="status">Loading collaborations…</p>}><Hub /></Suspense>
  </main>;
}
