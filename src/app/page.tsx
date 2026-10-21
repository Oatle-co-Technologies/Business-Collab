import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { getDb } from "@/lib/db";
import { parseBusinessSearch, publishedBusinessFilter } from "@/lib/business-search";
import { discoveryAreas, FEED_PAGE_SIZE, localVideoFilter, parseDiscoveryView } from "@/lib/discovery";
import { VideoFeed, type FeedVideo } from "@/components/video-feed";

import { verifiedOwnerFilter } from "@/lib/safety-rules";

type Card = { id: string; name: string; location: string; discoveryArea: string; categories: string[]; description: string; published: boolean };

function BusinessCards({ businesses }: { businesses: Card[] }) {
  return <ul className="grid gap-4 sm:grid-cols-2">{businesses.map(business => <li className="panel" key={business.id}>
    <h3 className="text-lg font-semibold"><Link href={`/businesses/${business.id}`}>{business.name}</Link></h3>
    <p className="mt-2 text-neutral-600">{business.location}</p>
    <ul aria-label="Services offered" className="mt-3 flex flex-wrap gap-2">{business.categories.map(category => <li className="rounded border border-neutral-300 px-2 py-1 text-sm" key={category}>{category}</li>)}</ul>
    <p className="mt-3 line-clamp-3 break-words text-neutral-600">{business.description}</p>
    <Link className="mt-4 inline-block" href={business.published ? `/businesses/${business.id}` : `/businesses/${business.id}/edit`}>{business.published ? "View profile" : "Continue draft"}</Link>
  </li>)}</ul>;
}

async function Discovery({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  await connection();
  const user = await getCurrentUser();
  if (!user) return <section className="panel"><h2>Discover your next collaborator</h2><p className="my-4">Sign in to explore nearby businesses and manage your own profile.</p><div className="flex flex-wrap gap-4"><Link className="button" href="/sign-in">Sign in</Link><Link href="/sign-up">Create an account</Link></div></section>;
  const params = await searchParams;
  const filters = parseBusinessSearch(params);
  const view = parseDiscoveryView(params);
  const feedUrl = view.area ? `/?${new URLSearchParams({ area: view.area })}` : "/";
  let businesses: Card[] = [];
  let drafts: Card[];
  let categoryRows: { categories: string[] }[];
  let areaRows: { discoveryArea: string }[];
  let videos: FeedVideo[] = [];
  let hasMore = false;
  try {
    const db = getDb();
    [drafts, categoryRows, areaRows] = await Promise.all([
      db.business.findMany({ where: { published: false, ownerId: user.id }, omit: { logo: true }, orderBy: { updatedAt: "desc" } }),
      db.business.findMany({ where: { published: true, owner: verifiedOwnerFilter(), ownerId: { not: null }, ...(view.area ? { discoveryArea: { equals: view.area, mode: "insensitive" as const } } : {}) }, select: { categories: true } }),
      db.business.findMany({ where: { published: true, owner: verifiedOwnerFilter(), ownerId: { not: null }, discoveryArea: { not: "" } }, select: { discoveryArea: true }, distinct: ["discoveryArea"] }),
    ]);
    if (view.searching) {
      businesses = await db.business.findMany({ where: publishedBusinessFilter(filters, view.area), omit: { logo: true }, orderBy: { createdAt: "desc" } });
    } else if (view.area) {
      const rows = await db.businessMedia.findMany({
        where: localVideoFilter(view.area), orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        skip: (view.page - 1) * FEED_PAGE_SIZE, take: FEED_PAGE_SIZE + 1,
        select: { id: true, kind: true, updatedAt: true, business: { select: { id: true, name: true, location: true, discoveryArea: true, industry: true, categories: true } } },
      });
      hasMore = rows.length > FEED_PAGE_SIZE;
      const ratings = await db.review.groupBy({ by: ["targetId"], where: { targetId: { in: rows.slice(0, FEED_PAGE_SIZE).map(item => item.business.id) } }, _avg: { rating: true }, _count: true });
      videos = rows.slice(0, FEED_PAGE_SIZE).map(item => {
        const rating = ratings.find(r => r.targetId === item.business.id);
        return { ...item, kind: item.kind as "INTRODUCTION" | "SHOWCASE", updatedAt: item.updatedAt.toISOString(), reviewCount: rating?._count ?? 0, averageRating: rating?._avg.rating ?? null };
      });
    }
  } catch {
    return <p role="alert">Businesses could not be loaded. Please try again shortly.</p>;
  }
  const areas = discoveryAreas(areaRows.map(row => row.discoveryArea), view.area);
  const selectedArea = areas.find(area => area.toLowerCase() === view.area.toLowerCase()) ?? view.area;
  const services = [...new Set(categoryRows.flatMap(row => row.categories))].sort((a, b) => a.localeCompare(b));
  if (filters.service && !services.includes(filters.service)) services.push(filters.service);
  const pageUrl = (page: number) => `/?${new URLSearchParams({ area: view.area, page: String(page) })}`;
  return <div className="space-y-8">
    <form action="/" method="get" aria-label="Choose discovery area" className="panel flex flex-wrap items-end gap-4">
      <div className="min-w-0 flex-1"><label htmlFor="area">Your discovery area</label>
        <select id="area" name="area" defaultValue={selectedArea} className="w-full rounded-md border border-neutral-400 bg-white px-3 py-2">
          <option value="">Choose an area</option>{areas.map(area => <option key={area} value={area}>{area}</option>)}
        </select>
      </div><button type="submit">Show local videos</button>
      <p className="w-full text-sm text-neutral-600">Choose where you want to discover businesses. Their towns remain visible on each video. You can explore another area by changing this selection.</p>
    </form>
    <details className="panel" open={view.searching}>
      <summary className="cursor-pointer font-semibold">Search businesses</summary>
      <form action="/" method="get" aria-label="Find collaborators" className="mt-5 grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <input type="hidden" name="view" value="search" /><input type="hidden" name="area" value={view.area} />
        <div><label htmlFor="q">Business name or keyword</label><input id="q" name="q" defaultValue={filters.query} maxLength={120} placeholder="For example, wedding cakes" /></div>
        <div><label htmlFor="location">Town or city</label><input id="location" name="location" defaultValue={filters.location} maxLength={160} placeholder="For example, Pretoria" /></div>
        <div><label htmlFor="service">Service</label><select id="service" name="service" defaultValue={filters.service} className="w-full rounded-md border border-neutral-400 bg-white px-3 py-2">
          <option value="">All services</option>{services.map(service => <option key={service} value={service}>{service}</option>)}
        </select></div>
        <div><button type="submit">Find businesses</button></div>
        <p className="text-sm text-neutral-600 sm:col-span-2 lg:col-span-4">Search shows business profiles{view.area ? ` in ${selectedArea}` : " across areas"}, without videos.</p>
      </form>
    </details>
    {view.searching ? <section aria-labelledby="results-heading">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 id="results-heading">Business results</h2><Link href={feedUrl}>Back to local videos</Link></div>
      <p role="status" className="mb-4 text-sm text-neutral-600">{businesses.length} {businesses.length === 1 ? "business" : "businesses"} matching your search.</p>
      {!businesses.length ? <div className="panel"><p>No businesses match these filters. Try a different service, a nearby town or fewer keywords.</p><Link className="mt-3 inline-block" href={`/?${new URLSearchParams({ view: "search", area: view.area })}`}>Clear search filters</Link></div> : <BusinessCards businesses={businesses} />}
    </section> : <section aria-labelledby="videos-heading">
      <h2 id="videos-heading" className="mb-2">{view.area ? `Videos from ${selectedArea}` : "Discover businesses near you"}</h2>
      <p className="mb-5 text-sm text-neutral-600">Introductions and work showcases, with the newest uploads first. Open a business profile to explore further.</p>
      {!view.area ? <div className="panel"><p>Choose your discovery area above to see local videos.</p></div> : videos.length ? <VideoFeed videos={videos} /> : <div className="panel"><p>{view.page > 1 ? "There are no more videos on this page." : "No published videos in this area yet. Explore another area or publish your business profile to appear here."}</p></div>}
      {(view.page > 1 || hasMore) && <nav aria-label="Video feed pages" className="mt-5 flex justify-between gap-4">
        {view.page > 1 && <Link href={pageUrl(view.page - 1)}>Newer videos</Link>}{hasMore && <Link href={pageUrl(view.page + 1)}>Older videos</Link>}
      </nav>}
    </section>}
    <details className="panel"><summary className="cursor-pointer font-semibold">My draft profiles ({drafts.length})</summary>
      <div className="mt-4">{drafts.length ? <BusinessCards businesses={drafts} /> : <p className="text-neutral-600">No drafts yet.</p>}</div>
    </details>
  </div>;
}

export default function Home({ searchParams }: PageProps<"/">) {
  return <main className="page">
    <div className="mb-8 flex flex-wrap items-start justify-between gap-5">
      <div><h1>Discover local businesses</h1><p className="mt-2 text-neutral-600">See their work. Meet the people. Find a collaborator.</p></div>
      <Link className="button" href="/businesses/new">Add business</Link>
    </div>
    <Suspense fallback={<p role="status">Loading businesses…</p>}><Discovery searchParams={searchParams} /></Suspense>
  </main>;
}
