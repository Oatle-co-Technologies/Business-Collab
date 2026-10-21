import "server-only";
import { betterAuth } from "better-auth/minimal";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { getDb } from "@/lib/db";

function createAuth() {
    const secret = process.env.BETTER_AUTH_SECRET;
    const baseURL = process.env.BETTER_AUTH_URL;
    if (!secret || secret.length < 32 || secret.startsWith("replace-") || !baseURL) throw new Error("Configure BETTER_AUTH_SECRET and BETTER_AUTH_URL.");
    return betterAuth({
      appName: "Business Collab",
      secret,
      baseURL,
      trustedOrigins: process.env.NODE_ENV === "production" ? [baseURL] : [baseURL, "http://127.0.0.1:3000", "http://localhost:3000"],
      database: prismaAdapter(getDb(), { provider: "postgresql" }),
      advanced: { useSecureCookies: process.env.NODE_ENV === "production" },
      emailAndPassword: { enabled: true, minPasswordLength: 12, maxPasswordLength: 128 },
      session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24, cookieCache: { enabled: false } },
      rateLimit: { enabled: true, storage: process.env.NODE_ENV === "production" ? "database" : "memory", window: 60, max: 100, customRules: {
        "/sign-in/email": { window: 60, max: 10 },
        "/sign-up/email": { window: 60, max: 5 },
      } },
    });
}

let instance: ReturnType<typeof createAuth> | undefined;
export function getAuth() {
  return instance ??= createAuth();
}
