import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/current-user";
import { getDb } from "@/lib/db";
import { SafetyReportForm } from "@/components/safety-forms";
async function Report({ searchParams }: PageProps<"/safety/report">) {
 await requireUser("/safety/report"); const query = await searchParams;
 const business = typeof query.business === "string" ? await getDb().business.findFirst({ where: { id: query.business, published: true, ownerId: { not: null } }, select: { id: true, name: true } }) : null;
 if (!business) notFound();
 return <><h1>Report a safety concern</h1><p className="my-4">Business: {business.name}</p><SafetyReportForm businessId={business.id} /></>;
}
export default function Page(props: PageProps<"/safety/report">) { return <main className="page max-w-3xl"><Suspense fallback={<p>Loading report form…</p>}><Report {...props} /></Suspense></main>; }
