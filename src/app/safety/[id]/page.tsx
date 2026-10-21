import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/current-user";
import { getDb } from "@/lib/db";
import { founderId, teamIds } from "@/lib/safety-access";
import { CaseFollowUp } from "@/components/safety-forms";
async function Details({ params }: PageProps<"/safety/[id]">) {
 const { id } = await params; const user = await requireUser(`/safety/${id}`); const db = getDb();
 const record = await db.safetyCase.findUnique({ where: { id }, include: { reporter: { select: { name: true } }, assignee: { select: { name: true } } } });
 const founder = user.id === founderId(), staff = founder || (teamIds().includes(user.id) && record?.assigneeId === user.id);
 if (!record || (!staff && record.reporterId !== user.id)) notFound();
 const [team, subjects, audits, overdue] = await Promise.all([
  founder ? db.user.findMany({ where: { id: { in: teamIds() } }, select: { id: true, name: true } }) : [],
  founder ? db.user.findMany({ where: { businesses: { some: { OR: [...(record.targetBusinessId ? [{ id: record.targetBusinessId }] : []), ...(record.collaborationId ? [{ organizedCollaborations: { some: { id: record.collaborationId } } }, { collaborationEntries: { some: { collaborationId: record.collaborationId } } }] : [])] } } }, select: { id: true, name: true } }) : [],
  staff ? db.safetyAudit.findMany({ where: { caseId: id }, orderBy: { createdAt: "desc" }, take: 200, include: { actor: { select: { name: true } } } }) : [],
  staff && record.eventKey?.startsWith("overdue:") ? db.activityAttendee.findUnique({ where: { id: record.eventKey.slice(8) }, include: { user: { select: { name: true } }, version: true } }) : null,
 ]);
 if (staff && !await db.safetyAudit.findFirst({ where: { caseId: id, actorId: user.id, action: "VIEWED", createdAt: { gte: new Date(new Date().getTime() - 300000) } }, select: { id: true } })) await db.safetyAudit.create({ data: { caseId: id, actorId: user.id, action: "VIEWED", note: "Sensitive case accessed." } });
 return <div className="space-y-5"><Link href="/safety">Safety inbox</Link><h1>Private safety case</h1><p>{record.priority} · {record.status}</p><section className="panel"><h2>Report</h2><p className="mt-3 whitespace-pre-wrap break-words">{record.detail}</p><p className="mt-3">Reported by {record.reporter?.name ?? "Automatic attendance check"}</p><p className="mt-2">{record.acknowledgedAt ? "Acknowledged by the founder" : "Awaiting founder acknowledgement"}{record.assignee ? ` · Assigned to ${record.assignee.name}` : ""}</p></section>
 {overdue && <section className="panel"><h2>Attendance details</h2><p>{overdue.user.name} · {overdue.version.title}</p><p className="mt-2 whitespace-pre-wrap break-words">{overdue.version.venue}</p><p className="mt-2">Expected finish: {overdue.version.endsAt.toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" })}</p><p className="mt-2">{overdue.checkedOutAt ? "A later check-out was recorded. Review before resolving." : "No check-out recorded."}</p></section>}
 {staff && <><section className="panel"><h2 className="mb-4">Follow-up</h2><CaseFollowUp id={id} founder={founder} status={record.status} team={team} subjects={subjects.filter(s => s.id !== founderId())} /></section><section className="panel"><h2>Case history</h2><ol className="mt-3 space-y-4">{audits.slice().reverse().map(a => <li key={a.id}><p className="text-sm">{a.action} · {a.actor?.name ?? "System"} · {a.createdAt.toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" })}</p><p className="whitespace-pre-wrap break-words">{a.note}</p></li>)}</ol></section></>}
 </div>;
}
export default function Page(props: PageProps<"/safety/[id]">) { return <main className="page max-w-3xl"><Suspense fallback={<p>Loading private case…</p>}><Details {...props} /></Suspense></main>; }
