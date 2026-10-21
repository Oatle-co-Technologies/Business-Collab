import test from 'node:test';
import assert from 'node:assert/strict';
import { uploadRules, usableUpload, boundedBytes } from '../src/lib/media-upload-rules.ts';

test('media tickets bind owner, business, slot, readiness and expiry', () => {
 const now = new Date('2026-10-17T12:00:00Z');
 const ticket = { userId:'owner',businessId:'business',kind:'PHOTO',state:'READY',consumedAt:null,expiresAt:new Date(now.getTime()+1000) };
 assert.equal(usableUpload(ticket,'owner','business','PHOTO',now),true);
 for (const change of [{userId:'other'},{businessId:'other'},{kind:'LOGO'},{state:'PENDING'},{state:'ATTACHED'},{consumedAt:now},{expiresAt:now}]) {
  assert.equal(usableUpload({...ticket,...change},'owner','business','PHOTO',now),false);
 }
 assert.equal(usableUpload(null,'owner','business','PHOTO',now),false);
 assert.equal(usableUpload(ticket,'owner',null,'PHOTO',now),false);
});
test('upload rules limit supported media kinds and sizes', () => {
 assert.equal(uploadRules('PHOTO').maximumSizeInBytes,2*1024*1024);
 assert.equal(uploadRules('SHOWCASE').maximumSizeInBytes,10*1024*1024);
 assert.deepEqual(uploadRules('INTRODUCTION').allowedContentTypes,['video/mp4','video/webm']);
 assert.throws(()=>uploadRules('DOCUMENT'));
});
test('bounded download cancels oversized streams and preserves exact bytes',async()=>{
 const stream = new ReadableStream({start(c){c.enqueue(new Uint8Array([1,2]));c.enqueue(new Uint8Array([3]));c.close();}});
 assert.deepEqual(await boundedBytes(stream,3),new Uint8Array([1,2,3]));
 let cancelled=false;
 const oversized=new ReadableStream({start(c){c.enqueue(new Uint8Array(4));},cancel(){cancelled=true;}});
 await assert.rejects(boundedBytes(oversized,3),/larger/);
 assert.equal(cancelled,true);
});
