import { Suspense } from "react";
import { connection } from "next/server";
import { RecoveryForm } from "@/components/account-recovery";
import { accountEmailConfigured } from "@/lib/account-email";
async function Form() { await connection(); return <RecoveryForm enabled={accountEmailConfigured()} />; }
export default function Page() { return <main className="page max-w-lg"><h1>Forgot your password?</h1><Suspense fallback={<p>Loading…</p>}><Form /></Suspense></main>; }
