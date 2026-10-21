export function accountEmailMessage(origin: string, link: string, kind: "reset" | "verify") {
  const base = new URL(origin), url = new URL(link);
  if (base.protocol !== "https:" || base.username || base.password || url.origin !== base.origin || url.username || url.password) throw new Error("Invalid account email link");
  const expectedPath = kind === "reset" ? "/api/auth/reset-password/" : "/api/auth/verify-email";
  if (!(kind === "reset" ? url.pathname.startsWith(expectedPath) : url.pathname === expectedPath)) throw new Error("Invalid account email path");
  return {
    subject: kind === "reset" ? "Business Collab: reset your password" : "Business Collab: verify your email",
    text: `${kind === "reset" ? "Reset your password" : "Verify your email address"}:\n\n${url.toString()}\n\nThis link expires in one hour. If you did not request this, ignore this email.`,
  };
}
