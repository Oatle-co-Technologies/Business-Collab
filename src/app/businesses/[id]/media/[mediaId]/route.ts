import { getCurrentUser } from "@/lib/current-user";
import { streamPrivateMedia } from "@/lib/media-storage";
import { getDb } from "@/lib/db";
import { readByteRange } from "@/lib/profile-content";

export async function GET(request: Request, { params }: { params: Promise<{ id: string; mediaId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response(null, { status: 401 });
  const { id, mediaId } = await params;
  const media = await getDb().businessMedia.findFirst({ where: { id: mediaId, businessId: id, business: { OR: [{ ownerId: user.id }, { published: true, ownerId: { not: null } }] } } });
  if (!media) return new Response(null, { status: 404 });
  if (media.storagePath && media.byteSize) return streamPrivateMedia(media.storagePath, media.contentType, media.byteSize, request);
  if (!media.data) return new Response(null, { status: 404 });
  const bytes = new Uint8Array(media.data);
  const headers = { "Content-Type": media.contentType, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Accept-Ranges": "bytes" };
  const rangeHeader = request.headers.get("range");
  if (rangeHeader) {
    const range = readByteRange(rangeHeader, bytes.length);
    if (!range) return new Response(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${bytes.length}` } });
    const { start, end } = range;
    return new Response(bytes.slice(start, end + 1), { status: 206, headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${bytes.length}`, "Content-Length": String(end - start + 1) } });
  }
  return new Response(bytes, { headers: { ...headers, "Content-Length": String(bytes.length) } });
}
