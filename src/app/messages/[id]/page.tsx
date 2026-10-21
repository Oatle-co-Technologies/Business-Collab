import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/current-user";
import { getDb } from "@/lib/db";
import { chatAccess, blocked } from "@/lib/chat";
import { Composer, MarkRead, BlockControl, ReportControl } from "@/components/chat-ui";
async function Conversation({ params, searchParams }: PageProps<"/messages/[id]">) {
 const { id } = await params; const user = await requireUser(`/messages/${id}`); const db = getDb(); const access = await chatAccess(db, id, user.id); if (!access) notFound();
 const before = String((await searchParams).before ?? "");
 const cursor = before ? await db.chatMessage.findFirst({ where: { id: before, conversationId: id }, select: { id: true } }) : null;
 const batch = await db.chatMessage.findMany({ where: { conversationId: id }, ...(cursor ? { cursor, skip: 1 } : {}), orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 51, include: { sender: { select: { name: true, ownerId: true } } } });
 const messages = batch.slice(0, 50).reverse();
 const other = access.businesses.find(b => b.ownerId !== user.id)?.ownerId;
 const isBlocked = !access.chat.collaborationId && !!other && await blocked(db, user.id, other);
 const ownBlock = !!other && !!await db.chatBlock.findUnique({ where: { blockerId_blockedId: { blockerId: user.id, blockedId: other } } });
 return <div className="space-y-5"><Link href="/messages">All messages</Link><h1>{access.chat.collaboration?.title ?? access.chat.participation?.collaboration.title ?? "Collaboration conversation"}</h1><p>{access.businesses.map(b => b.name).join(" · ")}</p>{access.chat.collaborationId && <p>Only the organiser and currently selected collaborators can read this chat. New selected collaborators can see its history. <Link href={`/collaborations/${access.chat.collaborationId}`}>View collaboration</Link></p>}{access.chat.participation && <p><Link href={`/collaborations/${access.chat.participation.collaborationId}`}>View invited role</Link></p>}<MarkRead id={id} />
 {batch.length > 50 && <Link href={`/messages/${id}?before=${messages[0].id}`}>Older messages</Link>}{before && <Link href={`/messages/${id}`}>Latest messages</Link>}
 <ol className="space-y-3" aria-label="Conversation messages">{messages.map(m => <li key={m.id} className={`panel ${m.sender.ownerId === user.id ? "bg-neutral-100" : ""}`}><p className="text-sm font-semibold">{m.sender.name} · <time dateTime={m.createdAt.toISOString()}>{m.createdAt.toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" })}</time></p><p className="mt-2 whitespace-pre-wrap break-words">{m.body}</p></li>)}</ol>{!messages.length && <p>No messages yet. Say hello.</p>}
 {isBlocked ? <p>Private messaging is blocked between these accounts.</p> : <Composer id={id} businesses={access.own.filter(b => b.published)} />}
 {!access.chat.collaborationId && <BlockControl id={id} ownBlock={ownBlock} />}
 {messages.some(m => m.sender.ownerId !== user.id) && <ReportControl id={id} messages={messages.filter(m => m.sender.ownerId !== user.id).map(m => ({ id: m.id, label: `${m.sender.name}: ${m.body.slice(0, 80)}` }))} />}</div>;
}
export default function Page(props: PageProps<"/messages/[id]">) { return <main className="page max-w-3xl"><Suspense fallback={<p>Loading conversation…</p>}><Conversation {...props} /></Suspense></main>; }
