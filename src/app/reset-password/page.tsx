import Link from "next/link";
import { Suspense } from "react";
import { RecoveryForm } from "@/components/account-recovery";
import { accountEmailConfigured } from "@/lib/account-email";
type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
async function Form({ searchParams }: Props) {
  const query = await searchParams;
  if (query.error || typeof query.token !== "string" || !query.token || query.token.length > 512) return <p>This link is invalid or expired. <Link href="/forgot-password">Request a new reset link</Link>.</p>;
  return <RecoveryForm enabled={accountEmailConfigured()} token={query.token} />;
}
export default function Page(props: Props) { return <main className="page max-w-lg"><h1>Reset your password</h1><Suspense fallback={<p>Loading…</p>}><Form {...props} /></Suspense></main>; }
