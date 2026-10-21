import Image from "next/image";
import type { MediaSummary } from "@/lib/profile-content";

export function ProfileMedia({ businessId, media }: { businessId: string; media: MediaSummary[] }) {
  const videos = media.filter(item => item.kind !== "PHOTO");
  const photos = media.filter(item => item.kind === "PHOTO");
  return <div className="my-6 space-y-6">
    {videos.length > 0 && <section className="grid gap-4 sm:grid-cols-2">{videos.map(item => <div className="panel" key={item.id}>
      <h2 className="mb-3">{item.kind === "INTRODUCTION" ? "Meet the business" : "See our work"}</h2>
      <video controls preload="metadata" playsInline aria-label={item.kind === "INTRODUCTION" ? "Introduction video" : "Work showcase video"}
        className="aspect-video w-full rounded bg-neutral-100" src={`/businesses/${businessId}/media/${item.id}?v=${encodeURIComponent(item.updatedAt)}`}>
        Your browser does not support video playback.
      </video>
    </div>)}</section>}
    {photos.length > 0 && <section className="panel"><h2 className="mb-4">Our work</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{photos.map((item, index) => <figure key={item.id} className="min-w-0"><a href={`/businesses/${businessId}/media/${item.id}`} target="_blank" rel="noopener noreferrer">
        <Image src={`/businesses/${businessId}/media/${item.id}`} alt={item.caption || `Work example ${index + 1}`} width={400} height={300} unoptimized className="aspect-[4/3] w-full rounded bg-neutral-100 object-contain" />
      </a>{item.caption && <figcaption className="mt-2 whitespace-pre-wrap break-words text-sm text-neutral-700">{item.caption}</figcaption>}</figure>)}</div>
    </section>}
  </div>;
}
