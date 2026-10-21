import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { identityEligible, saDate, attendanceTransition, activitySchema } from '../src/lib/safety-rules.ts';
import { canonicalJson, validDiditSignature, diditDecision } from '../src/lib/didit-rules.ts';
test('identity eligibility fails closed for missing, pending, expired and restricted accounts',()=>{
 const now=new Date('2026-10-17T10:00:00Z');
 assert.equal(identityEligible(null,false,now),false);
 assert.equal(identityEligible({status:'PENDING',expiresAt:null},false,now),false);
 assert.equal(identityEligible({status:'VERIFIED',expiresAt:new Date('2026-01-01')},false,now),false);
 assert.equal(identityEligible({status:'VERIFIED',expiresAt:null},true,now),false);
 assert.equal(identityEligible({status:'VERIFIED',expiresAt:null},false,now),true);
});
test('SAST dates are explicit and invalid calendar dates are rejected',()=>{
 assert.equal(saDate('2026-10-17T12:00').toISOString(),'2026-10-17T10:00:00.000Z');
 assert.ok(Number.isNaN(saDate('2026-02-30T12:00').getTime()));
 assert.equal(activitySchema.safeParse({title:'Work',start:'2026-10-17T12:00',end:'2026-10-17T11:00',venue:'A private studio',reason:''}).success,false);
});
test('attendance requires acknowledgement and allows late checkout without inventing safety',()=>{
 const empty={acknowledgedAt:null,declinedAt:null,checkedInAt:null,checkedOutAt:null},start=new Date('2026-10-17T10:00Z'),end=new Date('2026-10-17T12:00Z');
 assert.throws(()=>attendanceTransition(empty,'check-in',start,end,start));
 assert.throws(()=>attendanceTransition({...empty,acknowledgedAt:start},'check-in',start,end,new Date('2026-10-17T08:00Z')));
 const entered={...empty,acknowledgedAt:start,checkedInAt:start};
 assert.throws(()=>attendanceTransition(entered,'decline',start,end,start));
 assert.deepEqual(attendanceTransition(entered,'check-out',start,end,new Date('2026-10-18')), {checkedOutAt:new Date('2026-10-18')});
});
test('Didit V2 signature rejects tampering and stale signed payloads despite a fresh header',()=>{
 const now=Date.now(),timestamp=Math.floor(now/1000),secret='test-only-secret';
 const body={timestamp,status:'Approved',z:{b:1,a:'é'}};
 const sig=createHmac('sha256',secret).update(canonicalJson(body)).digest('hex');
 assert.equal(validDiditSignature(body,sig,String(timestamp),secret,now),true);
 assert.equal(validDiditSignature({...body,status:'Declined'},sig,String(timestamp),secret,now),false);
 const old={...body,timestamp:timestamp-600};const oldSig=createHmac('sha256',secret).update(canonicalJson(old)).digest('hex');
 assert.equal(validDiditSignature(old,oldSig,String(timestamp),secret,now),false);
});
test('sandbox, empty approvals and incomplete workflows cannot grant verified identity',()=>{
 const decision={id_verifications:[{status:'Approved'}],liveness_checks:[{status:'Approved'}],face_matches:[{status:'Approved'}]};
 assert.equal(diditDecision({environment:'sandbox',status:'Approved',decision}),'REVIEW');
 assert.equal(diditDecision({environment:'live',status:'Approved',decision:{}}),'REVIEW');
 assert.equal(diditDecision({environment:'live',status:'Approved',decision}),'VERIFIED');
});
