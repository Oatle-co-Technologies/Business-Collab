"use server";
import { randomUUID } from "node:crypto";
import { get } from "@vercel/blob";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { uploadRules, boundedBytes } from "@/lib/media-upload-rules";
import { storageReady, savePrivateMedia, deletePrivateMedia } from "@/lib/media-storage";
import { prepareLogo } from "@/lib/logo";
import { prepareVideo } from "@/lib/video";
export async function beginMediaUpload(businessId: string | null, kind: string) {
 const user=await getCurrentUser();if(!user)throw new Error("Please sign in before uploading.");
 if(!storageReady())throw new Error("Hosted media storage is not connected yet.");
 uploadRules(kind);
 return getDb().$transaction(async tx=>{
  if(businessId&&!await tx.business.findFirst({where:{id:businessId,ownerId:user.id},select:{id:true}}))throw new Error("You cannot upload to this business.");
  const account=await tx.user.findUnique({where:{id:user.id},select:{safetySuspended:true}});if(!account||account.safetySuspended)throw new Error("This account is restricted.");
  const recent=await tx.mediaUpload.count({where:{userId:user.id,createdAt:{gte:new Date(Date.now()-3600000)}}});if(recent>=40)throw new Error("Please wait before uploading more files.");
  const ticket=await tx.mediaUpload.create({data:{userId:user.id,businessId,kind,rawPath:`quarantine/${user.id}/${randomUUID()}`,expiresAt:new Date(Date.now()+24*3600000)}});
  return {id:ticket.id,pathname:ticket.rawPath};
 },{isolationLevel:"Serializable"});
}
export async function finalizeMediaUpload(id: string) {
 const user=await getCurrentUser();if(!user)throw new Error("Please sign in before saving uploads.");
 if(!storageReady())throw new Error("Hosted media storage is not connected yet.");
 const db=getDb();const ticket=await db.mediaUpload.findFirst({where:{id,userId:user.id,consumedAt:null,expiresAt:{gt:new Date()}}});
 if(!ticket)throw new Error("This upload is unavailable or expired. Choose the file again.");
 if(ticket.state==="READY")return {id:ticket.id};
 if(ticket.businessId&&!await db.business.findFirst({where:{id:ticket.businessId,ownerId:user.id},select:{id:true}}))throw new Error("You cannot save uploads for this business.");
 const limits=uploadRules(ticket.kind);const uploaded=await get(ticket.rawPath,{access:"private",useCache:false});
 if(!uploaded||uploaded.statusCode!==200)throw new Error("Upload not found. Please retry.");
 if(!limits.allowedContentTypes.includes(uploaded.blob.contentType)||uploaded.blob.size>limits.maximumSizeInBytes){await uploaded.stream.cancel();throw new Error("Choose a supported file within the size limit.");}
 const bytes=await boundedBytes(uploaded.stream,limits.maximumSizeInBytes);
 const file=new File([bytes],"upload",{type:uploaded.blob.contentType});
 const prepared=ticket.kind==="LOGO"||ticket.kind==="PHOTO"?{data:await prepareLogo(file,ticket.kind==="LOGO"?512:1200),contentType:"image/webp"}:await prepareVideo(file);
 const path=await savePrivateMedia(user.id,ticket.id,prepared.data,prepared.contentType);
 try {
  const claimed=await db.mediaUpload.updateMany({where:{id:ticket.id,userId:user.id,state:"PENDING",consumedAt:null,expiresAt:{gt:new Date()}},data:{state:"READY",storagePath:path,contentType:prepared.contentType,byteSize:prepared.data.byteLength}});
  if(!claimed.count){await deletePrivateMedia([path]);const existing=await db.mediaUpload.findFirst({where:{id:ticket.id,userId:user.id,state:"READY",consumedAt:null}});if(!existing)throw new Error("Upload changed. Please retry.");}
 }catch(error){await deletePrivateMedia([path]).catch(()=>{});throw error;}
 await deletePrivateMedia([ticket.rawPath]).catch(()=>{});
 return {id:ticket.id};
}
