import { timingSafeEqual } from "node:crypto";
import { getDb } from "@/lib/db";
import { founderId } from "@/lib/safety-access";
import { sweepSafety } from "@/lib/safety-sweep";
import { cleanupMediaUploads } from "@/lib/media-storage";
import { sendQueuedSafetyEmails } from "@/lib/safety-email";
export const maxDuration = 60;
export async function GET(request: Request) {
 const secret=process.env.CRON_SECRET;
 if(!secret||secret.length<32)return new Response(null,{status:503});
 const expected=Buffer.from(`Bearer ${secret}`),provided=Buffer.from(request.headers.get("authorization")??"");
 if(expected.length!==provided.length||!timingSafeEqual(expected,provided))return new Response(null,{status:401});
 const results=await Promise.allSettled([sweepSafety(getDb(),founderId()),cleanupMediaUploads()]);
 if(results.some(result=>result.status==="rejected"))return Response.json({ok:false,error:"Maintenance did not finish; retry required."},{status:500,headers:{"Cache-Control":"no-store"}});
 const delivery=await sendQueuedSafetyEmails();
 if(delivery.failed)return Response.json({ok:false,error:"Email delivery will retry."},{status:503,headers:{"Cache-Control":"no-store"}});
 return Response.json({ok:true,emailEnabled:delivery.enabled},{headers:{"Cache-Control":"no-store"}});
}
