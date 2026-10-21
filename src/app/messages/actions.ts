"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { chatAccess, blocked, notify } from "@/lib/chat";
export type ChatState = { error?: string; success?: string };
import { notifyFounder } from "@/lib/safety-sweep";
import { founderId } from "@/lib/safety-access";
import { requireIdentity, IdentityRequired } from "@/lib/safety-access";

class ChatError extends Error {}
const fail = (e: unknown): ChatState => ({ error: e instanceof ChatError || e instanceof IdentityRequired ? e.message : "We could not save this change. Please try again." });
function refresh(id?: string) { revalidatePath("/messages"); revalidatePath("/notifications"); revalidatePath("/", "layout"); if (id) revalidatePath(`/messages/${id}`); }
export async function startChat(_state: ChatState, form: FormData): Promise<ChatState> {
  const user = await getCurrentUser(); if (!user) return { error: "Please sign in." };
  let id: string;
  try {
    id = await getDb().$transaction(async tx => {
      await requireIdentity(tx, user.id);
      const project = String(form.get("collaborationId") ?? "");
      if (project) {
        const request = await tx.collaboration.findFirst({ where: { id: project, OR: [{ organizer: { ownerId: user.id } }, { participants: { some: { status: "SELECTED", business: { ownerId: user.id } } } }] }, select: { id: true } });
        if (!request) throw new ChatError("Only the organiser and selected collaborators can enter the project chat.");
        return (await tx.conversation.upsert({ where: { collaborationId: project }, create: { collaborationId: project, businessIds: [] }, update: {} })).id;
      }
      const entry = await tx.collaborationParticipant.findUnique({ where: { id: String(form.get("entryId") ?? "") }, include: { business: { select: { id: true, ownerId: true, published: true } }, collaboration: { include: { organizer: { select: { id: true, ownerId: true, published: true } } } } } });
      if (!entry || entry.source !== "INVITATION" || !["INTERESTED", "SELECTED"].includes(entry.status)) throw new ChatError("Messaging opens only after an invited business confirms interest in the role.");
      const from = entry.collaboration.organizer;
      const to = entry.business;
      if (!from.ownerId || !to.ownerId || ![from.ownerId, to.ownerId].includes(user.id) || from.ownerId === to.ownerId) throw new ChatError("Only the organiser and invited applicant can use this conversation.");
      if (!from.published || !to.published) throw new ChatError("Both business profiles must be published to send messages.");
      if (await blocked(tx, from.ownerId, to.ownerId)) throw new ChatError("Messaging is unavailable between these accounts.");
      return (await tx.conversation.upsert({ where: { participationId: entry.id }, create: { participationId: entry.id, businessIds: [from.id, to.id] }, update: {} })).id;
    }, { isolationLevel: "Serializable" });
  } catch (e) { return fail(e); }
  refresh(id); redirect(`/messages/${id}`);
}
export async function sendMessage(id: string, _state: ChatState, form: FormData): Promise<ChatState> {
  const user = await getCurrentUser(); if (!user) return { error: "Please sign in." };
  const body = String(form.get("body") ?? "").trim();
  if (!body || body.length > 4000) return { error: "Write a message of 1–4,000 characters." };
  try {
    await getDb().$transaction(async tx => {
      await requireIdentity(tx, user.id);
      const access = await chatAccess(tx, id, user.id);
      const sender = access?.own.find(b => b.id === form.get("senderId") && b.published);
      if (!access || !sender) throw new ChatError("You cannot send as this business or access this conversation.");
      const recipients = [...new Set(access.businesses.map(b => b.ownerId).filter((owner): owner is string => !!owner && owner !== user.id))];
      if (!access.chat.collaborationId) {
        if (access.businesses.some(b => !b.published)) throw new ChatError("Both business profiles must be published to send messages.");
        for (const owner of recipients) if (await blocked(tx, user.id, owner)) throw new ChatError("Messaging is unavailable between these accounts.");
      }
      const recent = await tx.chatMessage.count({ where: { sender: { ownerId: user.id }, createdAt: { gte: new Date(Date.now() - 60_000) } } });
      if (recent >= 20) throw new ChatError("Please wait a moment before sending more messages.");
      const message = await tx.chatMessage.create({ data: { conversationId: id, senderId: sender.id, body } });
      await tx.conversation.update({ where: { id }, data: { updatedAt: message.createdAt } });
      await tx.chatRead.upsert({ where: { conversationId_userId: { conversationId: id, userId: user.id } }, create: { conversationId: id, userId: user.id, readAt: message.createdAt }, update: { readAt: message.createdAt } });
      await notify(tx, recipients, "New message in a business conversation", `/messages/${id}`);
    }, { isolationLevel: "Serializable" });
  } catch (e) { return fail(e); }
  refresh(id); return { success: "Message sent." };
}
export async function markChatRead(id: string, _state: ChatState, _form: FormData): Promise<ChatState> {
  void _state; void _form;
  const user = await getCurrentUser(); if (!user) return { error: "Please sign in." };
  try { await getDb().$transaction(async tx => {
    if (!await chatAccess(tx, id, user.id)) throw new ChatError("Conversation unavailable.");
    const readAt = new Date();
    await tx.chatRead.upsert({ where: { conversationId_userId: { conversationId: id, userId: user.id } }, create: { conversationId: id, userId: user.id, readAt }, update: { readAt } });
    await tx.notification.updateMany({ where: { userId: user.id, href: `/messages/${id}`, createdAt: { lte: readAt }, readAt: null }, data: { readAt } });
  }); } catch (e) { return fail(e); }
  refresh(id); return { success: "Marked as read." };
}
export async function blockChat(id: string, _state: ChatState, form: FormData): Promise<ChatState> {
  const user = await getCurrentUser(); if (!user) return { error: "Please sign in." };
  try { await getDb().$transaction(async tx => {
    const access = await chatAccess(tx, id, user.id);
    if (!access || access.chat.collaborationId) throw new ChatError("Blocking is available in private business chats.");
    const other = access.businesses.find(b => b.ownerId && b.ownerId !== user.id)?.ownerId;
    if (!other) throw new ChatError("Business unavailable.");
    if (form.get("unblock") === "yes") await tx.chatBlock.deleteMany({ where: { blockerId: user.id, blockedId: other } });
    else await tx.chatBlock.upsert({ where: { blockerId_blockedId: { blockerId: user.id, blockedId: other } }, create: { blockerId: user.id, blockedId: other }, update: {} });
  }); } catch (e) { return fail(e); }
  refresh(id); return { success: form.get("unblock") === "yes" ? "Account unblocked." : "Account blocked from private messaging. Existing messages remain available. Shared project chats are unaffected." };
}
export async function reportMessage(id: string, _state: ChatState, form: FormData): Promise<ChatState> {
  const user = await getCurrentUser(); if (!user) return { error: "Please sign in." };
  const reason = String(form.get("reason") ?? "").trim(); if (reason.length < 5 || reason.length > 1000) return { error: "Describe the issue in 5–1,000 characters." };
  try { await getDb().$transaction(async tx => {
    const access = await chatAccess(tx, id, user.id);
    if (!access) throw new ChatError("Conversation unavailable.");
    const message = await tx.chatMessage.findFirst({ where: { id: String(form.get("messageId") ?? ""), conversationId: id, sender: { ownerId: { not: user.id } } }, select: { id: true, senderId: true, body: true } });
    if (!message) throw new ChatError("Choose a message from another business in this conversation.");
    await tx.chatReport.upsert({ where: { messageId_reporterId: { messageId: message.id, reporterId: user.id } }, create: { messageId: message.id, reporterId: user.id, reason }, update: { reason } });
    const eventKey = `chat-report:${message.id}:${user.id}`;
    let record = await tx.safetyCase.findUnique({ where: { eventKey }, select: { id: true } });
    if (!record) record = await tx.safetyCase.create({ data: { eventKey, collaborationId: access.chat.collaborationId ?? access.chat.participation!.collaborationId, targetBusinessId: message.senderId, reporterId: user.id, priority: "ROUTINE", kind: "CHAT_REPORT", detail: `Report reason: ${reason}\n\nReported message (${message.id}): ${message.body}` } });
    await tx.safetyAudit.create({ data: { caseId: record.id, actorId: user.id, action: "MEMBER_REPORT", note: reason } });
    await notifyFounder(tx, record.id, founderId());
  }); } catch (e) { return fail(e); }
  revalidatePath("/safety");
  return { success: "Report saved privately for the founder. Saved does not mean read. Block the account to stop private messages. In-app alerts are not an emergency response service." };
}
export async function readNotifications(_state: ChatState, _form: FormData): Promise<ChatState> {
  void _state; void _form;
  const user = await getCurrentUser(); if (!user) return { error: "Please sign in." };
  await getDb().notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  refresh(); return { success: "Notifications marked as read." };
}
