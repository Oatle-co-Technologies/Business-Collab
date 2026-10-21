import { randomUUID } from "node:crypto";
import type { PrismaClient } from "../generated/prisma/client.ts";
export function safetyEmailMessage(origin: string) {
 const url=new URL(origin);if(url.protocol!=="https:"||url.username||url.password)throw new Error("A secure app origin is required.");
 return { subject:"Business Collab: safety inbox needs attention",text:`A safety case needs your attention. Sign in to your private founder inbox:\n\n${url.origin}/safety\n\nThis notification does not confirm an emergency or that anyone has responded.` };
}
export const emailRetryDelay = (attempt: number) => Math.min(3600000,60000*2**Math.min(Math.max(attempt-1,0),6));
export async function deliverSafetyEmails(db: PrismaClient, founder: string, send: (to: string, id: string) => Promise<void>, now=new Date()) {
 if(!founder)return {sent:0,failed:0};
 const user=await db.user.findUnique({where:{id:founder},select:{email:true}});if(!user)return {sent:0,failed:0};
 const items=await db.safetyEmail.findMany({where:{sentAt:null,nextAttemptAt:{lte:now},OR:[{leaseUntil:null},{leaseUntil:{lte:now}}],safetyCase:{acknowledgedAt:null,resolvedAt:null}},take:3,orderBy:{createdAt:"asc"}});
 let sent=0,failed=0;
 for(const item of items){
  const leaseId=randomUUID();
  const claimed=await db.safetyEmail.updateMany({where:{id:item.id,sentAt:null,OR:[{leaseUntil:null},{leaseUntil:{lte:now}}]},data:{leaseId,leaseUntil:new Date(now.getTime()+120000),founderId:founder,attempts:{increment:1}}});
  if(!claimed.count)continue;
  try{
   await send(user.email,item.id);
   await db.safetyEmail.updateMany({where:{id:item.id,leaseId},data:{sentAt:new Date(),leaseId:null,leaseUntil:null}});sent++;
  }catch{
   await db.safetyEmail.updateMany({where:{id:item.id,leaseId},data:{leaseId:null,leaseUntil:null,lastFailureAt:new Date(),nextAttemptAt:new Date(Date.now()+emailRetryDelay(item.attempts+1))}});failed++;
  }
 }
 return {sent,failed};
}
