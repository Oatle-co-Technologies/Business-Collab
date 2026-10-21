"use client";

import { useActionState, useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { SUGGESTED_DISCOVERY_AREA } from "@/lib/discovery";
import { upload } from "@vercel/blob/client";
import { beginMediaUpload, finalizeMediaUpload } from "@/app/media-actions";
import { saveBusiness } from "@/app/actions";
import { missingProfileContent, type MediaSummary } from "@/lib/profile-content";
import { ProfileMedia } from "@/components/profile-media";
import type { ProfileState } from "@/lib/business-validation";

type BusinessValues = {
  id: string; name: string; description: string; location: string; discoveryArea: string; industry: string; categories: string[];
  email: string; phone: string; website: string | null; portfolio: string | null; hasLogo: boolean; updatedAt: string; published: boolean; media: MediaSummary[];
};

export function BusinessForm({ business, hostedUploads = false }: { business?: BusinessValues; hostedUploads?: boolean }) {
  const completedUploads = useRef<Record<string, { file: File; id: string }>>({});
  const [uploadProgress, setUploadProgress] = useState("");
  const [uploads, setUploads] = useState<Record<string, File | undefined>>({});
  const savedPhotos = business?.media.filter(item => item.kind === "PHOTO") ?? [];
  const [state, action, pending] = useActionState<ProfileState, FormData>(
    async (previous, form) => {
      for (const name of ["logo", "introduction", "showcase", "photos"]) { form.delete(name); form.delete(`asset:${name}`); }
      async function addFile(slot: string, name: string, kind: string) {
        const file = uploads[slot]; if (!file) return;
        if (!hostedUploads) { form.append(name, file); return; }
        if (completedUploads.current[slot]?.file !== file) {
          setUploadProgress(`Uploading ${file.name}…`);
          const ticket = await beginMediaUpload(business?.id ?? null, kind);
          await upload(ticket.pathname, file, { access: "private", handleUploadUrl: "/api/media/upload", clientPayload: JSON.stringify({ ticketId: ticket.id }), contentType: file.type, onUploadProgress: ({ percentage }) => setUploadProgress(`Uploading ${file.name}: ${Math.round(percentage)}%`) });
          setUploadProgress(`Checking ${file.name}…`);
          await finalizeMediaUpload(ticket.id);
          completedUploads.current[slot] = { file, id: ticket.id };
        }
        form.append(`asset:${name}`, completedUploads.current[slot].id);
      }
      try {
      for (const [name, kind] of [["logo", "LOGO"], ["introduction", "INTRODUCTION"], ["showcase", "SHOWCASE"]]) await addFile(name, name, kind);
      let photoIndex = 0;
      for (let slot = 0; slot < 5; slot++) {
        if (!uploads[`photo:${slot}`]) continue;
        await addFile(`photo:${slot}`, "photos", "PHOTO");
        form.set(`newCaption:${photoIndex++}`, String(form.get(`slotCaption:${slot}`) ?? ""));
      }
      setUploadProgress("Saving profile…");
      return saveBusiness(business?.id ?? null, previous, form);
      } catch { return { values: Object.fromEntries(Array.from(form.entries()).filter((entry): entry is [string, string] => typeof entry[1] === "string")), error: "Your profile could not be saved. Check your connection and upload settings, then try again. Selected files are kept in this form." }; }
      finally { setUploadProgress(""); }
    }, {},
  );
  const chooseUpload = (name: string, file?: File) => setUploads(current => ({ ...current, [name]: file }));
  const uploadStatus = (name: string, saved: boolean) => uploads[name]
    ? `Selected: ${uploads[name]!.name} — not saved yet`
    : saved ? "Saved" : "No file added yet";
  const missing = missingProfileContent(business?.hasLogo ?? false, business?.media.map(item => item.kind) ?? []);
  const fields = [
    { name: "name", label: "Business name", required: true, maxLength: 120 },
    { name: "location", label: "Town or city", required: true, maxLength: 160 },
    { name: "discoveryArea", label: "Discovery area", required: true, maxLength: 160, hint: "Choose the same area name as nearby businesses. Pretoria, Centurion and Johannesburg can share one area. Your town stays separate." },
    { name: "industry", label: "Industry (optional)", maxLength: 80, hint: "For example: Food and catering, Beauty, Construction or Creative services." },
    { name: "categories", label: "Service categories", required: true, maxLength: 500, hint: "Separate categories with commas, for example: Baking, Catering" },
    { name: "email", label: "Business email", type: "email", required: true, maxLength: 254 },
    { name: "phone", label: "Business phone", type: "tel", required: true, maxLength: 30 },
    { name: "website", label: "Website (optional)", type: "url", maxLength: 2048 },
    { name: "portfolio", label: "Portfolio link (optional)", type: "url", maxLength: 2048 },
  ] as const;
  return (
    <form action={action} className="space-y-6">
      <fieldset disabled={pending} className="space-y-6">
      <section className="panel">
        <h2>Profile content</h2>
        <p className="mt-2 text-sm text-neutral-600">To publish, add your profile picture or logo, both videos and 2–5 pictures showing your work. Save a draft while you prepare them.</p>
        <ul className="mt-3 list-inside list-disc text-sm">{missing.map(item => <li key={item}>Still needed: {item}</li>)}</ul>
        {missing.length === 0 && <p className="mt-3 text-sm" role="status">All required profile media are saved. Ready to publish.</p>}
        <p className="mt-2 text-sm text-neutral-600">Selected files stay here if you need to fix a field. Save draft to store your uploads, or Publish profile to save everything and publish together.</p>
      </section>
      {state.error && <p role="alert" className="error">{state.error}</p>}
      <div>
        <label htmlFor="logo">Profile picture or business logo</label>
        {business?.hasLogo && <Image src={`/businesses/${business.id}/logo?v=${encodeURIComponent(business.updatedAt)}`}
          alt={`${business.name} profile picture or logo`} width={96} height={96} unoptimized
          className="mb-3 h-24 w-24 rounded-md border border-neutral-200 bg-white object-contain" />}
        <input id="logo" name="logo" type="file" accept="image/jpeg,image/png,image/webp"
          onChange={event => chooseUpload("logo", event.currentTarget.files?.[0])} aria-invalid={!!state.errors?.logo} aria-describedby="logo-hint logo-error" />
        <p role="status" className="mt-2 text-sm">{uploadStatus("logo", business?.hasLogo ?? false)}</p>
        <p id="logo-hint" className="mt-1 text-sm text-neutral-600">One JPG, PNG or WebP image, up to 2 MB. Choose a new image to replace the current one.</p>
        <p id="logo-error" className="error" role={state.errors?.logo ? "alert" : undefined}>{state.errors?.logo?.[0]}</p>
      </div>
      {business && <ProfileMedia businessId={business.id} media={business.media} />}
      {([{ name: "introduction", label: "Introduction video", hint: "Tell us your name, your business, where you work and the services you offer. Speak in your own words." },
        { name: "showcase", label: "Work showcase video", hint: "Show yourself doing the work. Explain what you are doing, your role and the finished result. Use your own footage and avoid showing clients without their permission." }] as const).map(slot => <div key={slot.name}>
        <label htmlFor={slot.name}>{slot.label}</label>
        <input id={slot.name} name={slot.name} type="file" onChange={event => chooseUpload(slot.name, event.currentTarget.files?.[0])} accept="video/mp4,video/webm" aria-invalid={!!state.errors?.[slot.name]} aria-describedby={`${slot.name}-hint ${slot.name}-error`} />
        <p role="status" className="mt-2 text-sm">{uploadStatus(slot.name, !!business?.media.some(item => item.kind === (slot.name === "introduction" ? "INTRODUCTION" : "SHOWCASE")))}</p>
        <p id={`${slot.name}-hint`} className="mt-1 text-sm text-neutral-600">{slot.hint} One MP4 (H.264) or WebM (VP8/VP9), up to 2 minutes and 10 MB. A new upload replaces this video.</p>
        {state.errors?.[slot.name] && <p className="error" id={`${slot.name}-error`} role="alert">{state.errors[slot.name]?.[0]}</p>}
      </div>)}
      <div>
        <h2>Pictures of your work (2–5 required)</h2>
        <p className="mt-2 text-sm" role="status">{savedPhotos.length} of 5 pictures saved. {savedPhotos.length >= 2 ? "Minimum met." : `Add ${2 - savedPhotos.length} more before publishing.`}</p>
        <p id="photos-hint" className="mt-1 text-sm text-neutral-600">JPG, PNG or WebP, up to 2 MB each. Each place holds one picture. To replace saved pictures, mark them for removal and save draft first.</p>
        {state.errors?.photos && <p id="photos-error" className="error" role="alert">{state.errors.photos[0]}</p>}
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 5 - savedPhotos.length }, (_, index) => <div key={index} className="panel">
            <label htmlFor={`photo-${index}`}>Work picture {savedPhotos.length + index + 1}{savedPhotos.length + index < 2 ? " (required to publish)" : " (optional)"}</label>
            <input id={`photo-${index}`} type="file" accept="image/jpeg,image/png,image/webp" aria-describedby="photos-hint photos-error" onChange={event => chooseUpload(`photo:${index}`, event.currentTarget.files?.[0])} />
            <p role="status" className="mt-2 break-words text-sm">{uploadStatus(`photo:${index}`, false)}</p>
            {uploads[`photo:${index}`] && <>
              <button type="button" className="mt-2" onClick={() => chooseUpload(`photo:${index}`)}>Clear selection</button>
              <label htmlFor={`slotCaption-${index}`} className="mt-3">Caption (optional)</label>
              <textarea id={`slotCaption-${index}`} name={`slotCaption:${index}`} rows={2} maxLength={500} />
            </>}
          </div>)}
        </div>
        {business?.media.filter(item => item.kind === "PHOTO").map((item, index) => <div key={item.id} className="panel mt-4">
          <Image src={`/businesses/${business.id}/media/${item.id}`} alt={`Work picture ${index + 1}`} width={160} height={120} unoptimized className="mb-3 h-24 w-32 rounded object-contain" />
          <p className="mb-2 text-sm">Work picture {index + 1} · Saved</p>
          <label htmlFor={`caption-${item.id}`}>Caption for work picture {index + 1}</label>
          <textarea id={`caption-${item.id}`} name={`caption:${item.id}`} rows={2} maxLength={500}
            placeholder="Describe the service delivered and your role in this work."
            defaultValue={state.values?.[`caption:${item.id}`] ?? item.caption ?? ""} />
          <label className="mt-3 flex items-center gap-2">
            <input className="w-auto" type="checkbox" name="removePhotos" value={item.id} /> Remove work picture {index + 1}
          </label>
        </div>)}
      </div>
      <div>
        <label htmlFor="description">About the business</label>
        <textarea id="description" name="description" rows={4} required minLength={10} maxLength={2000}
          defaultValue={state.values?.description ?? business?.description ?? ""} aria-invalid={!!state.errors?.description}
          aria-describedby={state.errors?.description ? "description-error" : undefined} />
      {state.errors?.description && <p id="description-error" className="error" role="alert">{state.errors.description[0]}</p>}
      </div>
      {fields.map(field => {
        const value = state.values?.[field.name] ?? business?.[field.name];
        const error = state.errors?.[field.name]?.[0];
        return <div key={field.name}>
          <label htmlFor={field.name}>{field.label}</label>
          <input id={field.name} name={field.name} type={"type" in field ? field.type : "text"}
            required={"required" in field && field.required} maxLength={field.maxLength} list={field.name === "discoveryArea" ? "discovery-areas" : undefined}
            defaultValue={Array.isArray(value) ? value.join(", ") : value ?? ""}
            aria-invalid={!!error}
            aria-describedby={["hint" in field ? `${field.name}-hint` : "", error ? `${field.name}-error` : ""].filter(Boolean).join(" ") || undefined} />
          {"hint" in field && <p id={`${field.name}-hint`} className="mt-1 text-sm text-neutral-600">{field.hint}</p>}
          {error && <p id={`${field.name}-error`} className="error" role="alert">{error}</p>}
        </div>;
      })}
      <datalist id="discovery-areas"><option value={SUGGESTED_DISCOVERY_AREA} /></datalist>
      <div className="flex flex-wrap items-center gap-5">
        <button type="submit" name="intent" value="draft" disabled={pending}>{pending ? "Saving…" : "Save draft"}</button>
        <button type="submit" name="intent" value="publish" disabled={pending}>{pending ? "Saving…" : business?.published ? "Update published profile" : "Publish profile"}</button>
        <Link href={business ? `/businesses/${business.id}` : "/"}>Cancel</Link>
      </div>
      {pending && <p role="status">{uploadProgress || "Saving your profile and uploads… Please keep this page open."}</p>}
      </fieldset>
    </form>
  );
}
