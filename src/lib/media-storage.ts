import "server-only";
import { get, put, del } from "@vercel/blob";
import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { readByteRange } from "@/lib/profile-content";
export const hostedMedia = () => process.env.MEDIA_STORAGE === "vercel-blob";
export const storageReady = () => hostedMedia() && (!!process.env.BLOB_READ_WRITE_TOKEN || (!!process.env.BLOB_STORE_ID && !!process.env.VERCEL_OIDC_TOKEN));
export async function savePrivateMedia(userId: string, ticketId: string, bytes: Uint8Array, contentType: string) {
 const extension=contentType==="image/webp"?"webp":contentType==="video/mp4"?"mp4":"webm";
 const path=`validated/${userId}/${ticketId}/${randomUUID()}.${extension}`;
 const blob=await put(path,Buffer.from(bytes),{access:"private",contentType,addRandomSuffix:false,allowOverwrite:false});
 return blob.pathname;
}
export async function streamPrivateMedia(path: string, contentType: string, byteSize: number, request?: Request) {
 if (!path.startsWith("validated/")) return new Response(null,{status:404});
 const headers: Record<string,string>={"Content-Type":contentType,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Accept-Ranges":"bytes"};
 const text=request?.headers.get("range");const range=text?readByteRange(text,byteSize):null;
 if(text&&!range)return new Response(null,{status:416,headers:{...headers,"Content-Range":`bytes */${byteSize}`}});
 const result=await get(path,{access:"private",...(range?{headers:{Range:`bytes=${range.start}-${range.end}`}}:{})});
 if(!result||result.statusCode!==200)return new Response(null,{status:404,headers});
 if(range){const expected=`bytes ${range.start}-${range.end}/${byteSize}`;if(result.headers.get("content-range")!==expected){await result.stream.cancel();return new Response(null,{status:502,headers});}headers["Content-Range"]=expected;headers["Content-Length"]=String(range.end-range.start+1);}
 else headers["Content-Length"]=String(byteSize || result.blob.size);
 return new Response(result.stream,{status:range?206:200,headers});
}
export async function deletePrivateMedia(paths: string[]) {
 const unique=[...new Set(paths)].filter(path=>path.startsWith("quarantine/")||path.startsWith("validated/"));
 if(unique.length)await del(unique);
}
export async function cleanupMediaUploads() {
 if(!storageReady())return 0;
 const db=getDb();const expired=await db.mediaUpload.findMany({where:{expiresAt:{lte:new Date()}},orderBy:{expiresAt:"asc"},take:100});
 for(const ticket of expired){
  const paths=[ticket.rawPath];
  if(ticket.storagePath){const [logo,media]=await Promise.all([db.business.findFirst({where:{logoPath:ticket.storagePath},select:{id:true}}),db.businessMedia.findFirst({where:{storagePath:ticket.storagePath},select:{id:true}})]);if(!logo&&!media)paths.push(ticket.storagePath);}
  await deletePrivateMedia(paths);await db.mediaUpload.delete({where:{id:ticket.id}});
 }
 return expired.length;
}
