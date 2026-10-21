import "server-only";
import { after } from "next/server";
import { accountEmailConfigured, sendAccountEmail } from "@/lib/account-email";
import { betterAuth } from "better-auth/minimal";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { getDb } from "@/lib/db";

function queueAccountEmail(to: string, url: string, kind: "reset" | "verify") {
  // Run after the response to avoid account-enumeration through SMTP latency.
  after(async () => {
    try { await sendAccountEmail(to, url, kind); }
    catch { console.error("Account email delivery failed."); }
  });
}

function createAuth() {
    const secret = process.env.BETTER_AUTH_SECRET;
    const baseURL = process.env.BETTER_AUTH_URL;
    if (!secret || secret.length < 32 || secret.startsWith("replace-") || !baseURL) throw new Error("Configure BETTER_AUTH_SECRET and BETTER_AUTH_URL.");
    return betterAuth({
      appName: "Business Collab",
      secret,
      baseURL,
      trustedOrigins: process.env.NODE_ENV === "production" ? [baseURL] : [baseURL, "http://127.0.0.1:3000", "http://localhost:3000"],
      database: prismaAdapter(getDb(), { provider: "postgresql", transaction: true }),
      advanced: { useSecureCookies: process.env.NODE_ENV === "production" },
      emailAndPassword: {
        enabled: true, minPasswordLength: 12, maxPasswordLength: 128,
        resetPasswordTokenExpiresIn: 3600, revokeSessionsOnPasswordReset: true,
        ...(accountEmailConfigured() ? { sendResetPassword: async ({ user, url }: { user: { email: string }; url: string }) => { queueAccountEmail(user.email, url, "reset"); } } : {}),
      },
      // Verification is additive: existing accounts retain sign-in access.
      emailVerification: {
        sendOnSignUp: accountEmailConfigured(), sendOnSignIn: false,
        autoSignInAfterVerification: false, expiresIn: 3600,
        ...(accountEmailConfigured() ? { sendVerificationEmail: async ({ user, url }: { user: { email: string }; url: string }) => { queueAccountEmail(user.email, url, "verify"); } } : {}),
      },
      session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24, cookieCache: { enabled: false } },
      rateLimit: { enabled: true, storage: process.env.NODE_ENV === "production" ? "database" : "memory", window: 60, max: 100, customRules: {
        "/sign-in/email": { window: 60, max: 10 },
        "/sign-up/email": { window: 60, max: 5 },
        "/request-password-reset": { window: 60, max: 3 },
        "/reset-password": { window: 60, max: 5 },
        "/send-verification-email": { window: 60, max: 3 },
      } },
    });
}

let instance: ReturnType<typeof createAuth> | undefined;
export function getAuth() {
  return instance ??= createAuth();
}
