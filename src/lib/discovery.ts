import { verifiedOwnerFilter } from "./safety-rules.ts";
export const SUGGESTED_DISCOVERY_AREA = "Pretoria, Centurion & Johannesburg";
export const FEED_PAGE_SIZE = 12;

type Params = Record<string, string | string[] | undefined>;

export function parseDiscoveryView(params: Params) {
  const first = (key: string) => {
    const value = params[key];
    return (Array.isArray(value) ? value[0] ?? "" : value ?? "").trim();
  };
  const pageText = first("page");
  const page = /^\d+$/.test(pageText) ? Math.min(1000, Math.max(1, Number(pageText))) : 1;
  return {
    area: first("area").replace(/\s+/g, " ").slice(0, 160),
    searching: first("view") === "search" || !!(first("q") || first("location") || first("service")),
    page,
  };
}

export function localVideoFilter(area: string) {
  // Callers must require an explicit area before querying the feed.
  return {
    kind: { in: ["INTRODUCTION", "SHOWCASE"] as Array<"INTRODUCTION" | "SHOWCASE"> },
    business: { owner: verifiedOwnerFilter(), published: true, ownerId: { not: null }, discoveryArea: { equals: area, mode: "insensitive" as const } },
  };
}

export function discoveryAreas(values: string[], selected: string) {
  const areas = new Map<string, string>();
  for (const value of [SUGGESTED_DISCOVERY_AREA, ...values, selected]) {
    const clean = value.trim().replace(/\s+/g, " ");
    if (clean && !areas.has(clean.toLowerCase())) areas.set(clean.toLowerCase(), clean);
  }
  return [...areas.values()].sort((a, b) => a.localeCompare(b));
}
