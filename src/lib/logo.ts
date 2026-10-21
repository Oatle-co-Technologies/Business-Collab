import sharp from "sharp";

export const MAX_LOGO_BYTES = 2 * 1024 * 1024;

export async function prepareLogo(file: File, maxEdge = 512): Promise<Uint8Array<ArrayBuffer>> {
  if (file.size > MAX_LOGO_BYTES) throw new Error("Choose an image smaller than 2 MB.");
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Choose a JPG, PNG or WebP image.");
  }
  try {
    const input = Buffer.from(await file.arrayBuffer());
    const image = sharp(input, { limitInputPixels: 25_000_000 });
    const metadata = await image.metadata();
    if (!["jpeg", "png", "webp"].includes(metadata.format ?? "") || (metadata.pages ?? 1) > 1) {
      throw new Error("Unsupported image");
    }
    return new Uint8Array(await image.rotate()
      .resize(maxEdge, maxEdge, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 85 }).toBuffer());
  } catch {
    throw new Error("This image could not be read. Choose a valid, still JPG, PNG or WebP image.");
  }
}
