import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/current-user";
import { canViewBusiness, canEditBusiness } from "@/lib/access";
import { ProfileMedia } from "@/components/profile-media";
import { missingProfileContent } from "@/lib/profile-content";
import { getDb } from "@/lib/db";


import { identityEligible } from "@/lib/safety-rules";

async function Profile({ params, searchParams }: PageProps<"/businesses/[id]">) {
  await connection();
  const { id } = await params;
  const user = await requireUser(`/businesses/${id}`);
  const query = await searchParams;
  const business = await getDb().business.findUnique({ where: { id }, include: { owner: { select: { safetySuspended: true, identityCheck: { select: { status: true, expiresAt: true } } } }, media: { select: { id: true, kind: true, position: true, updatedAt: true, caption: true }, orderBy: { position: "asc" } } } });
  if (!business || !canViewBusiness(user.id, business)) notFound();
  const [reviews, rating] = await Promise.all([
    getDb().review.findMany({ where: { targetId: id }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 20, select: { id: true, rating: true, body: true, createdAt: true, author: { select: { id: true, name: true, published: true } } } }),
    getDb().review.aggregate({ where: { targetId: id }, _avg: { rating: true }, _count: true }),
  ]);
  return <>
    <Link className="mb-6 inline-block" href={business.discoveryArea ? `/?${new URLSearchParams({ area: business.discoveryArea })}` : "/"}>Back to businesses</Link>
    {query.saved === "1" && <p role="status" className="mb-6 rounded border border-neutral-300 p-3">Business profile saved.</p>}
    {canEditBusiness(user.id, business.ownerId) && <section className="panel mb-6">
      <h2>{business.published ? "Published profile" : "Draft profile"}</h2>
      <p className="mt-2 text-sm">{business.published ? "This profile is listed for other businesses to browse." : "This profile is not listed for other businesses yet. Add the required content, then publish it."}</p>
      {!business.published && <ul className="mt-2 list-inside list-disc text-sm">{missingProfileContent(!!(business.logo || business.logoPath), business.media.map(item => item.kind)).map(item => <li key={item}>Still needed: {item}</li>)}</ul>}
    </section>}
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-4">
        {(business.logo || business.logoPath) && <Image src={`/businesses/${id}/logo?v=${business.updatedAt.getTime()}`}
          alt={`${business.name} profile picture or logo`} width={96} height={96} unoptimized
          className="h-24 w-24 shrink-0 rounded-md border border-neutral-200 bg-white object-contain" />}
        <h1 className="min-w-0 break-words">{business.name}</h1>
      </div>
      {!canEditBusiness(user.id, business.ownerId) && business.published && <Link className="button" href={`/collaborations/invite?${new URLSearchParams({ business: id })}`}>Invite to collaborate</Link>}
      {canEditBusiness(user.id, business.ownerId) && <Link className="button" href={`/businesses/${id}/edit`}>Edit profile</Link>}
    </div>
    <p className="mb-3 text-sm">{identityEligible(business.owner?.identityCheck ?? null, business.owner?.safetySuspended ?? true) ? "Identity checked · This does not guarantee safety" : "Identity not checked or currently restricted · Collaboration participation unavailable"}</p>
    <p className="text-neutral-600">{business.location}</p>
    {business.discoveryArea && <p className="mt-1 text-sm text-neutral-600">Discovery area: {business.discoveryArea}</p>}
    {business.industry && <p className="mt-3 text-sm">Industry: {business.industry}</p>}
    <p className="mt-3 break-words">{business.categories.join(" · ")}</p>
    <section className="panel my-6"><h2>About the business</h2><p className="mt-3 whitespace-pre-wrap break-words">{business.description}</p></section>
    <ProfileMedia businessId={id} media={business.media.map(item => ({ ...item, updatedAt: item.updatedAt.toISOString() }))} />
    <section className="panel mb-6" aria-labelledby="reviews-heading"><h2 id="reviews-heading">Reviews ({rating._count})</h2>{rating._count ? <><p className="mt-2">{rating._avg.rating?.toFixed(1)} out of 5 · From completed collaborations</p><ul className="mt-5 space-y-5">{reviews.map(review => <li key={review.id} className="border-t border-neutral-200 pt-4"><p className="font-semibold">{review.rating} out of 5 · {review.author.published ? <Link href={`/businesses/${review.author.id}`}>{review.author.name}</Link> : review.author.name}</p><p className="mt-2 whitespace-pre-wrap break-words">{review.body}</p><p className="mt-2 text-sm text-neutral-600">Completed collaboration · <time dateTime={review.createdAt.toISOString()}>{review.createdAt.toLocaleDateString("en-ZA", { timeZone: "Africa/Johannesburg" })}</time></p></li>)}</ul>{rating._count > 20 && <p className="mt-4 text-sm">Showing the latest 20 reviews. The average includes all reviews.</p>}</> : <p className="mt-2 text-neutral-600">No reviews yet.</p>}</section>
    <p className="my-5"><Link href={`/safety/report?${new URLSearchParams({ business: id })}`}>Report a safety concern about this business</Link></p>
    <section className="panel"><h2>Business contact details</h2>
      <dl className="mt-4 space-y-4 break-words">
        <div><dt>Email</dt><dd><a href={`mailto:${business.email}`}>{business.email}</a></dd></div>
        <div><dt>Phone</dt><dd><a href={`tel:${business.phone.replace(/[^+\d]/g, "")}`}>{business.phone}</a></dd></div>
        {business.website && <div><dt>Website</dt><dd><a href={business.website} target="_blank" rel="noopener noreferrer">{business.website}</a></dd></div>}
        {business.portfolio && <div><dt>Portfolio</dt><dd><a href={business.portfolio} target="_blank" rel="noopener noreferrer">{business.portfolio}</a></dd></div>}
      </dl>
    </section>
  </>;
}

export default function BusinessPage(props: PageProps<"/businesses/[id]">) {
  return <main className="page max-w-3xl">
    <Suspense fallback={<p role="status">Loading profile…</p>}><Profile {...props} /></Suspense>
  </main>;
}
