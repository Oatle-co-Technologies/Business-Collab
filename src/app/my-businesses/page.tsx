import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/current-user";
import { getDb } from "@/lib/db";

async function MyBusinesses() {
  const user = await requireUser();
  const businesses = await getDb().business.findMany({ where: { ownerId: user.id }, select: { id: true, name: true, location: true, published: true }, orderBy: { updatedAt: "desc" } });
  if (!businesses.length) return <div className="panel"><h2>Add your first business</h2><p className="mt-2">Your business profiles and drafts will appear here.</p></div>;
  return <ul className="grid gap-4 sm:grid-cols-2">{businesses.map(business => <li className="panel" key={business.id}>
    <h2>{business.name}</h2><p className="mt-2">{business.location}</p><p className="mt-2 text-sm text-neutral-600">{business.published ? "Published" : "Draft"}</p>
    <div className="mt-4 flex flex-wrap gap-4"><Link href={`/businesses/${business.id}`}>View profile</Link><Link href={`/businesses/${business.id}/edit`}>Edit profile</Link></div>
  </li>)}</ul>;
}

export default function Page() {
  return <main className="page"><div className="mb-8 flex flex-wrap items-center justify-between gap-4"><h1>My businesses</h1><Link className="button" href="/businesses/new">Add business</Link></div>
    <Suspense fallback={<p role="status">Loading your businesses…</p>}><MyBusinesses /></Suspense>
  </main>;
}
