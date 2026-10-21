import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/current-user";
import { getDb } from "@/lib/db";
import { MarkRead } from "@/components/chat-ui";
async function Notifications() {
 const user = await requireUser("/notifications"); const items = await getDb().notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 100 });
 return <div className="space-y-5"><h1>Notifications</h1><p>Messages and collaboration updates appear here. Phone push notifications are not enabled yet.</p><MarkRead /><ul className="space-y-3">{items.map(n => <li key={n.id} className="panel"><Link href={n.href}>{n.title}{!n.readAt ? " · Unread" : ""}</Link><p className="mt-2 text-sm">{n.createdAt.toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" })}</p></li>)}</ul>{!items.length && <p>No notifications yet.</p>}<p className="text-sm">Showing the latest 100 notifications.</p></div>;
}
export default function Page() { return <main className="page max-w-3xl"><Suspense fallback={<p>Loading notifications…</p>}><Notifications /></Suspense></main>; }
