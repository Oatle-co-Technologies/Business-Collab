import { timingSafeEqual } from "node:crypto";
import { getDb } from "@/lib/db";
import { founderId } from "@/lib/safety-access";
import { sweepSafety } from "@/lib/safety-sweep";
import { cleanupMediaUploads } from "@/lib/media-storage";
import { sendQueuedSafetyEmails } from "@/lib/safety-email";
import { runMaintenance } from "@/lib/maintenance";
export const maxDuration = 60;
export async function GET(request: Request) {
 const secret=process.env.CRON_SECRET;
 if(!secret||secret.length<32)return new Response(null,{status:503,headers:{"Cache-Control":"no-store"}});
 const expected=Buffer.from(`Bearer ${secret}`),provided=Buffer.from(request.headers.get("authorization")??"");
 if(expected.length!==provided.length||!timingSafeEqual(expected,provided))return new Response(null,{status:401,headers:{"Cache-Control":"no-store"}});
 const result = await runMaintenance({
  safety: () => sweepSafety(getDb(), founderId()),
  cleanup: cleanupMediaUploads,
  email: sendQueuedSafetyEmails,
 });
 return Response.json(result, { status: result.ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
