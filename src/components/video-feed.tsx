"use client";

import Link from "next/link";
import { useRef } from "react";

export type FeedVideo = {
  id: string;
  kind: "INTRODUCTION" | "SHOWCASE";
  updatedAt: string;
  reviewCount: number;
  averageRating: number | null;
  business: { id: string; name: string; location: string; discoveryArea: string; industry: string; categories: string[] };
};

export function VideoFeed({ videos }: { videos: FeedVideo[] }) {
  const feed = useRef<HTMLUListElement>(null);
  return <ul ref={feed} className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" onPlayCapture={event => {
    for (const video of feed.current?.querySelectorAll("video") ?? []) {
      if (video !== event.target) video.pause();
    }
  }}>
    {videos.map(item => <li key={item.id} className="min-w-0 overflow-hidden rounded-lg border border-neutral-200 bg-white">
      <div className="relative">
        <video controls playsInline preload="metadata" aria-label={`${item.business.name}: ${item.kind === "INTRODUCTION" ? "introduction" : "work showcase"}`}
          aria-describedby={`video-details-${item.id}`}
          className="aspect-[4/5] w-full bg-neutral-950 object-contain" src={`/businesses/${item.business.id}/media/${item.id}?v=${encodeURIComponent(item.updatedAt)}`}>
          Your browser does not support video playback.
        </video>
        <div id={`video-details-${item.id}`} className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/95 via-black/80 to-transparent p-4 pb-12 text-white">
          <h3 className="line-clamp-2 break-words text-lg font-semibold" title={item.business.name}>{item.business.name}</h3>
          <p className="mt-1 break-words text-sm">{item.business.location}</p>
          <p className="mt-1 line-clamp-2 break-words text-xs text-neutral-200" title={item.business.discoveryArea}>Area: {item.business.discoveryArea}</p>
          <p className="mt-3 line-clamp-2 break-words text-sm" title={item.business.industry || item.business.categories.join(" · ")}>
            {item.business.industry ? `Industry: ${item.business.industry}` : `Services: ${item.business.categories.join(" · ")}`}
          </p>
          <p className="mt-3 text-sm font-medium">{item.reviewCount ? `${item.averageRating?.toFixed(1)} out of 5 · ${item.reviewCount} ${item.reviewCount === 1 ? "review" : "reviews"}` : "0 reviews"}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-600">{item.kind === "INTRODUCTION" ? "Introduction" : "Work showcase"}</p>
        <Link className="button" href={`/businesses/${item.business.id}`}>View business</Link>
      </div>
    </li>)}
  </ul>;
}
