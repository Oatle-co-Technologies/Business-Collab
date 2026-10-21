import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/current-user";
import { inbox, chatAccess } from "@/lib/chat";
import { getDb } from "@/lib/db";
async function Messages() {
 const user = await requireUser("/messages"); const chats = await inbox(user.id);
 const entries = await Promise.all(chats.map(async c => ({ c, access: await chatAccess(getDb(), c.id, user.id) })));
 return <><h1>Messages</h1><p className="my-4">Messaging is available within collaborations after an invited business confirms interest. Selected teams can also use project chats. Updates appear about every 10 seconds while this page is open.</p><ul className="space-y-4">{entries.map(({ c, access }) => {
  if (!access) return null;
  const last = c.messages[0]; const unread = last && last.sender.ownerId !== user.id && (!c.reads[0] || last.createdAt > c.reads[0].readAt);
  return <li className="panel" key={c.id}><Link href={`/messages/${c.id}`}>{c.collaboration?.title ?? c.participation?.collaboration.title ?? access.businesses.map(b => b.name).join(" ↔ ")}{unread ? " · Unread" : ""}</Link><p className="mt-2 text-sm">{c.collaborationId ? "Project group chat" : "Private conversation about an invited role"}</p></li>;
 })}</ul>{!chats.length && <p>No conversations yet.</p>}</>;
}
export default function Page() { return <main className="page max-w-3xl"><Suspense fallback={<p>Loading messages…</p>}><Messages /></Suspense></main>; }
