import Link from "next/link";
import { getCurrentUser } from "@/lib/current-user";
import { SignOut } from "@/components/sign-out";

import { getDb } from "@/lib/db";
import { LiveInbox } from "@/components/chat-ui";

import { founderId, teamIds } from "@/lib/safety-access";
import { chatInboxWhere } from "@/lib/chat";

export async function AccountNav() {
  const user = await getCurrentUser();
  const unread = user ? await getDb().notification.count({ where: { userId: user.id, readAt: null } }) : 0;
  const hasChat = user ? !!await getDb().conversation.findFirst({ where: chatInboxWhere(user.id), select: { id: true } }) : false;
  return user ? <div className="flex flex-wrap items-center gap-4 text-sm"><LiveInbox /><span>{user.name}</span><Link href="/my-businesses">My businesses</Link><Link href="/identity">Safety & identity</Link>{(user.id === founderId() || teamIds().includes(user.id)) && <Link href="/safety">Safety inbox</Link>}<Link href="/collaborations">Collaborations</Link>{hasChat && <Link href="/messages">Messages</Link>}<Link href="/notifications">Notifications{unread ? ` (${unread})` : ""}</Link><SignOut /></div>
    : <div className="flex items-center gap-4 text-sm"><Link href="/sign-in">Sign in</Link><Link className="button" href="/sign-up">Create account</Link></div>;
}
