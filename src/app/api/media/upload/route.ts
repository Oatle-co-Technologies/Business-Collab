import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getCurrentUser } from "@/lib/current-user";
import { getDb } from "@/lib/db";
import { uploadRules, boundedBytes } from "@/lib/media-upload-rules";
import { storageReady } from "@/lib/media-storage";
export async function POST(request: Request) {
 if(!storageReady())return Response.json({error:"Hosted media storage is not connected."},{status:503});
 if(Number(request.headers.get("content-length")??0)>16384)return new Response(null,{status:413});
 try {
  const text=request.body ? new TextDecoder().decode(await boundedBytes(request.body,16384)) : "";if(text.length>16384)return new Response(null,{status:413});const body=JSON.parse(text) as HandleUploadBody;
  const result=await handleUpload({request,body,onBeforeGenerateToken:async(pathname,clientPayload)=>{
   if(request.headers.get("origin")!==new URL(process.env.BETTER_AUTH_URL!).origin)throw new Error("Origin denied");
   const user=await getCurrentUser();if(!user)throw new Error("Sign in required");
   const payload=JSON.parse(clientPayload??"{}");
   const ticket=await getDb().mediaUpload.findFirst({where:{id:String(payload.ticketId??""),userId:user.id,rawPath:pathname,state:"PENDING",consumedAt:null,expiresAt:{gt:new Date()}}});
   if(!ticket)throw new Error("Upload denied");
   if(ticket.businessId&&!await getDb().business.findFirst({where:{id:ticket.businessId,ownerId:user.id},select:{id:true}}))throw new Error("Upload denied");
   const account=await getDb().user.findUnique({where:{id:user.id},select:{safetySuspended:true}});if(!account||account.safetySuspended)throw new Error("Upload denied");
   await getDb().mediaUpload.update({where:{id:ticket.id},data:{tokenIssuedAt:new Date()}});
   return {...uploadRules(ticket.kind),validUntil:Date.now()+15*60000,addRandomSuffix:false,allowOverwrite:false,tokenPayload:JSON.stringify({ticketId:ticket.id})};
  }});
  return Response.json(result,{headers:{"Cache-Control":"no-store"}});
 }catch{return Response.json({error:"This upload could not be authorised. Sign in and retry."},{status:400});}
}
