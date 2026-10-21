import { getCurrentUser } from "@/lib/current-user";
import { streamPrivateMedia } from "@/lib/media-storage";
import { getDb } from "@/lib/db";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response(null, { status: 401 });
  const { id } = await params;
  const business = await getDb().business.findFirst({ where: { id, OR: [{ ownerId: user.id }, { published: true, ownerId: { not: null } }] }, select: { logo: true, logoPath: true } });
  if (business?.logoPath) {
    return streamPrivateMedia(business.logoPath, "image/webp", 0);
  }
  if (!business?.logo) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(business.logo), {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
