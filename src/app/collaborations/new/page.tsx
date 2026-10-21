import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/current-user";
import { getDb } from "@/lib/db";
import { CreateRequestForm } from "@/components/collaboration-forms";

async function NewForm({ searchParams }: PageProps<"/collaborations/new">) {
  const user = await requireUser("/collaborations/new");
  const params = await searchParams;
  const businesses = await getDb().business.findMany({ where: { ownerId: user.id, published: true }, select: { id: true, name: true, location: true, discoveryArea: true }, orderBy: { name: "asc" } });
  if (!businesses.length) return <div className="panel"><h2>Publish your business profile first</h2><p className="my-3">A published business profile is needed to organise a collaboration.</p><Link href="/my-businesses">Go to my businesses</Link></div>;
  return <CreateRequestForm businesses={businesses} inviteBusinessId={typeof params.invite === "string" ? params.invite.slice(0,100) : ""} />;
}
export default function Page(props: PageProps<"/collaborations/new">) {
  return <main className="page max-w-2xl"><Link href="/collaborations">Back to collaborations</Link><h1 className="mb-3 mt-6">Create a collaboration request</h1><p className="mb-8 text-neutral-600">Explain the project, the services needed and what collaborators will contribute.</p>
    <Suspense fallback={<p role="status">Loading your businesses…</p>}><NewForm {...props} /></Suspense>
  </main>;
}
