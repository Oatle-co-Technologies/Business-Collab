import { Suspense } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { requireUser } from "@/lib/current-user";
import { hostedMedia } from "@/lib/media-storage";
import { BusinessForm } from "@/components/business-form";

async function EditForm({ params, searchParams }: PageProps<"/businesses/[id]/edit">) {
  await connection();
  const { id } = await params;
  const saved = (await searchParams).saved === "1";
  const user = await requireUser(`/businesses/${id}/edit`);
  const business = await getDb().business.findFirst({ where: { id, ownerId: user.id }, include: { media: { select: { id: true, kind: true, position: true, updatedAt: true, caption: true }, orderBy: { position: "asc" } } } });
  if (!business) notFound();
  const { logo, media, ...details } = business;
  return <>{saved && <p role="status" className="panel mb-6">Draft saved. Your saved pictures and videos are shown below. You can keep editing or publish when ready.</p>}<BusinessForm hostedUploads={hostedMedia()} key={business.updatedAt.toISOString()} business={{ ...details, hasLogo: !!logo || !!business.logoPath, media: media.map(item => ({ ...item, updatedAt: item.updatedAt.toISOString() })), updatedAt: business.updatedAt.toISOString() }} /></>;
}

export default function EditBusinessPage(props: PageProps<"/businesses/[id]/edit">) {
  return <main className="page max-w-2xl"><h1 className="mb-8">Edit business profile</h1>
    <Suspense fallback={<p role="status">Loading profile…</p>}><EditForm {...props} /></Suspense>
  </main>;
}
