import test from 'node:test';import assert from 'node:assert/strict';
import {runMaintenance} from '../src/lib/maintenance.ts';
import {sweepSafety} from '../src/lib/safety-sweep.ts';
test('cleanup failure does not suppress safety email delivery and reports unhealthy maintenance',async()=>{
 const ran=[];const result=await runMaintenance({safety:async()=>{ran.push('safety');},email:async()=>{ran.push('email');return {enabled:true,failed:0};},cleanup:async()=>{ran.push('cleanup');throw Error();}});
 assert.deepEqual(ran,['safety','email','cleanup']);assert.deepEqual(result,{ok:false,emailEnabled:true});
});
test('queued emails are still attempted after safety failure, and failed sends are unhealthy',async()=>{
 let sent=false;const result=await runMaintenance({safety:async()=>{throw Error();},email:async()=>{sent=true;return {enabled:true,failed:0};},cleanup:async()=>{}});assert.equal(sent,true);assert.equal(result.ok,false);
 assert.equal((await runMaintenance({safety:async()=>{},email:async()=>({enabled:true,failed:1}),cleanup:async()=>{}})).ok,false);
});
test('email exceptions are contained and healthy disabled email is represented honestly',async()=>{
 assert.deepEqual(await runMaintenance({safety:async()=>{},email:async()=>{throw Error();},cleanup:async()=>{}}),{ok:false,emailEnabled:null});
 assert.deepEqual(await runMaintenance({safety:async()=>{},email:async()=>({enabled:false,failed:0}),cleanup:async()=>{}}),{ok:true,emailEnabled:false});
});
test('safety sweep rejects missing founder before inspecting attendance',async()=>{
 await assert.rejects(sweepSafety({},''),/recipient/);
 await assert.rejects(sweepSafety({user:{findUnique:async()=>null}},'missing'),/recipient/);
});
test('safety sweep selects unreported attendance in bounded, parameterised SQL',async()=>{
 let sql;const db={user:{findUnique:async()=>({id:'founder'})},$queryRaw:async query=>{sql=query;return [];},activityAttendee:{findMany:async()=>[]},safetyCase:{findMany:async()=>[]}};
 assert.equal(await sweepSafety(db,'founder',new Date(),{activityIds:['private-id'],collaborationIds:[]}),0);
 assert.match(sql.sql,/NOT EXISTS/);assert.match(sql.sql,/LIMIT 100/);assert.ok(!sql.sql.includes('private-id'));assert.ok(sql.values.some(v=>Array.isArray(v)&&v.includes('private-id')));
});
