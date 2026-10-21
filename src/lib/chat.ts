import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
export type ChatDb = Prisma.TransactionClient;
export async function chatAccess(db: ChatDb, id: string, userId: string) {
  const chat = await db.conversation.findUnique({ where: { id }, include: { participation: { include: { business: { select: { id: true, ownerId: true, name: true, published: true } }, collaboration: { include: { organizer: { select: { id: true, ownerId: true, name: true, published: true } } } } } }, collaboration: { include: { organizer: { select: { id: true, ownerId: true, name: true, published: true } }, participants: { where: { status: "SELECTED" }, include: { business: { select: { id: true, ownerId: true, name: true, published: true } } } } } } } });
  if (!chat) return null;
  const entry = chat.participation;
  if (!chat.collaborationId && (!entry || entry.source !== "INVITATION" || !["INTERESTED", "SELECTED"].includes(entry.status))) return null;
  const businesses = chat.collaboration ? [chat.collaboration.organizer, ...chat.collaboration.participants.map(p => p.business)] : [entry!.collaboration.organizer, entry!.business];
  const own = businesses.filter(b => b.ownerId === userId);
  return own.length ? { chat, businesses, own } : null;
}
export async function blocked(db: ChatDb, a: string, b: string) {
  return !!await db.chatBlock.findFirst({ where: { OR: [{ blockerId: a, blockedId: b }, { blockerId: b, blockedId: a }] } });
}
export async function notify(db: ChatDb, users: (string | null)[], title: string, href: string) {
  const ids = [...new Set(users.filter((id): id is string => !!id))];
  if (ids.length) await db.notification.createMany({ data: ids.map(userId => ({ userId, title, href })) });
}
export function chatInboxWhere(userId: string): Prisma.ConversationWhereInput {
  return { OR: [
    { participation: { source: "INVITATION", status: { in: ["INTERESTED", "SELECTED"] }, OR: [{ business: { ownerId: userId } }, { collaboration: { organizer: { ownerId: userId } } }] } },
    { collaboration: { OR: [{ organizer: { ownerId: userId } }, { participants: { some: { status: "SELECTED", business: { ownerId: userId } } } }] } }
  ] };
}
export async function inbox(userId: string) {
  return getDb().conversation.findMany({ where: chatInboxWhere(userId), include: { collaboration: { select: { title: true } }, participation: { select: { collaboration: { select: { title: true } } } }, reads: { where: { userId } }, messages: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true, sender: { select: { ownerId: true } } } } }, orderBy: { updatedAt: "desc" }, take: 100 });
}
