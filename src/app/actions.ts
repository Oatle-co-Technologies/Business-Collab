"use server";

import { getCurrentUser } from "@/lib/current-user";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prepareLogo } from "@/lib/logo";
import { prepareVideo } from "@/lib/video";
import { missingProfileContent } from "@/lib/profile-content";
import { getDb } from "@/lib/db";
import { businessSchema, workCaptionSchema, type ProfileState } from "@/lib/business-validation";

import { requireIdentity } from "@/lib/safety-access";

import { hostedMedia } from "@/lib/media-storage";
import { usableUpload } from "@/lib/media-upload-rules";

type Upload = { storagePath?: string | null; byteSize?: number | null; caption?: string | null; kind: "INTRODUCTION" | "SHOWCASE" | "PHOTO"; contentType: string; data: Uint8Array<ArrayBuffer> | null };
class ContentError extends Error {}

export async function saveBusiness(id: string | null, _state: ProfileState, formData: FormData): Promise<ProfileState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Please sign in before saving a business profile." };
  if (id && !await getDb().business.findFirst({ where: { id, ownerId: user.id }, select: { id: true } })) {
    return { error: "You do not have access to edit this business." };
  }
  const values = Object.fromEntries(
    ["name", "description", "location", "discoveryArea", "industry", "categories", "email", "phone", "website", "portfolio"]
      .map(key => [key, String(formData.get(key) ?? "").trim()]),
  );
  for (const [key, value] of formData.entries()) {
    if ((key.startsWith("caption:") || key.startsWith("newCaption:")) && typeof value === "string") values[key] = value;
  }
  const files = (name: string) => formData.getAll(name).filter((value): value is File => value instanceof File && value.size > 0);
  const hasFiles = ["logo", "introduction", "showcase", "photos"].some(key => files(key).length || formData.getAll(`asset:${key}`).length);
  const reselect = hasFiles ? "Your selected files are kept in the form. Fix the issue below and save again." : "";
  const result = businessSchema.safeParse(values);
  if (!result.success) return { errors: result.error.flatten().fieldErrors, values, error: reselect };
  const intent = formData.get("intent");
  if (intent !== "draft" && intent !== "publish") return { values, error: "Choose Save draft or Publish profile." };
  if (intent === "publish") {
    try { await requireIdentity(getDb(), user.id); } catch (error) { return { values, error: (error as Error).message }; }
  }
  let logo: Uint8Array<ArrayBuffer> | undefined;
  let logoPath: string | undefined;
  const assets: { id: string; kind: string }[] = [];
  const uploads: Upload[] = [];
  const errors: Record<string, string[]> = {};
  for (const name of ["logo", "introduction", "showcase", "photos"]) {
    const entries = files(name);
    const refs = formData.getAll(`asset:${name}`).map(String);
    if (entries.length && hostedMedia()) { errors[name] = ["Use the secure upload form to add files on the hosted app."]; continue; }
    if (refs.length && !hostedMedia()) { errors[name] = ["Hosted media storage is not enabled."]; continue; }
    if (refs.length + entries.length > (name === "photos" ? 5 : 1)) { errors[name] = ["Too many files for this slot."]; continue; }
    try {
      for (const [index, assetId] of refs.entries()) {
        const kind = { logo: "LOGO", introduction: "INTRODUCTION", showcase: "SHOWCASE", photos: "PHOTO" }[name]!;
        const asset = await getDb().mediaUpload.findUnique({ where: { id: assetId } });
        if (!usableUpload(asset, user.id, id, kind) || !asset?.storagePath || !asset.contentType || !asset.byteSize) throw new Error("This upload is unavailable or expired. Choose the file again.");
        if (assets.some(a => a.id === asset.id)) throw new Error("Choose a different file for each media slot.");
        assets.push({ id: asset.id, kind });
        if (name === "logo") logoPath = asset.storagePath;
        else {
          const caption = workCaptionSchema.safeParse(formData.get(`newCaption:${index}`) ?? "");
          if (!caption.success) throw new Error(caption.error.issues[0].message);
          uploads.push({ kind: kind as "PHOTO" | "INTRODUCTION" | "SHOWCASE", contentType: asset.contentType, data: null, storagePath: asset.storagePath, byteSize: asset.byteSize, ...(kind === "PHOTO" ? { caption: caption.data || null } : {}) });
        }
      }
    } catch (error) { errors[name] = [(error as Error).message]; }

    if (entries.length > (name === "photos" ? 5 : 1)) { errors[name] = [name === "photos" ? "Choose no more than five work pictures." : "Choose one file for this slot."]; continue; }
    try {
      for (const [index, file] of entries.entries()) {
        if (name === "logo") logo = await prepareLogo(file);
        else if (name === "photos") {
          const caption = workCaptionSchema.safeParse(formData.get(`newCaption:${index}`) ?? "");
          if (!caption.success) throw new Error(caption.error.issues[0].message);
          uploads.push({ kind: "PHOTO", caption: caption.data || null, contentType: "image/webp", data: await prepareLogo(file, 1200) });
        }
        else uploads.push({ kind: name === "introduction" ? "INTRODUCTION" : "SHOWCASE", ...await prepareVideo(file) });
      }
    } catch (error) { errors[name] = [error instanceof Error ? error.message : "This upload could not be processed."]; }
  }
  if (Object.keys(errors).length) return { values, errors, error: reselect };
  const removed = formData.getAll("removePhotos").filter((value): value is string => typeof value === "string");
  let businessId: string;
  try {
    const db = getDb();
    businessId = await db.$transaction(async tx => {
      const previous = id ? await tx.business.findFirst({ where: { id, ownerId: user.id }, include: { media: { select: { id: true, kind: true, position: true } } } }) : null;
      if (id && !previous) throw new ContentError("You do not have access to edit this business.");
      for (const asset of assets) {
        const ticket = await tx.mediaUpload.findUnique({ where: { id: asset.id } });
        if (!usableUpload(ticket, user.id, id, asset.kind)) throw new ContentError("The upload changed or expired. Please select it again.");
        const claimed = await tx.mediaUpload.updateMany({ where: { id: asset.id, userId: user.id, consumedAt: null, state: "READY", expiresAt: { gt: new Date() } }, data: { consumedAt: new Date(), state: "ATTACHED" } });
        if (!claimed.count) throw new ContentError("This upload was already used. Choose the file again.");
      }
      const remaining = (previous?.media ?? []).filter(item => item.kind !== "PHOTO" || !removed.includes(item.id));
      const photos = remaining.filter(item => item.kind === "PHOTO");
      const newPhotos = uploads.filter(item => item.kind === "PHOTO");
      if (photos.length + newPhotos.length > 5) throw new ContentError("Keep a maximum of five work pictures. Remove an existing picture before adding another.");
      const missing = missingProfileContent(!!(logo || logoPath || previous?.logo || previous?.logoPath), [...remaining.map(item => item.kind), ...uploads.map(item => item.kind)]);
      if (intent === "publish" && missing.length) throw new ContentError(`Before publishing, add ${missing.join(", ")}.`);
      if (intent === "publish") await requireIdentity(tx, user.id);
      const data = { ...result.data, published: intent === "publish", ...(logo ? { logo, logoPath: null } : logoPath ? { logo: null, logoPath } : {}) };
      const business = id ? await tx.business.update({ where: { id, ownerId: user.id }, data }) : await tx.business.create({ data: { ...data, ownerId: user.id } });
      await tx.businessMedia.deleteMany({ where: { businessId: business.id, kind: "PHOTO", id: { in: removed } } });
      for (const photo of photos) {
        const key = `caption:${photo.id}`;
        if (!formData.has(key)) continue;
        const caption = workCaptionSchema.safeParse(formData.get(key));
        if (!caption.success) throw new ContentError(caption.error.issues[0].message);
        await tx.businessMedia.update({ where: { id: photo.id }, data: { caption: caption.data || null } });
      }
      const used = new Set(photos.map(item => item.position));
      for (const upload of uploads) {
        let position = 0;
        if (upload.kind === "PHOTO") { while (used.has(position)) position++; used.add(position); }
        const key = { businessId: business.id, kind: upload.kind, position };
        await tx.businessMedia.upsert({ where: { businessId_kind_position: key }, create: { ...key, ...upload }, update: { contentType: upload.contentType, data: upload.data, storagePath: upload.storagePath ?? null, byteSize: upload.byteSize ?? upload.data?.byteLength ?? null, ...(upload.kind === "PHOTO" ? { caption: upload.caption } : {}) } });
      }
      return business.id;
    }, { isolationLevel: "Serializable", timeout: 15_000 });
  } catch (error) {
    return { values, error: `${error instanceof ContentError ? error.message : "We could not save this profile. Please try again."} ${reselect}`.trim() };
  }
  revalidatePath("/");
  revalidatePath("/my-businesses");
  revalidatePath(`/businesses/${businessId}`);
  redirect(intent === "draft" ? `/businesses/${businessId}/edit?saved=1` : `/businesses/${businessId}?saved=1`);
}
