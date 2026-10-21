import { Suspense } from "react";
import { requireUser } from "@/lib/current-user";
import { hostedMedia } from "@/lib/media-storage";
import { BusinessForm } from "@/components/business-form";

async function NewBusinessForm() {
  await requireUser("/businesses/new");
  return <BusinessForm hostedUploads={hostedMedia()} />;
}

export default function NewBusinessPage() {
  return <main className="page max-w-2xl"><h1>Add your business</h1>
    <p className="mb-8 mt-2 text-neutral-600">Share your business details and the services you offer.</p>
    <Suspense fallback={<p role="status">Loading your profile form…</p>}><NewBusinessForm /></Suspense>
  </main>;
}
