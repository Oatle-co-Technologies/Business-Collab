import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/current-user";
import { getDb } from "@/lib/db";
import { InvitationForm } from "@/components/collaboration-forms";

async function Invite({ searchParams }: PageProps<"/collaborations/invite">) {
  const params = await searchParams;
  const id = typeof params.business === "string" ? params.business : "";
  const user = await requireUser(`/collaborations/invite?${new URLSearchParams({business:id})}`);
  const db = getDb();
  const business = await db.business.findFirst({ where: { id, published: true, ownerId: { not: user.id } }, select: { id: true, name: true, location: true, ownerId: true } });
  if (!business?.ownerId) notFound();
  const requests = await db.collaboration.findMany({ where: { status: "OPEN", organizer: { ownerId: user.id, published: true }, participants: { none: { businessId: business.id } } }, select: { id: true, title: true }, orderBy: { updatedAt: "desc" } });
  return <><h1 className="mb-3 mt-6">Invite {business.name}</h1><p className="mb-8 text-neutral-600">Choose one of your requests and explain why you would like to work together.</p>
    {requests.length ? <InvitationForm businessId={business.id} requests={requests} /> : <p className="panel mb-5">There are no eligible open requests to invite this business to. It may already have a response on your existing requests.</p>}
    <Link className="mt-6 inline-block" href={`/collaborations/new?${new URLSearchParams({ invite: business.id })}`}>Create a new request for this invitation</Link>
  </>;
}
export default function Page(props: PageProps<"/collaborations/invite">) {
  return <main className="page max-w-2xl"><Link href="/collaborations">Back to collaborations</Link><Suspense fallback={<p role="status">Loading invitation…</p>}><Invite {...props} /></Suspense></main>;
}
