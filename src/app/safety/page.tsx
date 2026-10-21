import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/current-user";
import { getDb } from "@/lib/db";
import { safetyEmailConfigured } from "@/lib/safety-email";
import { founderId, teamIds } from "@/lib/safety-access";
async function Safety() {
 const user = await requireUser("/safety"); const founder = user.id === founderId(), team = teamIds().includes(user.id);
 const pendingEmails=founder?await getDb().safetyEmail.count({where:{sentAt:null,safetyCase:{acknowledgedAt:null,resolvedAt:null}}}):0;
 const reports = await getDb().safetyCase.findMany({ where: founder ? {} : team ? { OR: [{ assigneeId: user.id }, { reporterId: user.id }] } : { reporterId: user.id }, select: { id: true, status: true, priority: true, kind: true, reporterId: true, assigneeId: true, founderNotifiedAt: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 100 });
 return <div className="space-y-5"><h1>{founder ? "Founder safety inbox" : "Safety reports"}</h1><p>Reports go first to the founder for acknowledgement. Only then can the founder assign follow-up to an authorised team member. In-app notifications do not confirm that a person has read a case.</p><p className="panel">Safety emails require configured delivery and scheduled checks; they do not confirm that anyone has read or acted on a case. There is no 24-hour emergency response service. For immediate danger, seek emergency assistance directly.</p><Link href="/identity">Your identity-check status</Link>{founder && <p className="text-sm">Email delivery: {safetyEmailConfigured() ? "configured; requires scheduled checks" : "not enabled"}. Pending email notices: {pendingEmails}. Authorised team accounts: {teamIds().length}. Only you can see all cases or restrict accounts.</p>}<ul className="space-y-3">{reports.map(r => <li key={r.id} className="panel"><Link href={`/safety/${r.id}`}>{r.kind === "OVERDUE_CHECKOUT" ? "Overdue check-out" : "Safety concern"} · {r.priority} · {r.status}</Link><p className="mt-2 text-sm">{r.createdAt.toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" })}{r.founderNotifiedAt ? " · Founder inbox notified" : " · Awaiting founder inbox notification"}</p></li>)}</ul>{!reports.length && <p>No safety cases to show.</p>}<p className="text-sm">Showing the latest 100 cases. Open a collaboration, activity or business profile to report a concern.</p></div>;
}
export default function Page() { return <main className="page max-w-3xl"><Suspense fallback={<p>Loading safety inbox…</p>}><Safety /></Suspense></main>; }
