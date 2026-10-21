import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { getCurrentUser } from "@/lib/current-user";
import { safeReturnPath } from "@/lib/access";

async function AccountForm({ searchParams }: PageProps<"/sign-in">) {
  const params = await searchParams;
  const returnTo = safeReturnPath(params.next);
  if (await getCurrentUser()) redirect(returnTo);
  return <AuthForm mode="sign-in" returnTo={returnTo} />;
}

export default function Page(props: PageProps<"/sign-in">) {
  return <main className="page max-w-lg"><h1 className="mb-3">Sign in</h1>
    <p className="mb-8 text-neutral-600">Manage your business and find businesses to collaborate with.</p>
    <Suspense fallback={<p role="status">Loading account form…</p>}><AccountForm {...props} /></Suspense>
  </main>;
}
