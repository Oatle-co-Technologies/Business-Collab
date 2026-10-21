import test from 'node:test';
import assert from 'node:assert/strict';
import { beginIdentitySession } from '../src/lib/identity-session.ts';
function fixture(initial = null) {
 let row = initial, suspended = false, events = [];
 const db = {
  user: { findUnique: async () => ({ safetySuspended: suspended, identityCheck: row }) },
  identityCheck: {
   create: async ({data}) => { if (row) throw Object.assign(Error(),{code:'P2002'}); row={...data,updatedAt:new Date()}; },
   updateMany: async ({where,data}) => {
    if (!row || ('sessionId' in where && row.sessionId !== where.sessionId) || (where.updatedAt && row.updatedAt !== where.updatedAt)) return {count:0};
    row={...row,...data,updatedAt:new Date()}; return {count:1};
   },
  },
  identityEvent: { create: async ({data}) => { events.push(data); } },
  $transaction: async callback => callback(db),
 };
 return { db, row:()=>row, events:()=>events, suspend:()=>{suspended=true;}, replace:value=>{row=value;} };
}
const session = { session_id:'provider-session', url:'https://verify.didit.me/session' };
test('a persisted reservation prevents a second provider call while the first is in flight',async()=>{
 const f=fixture(); let release,started; const began=new Promise(r=>{started=r;}); const waiting=new Promise(r=>{release=r;});let calls=0;
 const first=beginIdentitySession(f.db,'user',async()=>{calls++;started();await waiting;return session;});
 await began;assert.match(f.row().sessionId,/^starting:/);
 await assert.rejects(beginIdentitySession(f.db,'user',async()=>{calls++;return session;}),/already in progress/);
 release();assert.equal(await first,session.url);assert.equal(calls,1);assert.equal(f.row().sessionId,session.session_id);assert.equal(f.events().length,1);
});
test('provider failure releases only its own reservation and retains a previous identity reference',async()=>{
 const previous={provider:'DIDIT',sessionId:'old',status:'DECLINED',checkedAt:null,expiresAt:null,lastEventAt:new Date(0),updatedAt:new Date(0)};
 const f=fixture(previous);
 await assert.rejects(beginIdentitySession(f.db,'user',async()=>{throw Error('provider unavailable');}));
 assert.equal(f.row().sessionId,'old');assert.equal(f.row().status,'DECLINED');assert.equal(f.events().length,0);
});
test('cleanup after provider failure cannot overwrite a newer identity result',async()=>{
 const f=fixture();await assert.rejects(beginIdentitySession(f.db,'user',async()=>{f.replace({sessionId:'newer',status:'VERIFIED'});throw Error();}));
 assert.equal(f.row().sessionId,'newer');assert.equal(f.row().status,'VERIFIED');
});
test('verified and restricted accounts never create a provider session',async()=>{
 let calls=0;const provider=async()=>{calls++;return session;};
 await assert.rejects(beginIdentitySession(fixture({status:'VERIFIED',expiresAt:null}).db,'user',provider),/already checked/);
 const f=fixture();f.suspend();await assert.rejects(beginIdentitySession(f.db,'user',provider),/restricted/);assert.equal(calls,0);
});
test('invalid redirect and suspension during the provider request cannot attach a session',async()=>{
 for(const url of ['https://evil.example/check','https://user:pass@verify.didit.me/check','http://verify.didit.me/check']) {
  const f=fixture();await assert.rejects(beginIdentitySession(f.db,'user',async()=>({...session,url})));assert.equal(f.row().status,'NOT_STARTED');assert.equal(f.events().length,0);
 }
 const f=fixture();await assert.rejects(beginIdentitySession(f.db,'user',async()=>{f.suspend();return session;}),/restricted/);assert.equal(f.row().sessionId,null);
});

test('simultaneous first starts cannot both create external sessions',async()=>{
 const f=fixture();let calls=0;
 const results=await Promise.allSettled([1,2].map(()=>beginIdentitySession(f.db,'user',async()=>{calls++;return session;})));
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(calls,1);
});
