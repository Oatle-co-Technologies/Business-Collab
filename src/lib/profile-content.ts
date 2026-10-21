export type MediaSummary = {
  id: string;
  kind: "INTRODUCTION" | "SHOWCASE" | "PHOTO";
  position: number;
  updatedAt: string;
  caption: string | null;
};

export function missingProfileContent(hasLogo: boolean, kinds: string[]) {
  const missing: string[] = [];
  if (!hasLogo) missing.push("a profile picture or business logo");
  if (!kinds.includes("INTRODUCTION")) missing.push("an introduction video");
  if (!kinds.includes("SHOWCASE")) missing.push("a video showcasing your work");
  const photos = kinds.filter(kind => kind === "PHOTO").length;
  if (photos < 2) missing.push(`${2 - photos} more work ${photos === 1 ? "picture" : "pictures"}`);
  if (photos > 5) missing.push("no more than five work pictures");
  return missing;
}

export function readByteRange(header: string, size: number): { start: number; end: number } | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2]) || size <= 0) return null;
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= size) return null;
  return { start, end };
}
