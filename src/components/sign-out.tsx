"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function SignOut() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  return <div><button disabled={pending} onClick={async () => {
    setPending(true); setError(false);
    try {
      const result = await authClient.signOut();
      if (result.error) { setError(true); return; }
      router.replace("/sign-in"); router.refresh();
    } catch { setError(true); }
    finally { setPending(false); }
  }}>{pending ? "Signing out…" : "Sign out"}</button>{error && <p role="alert" className="error">Could not sign out. Try again.</p>}</div>;
}
