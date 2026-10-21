"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
export function RecoveryForm({ enabled, token }: { enabled: boolean; token?: string }) {
  const [pending, setPending] = useState(false), [message, setMessage] = useState(""), [error, setError] = useState("");
  const router = useRouter();
  if (!enabled) return <p>Account recovery email is not connected yet. Contact the founder for help accessing your account.</p>;
  return <form className="space-y-4" onSubmit={async event => {
    event.preventDefault(); setError(""); setMessage("");
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    if (token && password !== form.get("confirmation")) { setError("Your passwords do not match."); return; }
    setPending(true);
    try {
      if (token) {
        const result = await authClient.resetPassword({ newPassword: password, token });
        if (result.error) { setError("This link may have expired or been used. Request a new reset link."); return; }
        router.replace("/sign-in?reset=1"); router.refresh();
      } else {
        const result = await authClient.requestPasswordReset({ email: String(form.get("email") ?? "").trim().toLowerCase(), redirectTo: `${window.location.origin}/reset-password` });
        if (result.error) { setError("The request could not be processed. Please wait and try again."); return; }
        setMessage("If an account exists for that email, a reset link will be sent. Check your inbox and spam folder.");
      }
    } catch { setError("Could not connect. Please try again."); }
    finally { setPending(false); }
  }}>
    <fieldset className="space-y-4" disabled={pending}>
      {token ? <><label>New password<input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></label><label>Confirm password<input name="confirmation" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></label></> : <label>Email address<input name="email" type="email" autoComplete="email" maxLength={254} required /></label>}
      <button>{pending ? "Please wait…" : token ? "Reset password" : "Send reset link"}</button>
    </fieldset>
    {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    <p><Link href="/sign-in">Back to sign in</Link></p>
  </form>;
}
export function VerifyEmail({ enabled }: { enabled: boolean }) {
  const [pending, setPending] = useState(false), [message, setMessage] = useState("");
  if (!enabled) return <p>Email verification is not connected yet.</p>;
  return <div><button disabled={pending} onClick={async () => {
    setPending(true);
    try {
      const session = await authClient.getSession();
      if (!session.data?.user) { setMessage("Please sign in again."); return; }
      const result = await authClient.sendVerificationEmail({ email: session.data.user.email, callbackURL: `${window.location.origin}/identity` });
      setMessage(result.error ? "Could not request verification. Please wait and try again." : "Verification requested. Check your inbox and spam folder.");
    } catch { setMessage("Could not connect. Please try again."); }
    finally { setPending(false); }
  }}>{pending ? "Please wait…" : "Send email verification link"}</button>{message && <p role="status">{message}</p>}</div>;
}
