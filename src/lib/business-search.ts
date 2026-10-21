import { verifiedOwnerFilter } from "./safety-rules.ts";
type QueryParams = Record<string, string | string[] | undefined>;

export function parseBusinessSearch(params: QueryParams) {
  const read = (key: string, max: number) => {
    const value = params[key];
    return (Array.isArray(value) ? value[0] ?? "" : value ?? "").trim().slice(0, max);
  };
  return { query: read("q", 120), location: read("location", 160), service: read("service", 80) };
}

export function publishedBusinessFilter(filters: ReturnType<typeof parseBusinessSearch>, area = "") {
  return {
    published: true,
    ownerId: { not: null },
    owner: verifiedOwnerFilter(),
    ...(area ? { discoveryArea: { equals: area, mode: "insensitive" as const } } : {}),
    ...(filters.query ? { OR: [
      { name: { contains: filters.query, mode: "insensitive" as const } },
      { description: { contains: filters.query, mode: "insensitive" as const } },
    ] } : {}),
    ...(filters.location ? { location: { contains: filters.location, mode: "insensitive" as const } } : {}),
    ...(filters.service ? { categories: { has: filters.service } } : {}),
  };
}
