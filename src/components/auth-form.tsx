"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function AuthForm({ mode, returnTo }: { mode: "sign-in" | "sign-up"; returnTo: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const signingUp = mode === "sign-up";
  return <form className="space-y-5" onSubmit={async event => {
    event.preventDefault();
    setError("");
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "").trim().toLowerCase();
    const password = String(data.get("password") ?? "");
    if (signingUp && password !== data.get("confirmPassword")) { setError("Your passwords do not match."); return; }
    setPending(true);
    try {
      const result = signingUp
        ? await authClient.signUp.email({ name: String(data.get("name") ?? "").trim(), email, password })
        : await authClient.signIn.email({ email, password });
      if (result.error) {
        setError(result.error.status === 429 ? "Too many attempts. Please wait a minute and try again." : signingUp
          ? "We could not create this account. Check your details, or try signing in if you already have an account."
          : "We could not sign you in. Check your email and password.");
        return;
      }
      router.replace(returnTo);
      router.refresh();
    } catch { setError("We could not connect. Please try again."); }
    finally { setPending(false); }
  }}>
    {error && <p role="alert" className="error">{error}</p>}
    {signingUp && <div><label htmlFor="name">Your name</label><input id="name" name="name" autoComplete="name" required minLength={2} maxLength={120} /></div>}
    <div><label htmlFor="email">Email address</label><input id="email" name="email" type="email" autoComplete="email" required maxLength={254} /></div>
    <div><label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete={signingUp ? "new-password" : "current-password"} required minLength={signingUp ? 12 : undefined} maxLength={128} />
      {signingUp && <p className="mt-1 text-sm text-neutral-600">Use at least 12 characters.</p>}
    </div>
    {signingUp && <div><label htmlFor="confirmPassword">Confirm password</label><input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required minLength={12} maxLength={128} /></div>}
    <button type="submit" disabled={pending}>{pending ? "Please wait…" : signingUp ? "Create account" : "Sign in"}</button>
    <p className="text-sm">{signingUp ? "Already have an account? " : "New to Business Collab? "}
      <Link href={`${signingUp ? "/sign-in" : "/sign-up"}?${new URLSearchParams({ next: returnTo })}`}>{signingUp ? "Sign in" : "Create an account"}</Link>
    </p>
  </form>;
}
