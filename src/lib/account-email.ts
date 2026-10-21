import "server-only";
import nodemailer from "nodemailer";
import { accountEmailMessage } from "./account-email-rules";
export function accountEmailConfigured() {
  return process.env.AUTH_EMAIL_ENABLED === "true" && !!process.env.SMTP_USER && !!process.env.SMTP_PASSWORD && !!process.env.SMTP_FROM;
}
export async function sendAccountEmail(to: string, link: string, kind: "reset" | "verify") {
  if (!accountEmailConfigured()) throw new Error("Account email delivery is unavailable.");
  const from = process.env.SMTP_FROM!;
  if (/[\r\n]/.test(from) || /[\r\n]/.test(to)) throw new Error("Invalid email configuration.");
  const message = accountEmailMessage(process.env.BETTER_AUTH_URL!, link, kind);
  const transport = nodemailer.createTransport({ host: "smtp.purelymail.com", port: 465, secure: true,
    auth: { user: process.env.SMTP_USER!, pass: process.env.SMTP_PASSWORD! },
    connectionTimeout: 5000, greetingTimeout: 5000, socketTimeout: 5000,
    tls: { minVersion: "TLSv1.2", rejectUnauthorized: true }, disableFileAccess: true, disableUrlAccess: true });
  try {
    const result = await transport.sendMail({ from, to, ...message });
    if (!result.accepted?.length) throw new Error("Account email was not accepted.");
  } finally { transport.close(); }
}
