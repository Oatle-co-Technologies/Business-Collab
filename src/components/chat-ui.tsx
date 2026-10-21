"use client";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { startChat, sendMessage, markChatRead, blockChat, reportMessage, readNotifications, type ChatState } from "@/app/messages/actions";
type Action = (state: ChatState, form: FormData) => Promise<ChatState>;
export function ChatForm({ action, children, label }: { action: Action; children?: React.ReactNode; label: string }) {
  const [state, submit, pending] = useActionState(action, {});
  return <form action={submit} className="space-y-3"><fieldset disabled={pending} className="space-y-3">{children}<button type="submit">{pending ? "Saving…" : label}</button></fieldset>{state.error && <p className="error" role="alert">{state.error}</p>}{state.success && <p role="status">{state.success}</p>}</form>;
}
export function LiveInbox() {
  const router = useRouter();
  useEffect(() => { const timer = setInterval(() => { if (document.visibilityState === "visible") router.refresh(); }, 10000); return () => clearInterval(timer); }, [router]);
  return null;
}
export function StartChat({ entryId, collaborationId }: { entryId?: string; collaborationId?: string }) {
  return <ChatForm action={startChat} label={collaborationId ? "Open project chat" : "Message about this role"}><input type="hidden" name={collaborationId ? "collaborationId" : "entryId"} value={collaborationId ?? entryId} /></ChatForm>;
}
export function Composer({ id, businesses }: { id: string; businesses: { id: string; name: string }[] }) {
  return <ChatForm action={sendMessage.bind(null, id)} label="Send message"><label>Send as<select name="senderId" required>{businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label><label>Message<textarea name="body" required maxLength={4000} rows={3} placeholder="Discuss your collaboration…" /></label></ChatForm>;
}
export function MarkRead({ id }: { id?: string }) { return <ChatForm action={id ? markChatRead.bind(null, id) : readNotifications} label="Mark as read" />; }
export function BlockControl({ id, ownBlock }: { id: string; ownBlock: boolean }) { return <ChatForm action={blockChat.bind(null, id)} label={ownBlock ? "Unblock account" : "Block account"}><input type="hidden" name="unblock" value={ownBlock ? "yes" : "no"} /><p className="text-sm">Blocks private messages from all businesses owned by this account. Shared project chats are unaffected.</p></ChatForm>; }
export function ReportControl({ id, messages }: { id: string; messages: { id: string; label: string }[] }) { return <details className="panel"><summary>Report a message</summary><ChatForm action={reportMessage.bind(null, id)} label="Save report"><label>Message to report<select name="messageId" required>{messages.map(m => <option value={m.id} key={m.id}>{m.label}</option>)}</select></label><label>What happened?<textarea name="reason" required minLength={5} maxLength={1000} /></label><p className="text-sm">Reports go privately to the founder, who can assign follow-up to an authorised team member. This is not a monitored emergency channel.</p></ChatForm></details>; }
