export type UploadKind = "LOGO" | "INTRODUCTION" | "SHOWCASE" | "PHOTO";
export function uploadRules(kind: string) {
 if (!["LOGO", "INTRODUCTION", "SHOWCASE", "PHOTO"].includes(kind)) throw new Error("Choose a valid media slot.");
 const video = kind === "INTRODUCTION" || kind === "SHOWCASE";
 return { maximumSizeInBytes: (video ? 10 : 2) * 1024 * 1024, allowedContentTypes: video ? ["video/mp4", "video/webm"] : ["image/jpeg", "image/png", "image/webp"] };
}
export function usableUpload(ticket: { userId: string; businessId: string | null; kind: string; state: string; expiresAt: Date; consumedAt: Date | null } | null, userId: string, businessId: string | null, kind: string, now = new Date()) {
 return !!ticket && ticket.userId === userId && ticket.businessId === businessId && ticket.kind === kind && ticket.state === "READY" && !ticket.consumedAt && ticket.expiresAt > now;
}
export async function boundedBytes(stream: ReadableStream<Uint8Array>, maximum: number) {
 const reader=stream.getReader(), chunks: Uint8Array[]=[]; let total=0;
 try { for (;;) { const {done,value}=await reader.read(); if(done)break;total+=value.byteLength;if(total>maximum){await reader.cancel();throw new Error("This upload is larger than the allowed size.");}chunks.push(value); } }
 finally { reader.releaseLock(); }
 const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}return bytes;
}
