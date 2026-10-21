export function canViewBusiness(userId: string | null, business: { ownerId: string | null; published: boolean }) {
  return !!userId && (business.ownerId === userId || (business.published && business.ownerId !== null));
}

export function canEditBusiness(userId: string | null, ownerId: string | null) {
  return !!userId && ownerId === userId;
}

export function safeReturnPath(value: unknown) {
  if (typeof value !== "string" || value.length > 2000) return "/my-businesses";
  try {
    const decoded = decodeURIComponent(value);
    if (!decoded.startsWith("/") || decoded.startsWith("//") || /[\\\x00-\x1f]/.test(decoded)) return "/my-businesses";
    const url = new URL(value, "https://business-collab.invalid");
    if (url.origin !== "https://business-collab.invalid") return "/my-businesses";
    return url.pathname + url.search;
  } catch { return "/my-businesses"; }
}
