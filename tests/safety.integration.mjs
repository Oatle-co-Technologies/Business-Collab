import assert from 'node:assert/strict';
import { requireLocalTestDatabase } from './local-test-database.mjs';
import { randomBytes,createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { hashPassword } from 'better-auth/crypto';
import { PrismaClient } from '../src/generated/prisma/client.ts';
import { PrismaPg } from '@prisma/adapter-pg';
import { canonicalJson } from '../src/lib/didit-rules.ts';
import { sweepSafety } from '../src/lib/safety-sweep.ts';
requireLocalTestDatabase(process.env.DATABASE_URL);
const db=new PrismaClient({adapter:new PrismaPg({connectionString:process.env.DATABASE_URL})});
const {encodeReply}=createRequire(import.meta.url)('next/dist/compiled/react-server-dom-webpack/client.node.js');
const suffix=randomBytes(5).toString('hex'),password=randomBytes(24).toString('base64url');
const ids=Object.fromEntries(['founder','team','organizer','member','outsider'].map(role=>[role,`qa-safety-${role}-${suffix}`]));
const cookies={},base='http://127.0.0.1:3107',secret=randomBytes(32).toString('hex');
const projectId=`qa-safety-project-${suffix}`,ba=`qa-safety-ba-${suffix}`,bb=`qa-safety-bb-${suffix}`;
let server;
const data=values=>{const f=new FormData();for(const[k,v]of Object.entries(values))f.set(k,v);return f;};
const manifest=JSON.parse(readFileSync(new URL('../.next/server/server-reference-manifest.json',import.meta.url),'utf8'));
async function action(name,args,role='member') {
 const key=Object.entries(manifest.node).find(([,v])=>v.exportedName===name)?.[0];assert.ok(key,`Action registered: ${name}`);
 const response=await fetch(base+'/safety',{method:'POST',headers:{'Next-Action':key,Origin:base,...(role?{Cookie:cookies[role]}:{})},body:await encodeReply(args),redirect:'manual'});
 return {response,text:await response.text()};
}
const html=async(path,role)=>fetch(base+path,{headers:{Cookie:cookies[role]}}).then(r=>r.text());
const inputTime=date=>new Date(date.getTime()+2*3600000).toISOString().slice(0,16);
try {
 const hash=await hashPassword(password);
 for(const[role,id]of Object.entries(ids)){
  await db.user.create({data:{id,name:`Temporary Safety ${role}`,email:`${id}@example.com`,emailVerified:true,accounts:{create:{id:`account-${id}`,accountId:id,providerId:'credential',password:hash}}}});
  if(role!=='outsider')await db.identityCheck.create({data:{userId:id,provider:'TEST_ONLY',status:'VERIFIED'}});
 }
 for(const[id,ownerId,name]of [[ba,ids.organizer,'Temporary Safety Organiser'],[bb,ids.member,'Temporary Safety Member']])await db.business.create({data:{id,ownerId,name,description:'Temporary safety workflow fixture.',location:'Pretoria',discoveryArea:'Gauteng',categories:['Testing'],email:`${id}@example.com`,phone:'0125550100',published:true}});
 await db.collaboration.create({data:{id:projectId,organizerId:ba,title:'Temporary safety project',description:'Temporary activity, attendance and report tests.',servicesNeeded:['Testing'],location:'Pretoria',discoveryArea:'Gauteng',visibility:'INVITE_ONLY',participants:{create:{businessId:bb,source:'INVITATION',status:'SELECTED'}}}});
 server=spawn(process.execPath,['--env-file=.env','node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3107'],{cwd:new URL('../',import.meta.url),env:{...process.env,BETTER_AUTH_URL:base,SAFETY_FOUNDER_USER_ID:ids.founder,SAFETY_TEAM_USER_IDS:ids.team,DIDIT_ENABLED:'true',DIDIT_APPLICATION_ID:'qa-application',DIDIT_WORKFLOW_ID:'qa-workflow',DIDIT_API_KEY:'qa-not-real',DIDIT_WEBHOOK_SECRET:secret},stdio:'ignore'});
 let ready=false;for(let attempt=0;attempt<100;attempt++){try{const r=await fetch(base+'/sign-in');if(r.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,200));}assert.ok(ready,'Isolated test server ready');
 for(const[role,id]of Object.entries(ids)){
  const response=await fetch(base+'/api/auth/sign-in/email',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({email:`${id}@example.com`,password})});assert.equal(response.status,200,`Login ${role}`);cookies[role]=response.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');
 }
 const denied=await action('createCollaboration',[{},data({organizerId:ba,title:'Forged organiser',description:'This should never be created for another account.',servicesNeeded:'Testing',location:'Pretoria',discoveryArea:'Gauteng',visibility:'OPEN'})],'outsider');assert.ok(denied.text.includes('identity check'));
 assert.ok((await action('startIdentity',[{},data({})],'member')).text.includes('consent'));
 const now=Date.now(),start=new Date(now+2*3600000),end=new Date(now+3*3600000);
 const values={title:'Private activity',start:inputTime(start),end:inputTime(end),venue:'PRIVATE_VENUE_PROOF: a test-only studio address',reason:''};
 assert.ok((await action('saveActivity',[projectId,null,{},data(values)],'member')).text.includes('Only the organiser'));
 const created=await action('saveActivity',[projectId,null,{},data(values)],'organizer');
 const activityId=created.response.headers.get('x-action-redirect')?.match(/activities\/([a-zA-Z0-9-]+)/)?.[1];assert.ok(activityId,created.text.slice(0,200));
 let version=await db.activityVersion.findUnique({where:{activityId_version:{activityId,version:1}}});
 assert.ok(!(await html(`/activities/${activityId}`,'outsider')).includes('PRIVATE_VENUE_PROOF'));
 const attendance=(decision,versionId=version.id,role='member')=>action('recordAttendance',[activityId,{},data({decision,versionId,userId:ids.organizer})],role);
 assert.ok((await attendance('check-in')).text.includes('Confirm the current plan'));
 assert.ok((await attendance('acknowledge')).text.includes('saved'));
 const organiserRow=await db.activityAttendee.findUnique({where:{versionId_userId:{versionId:version.id,userId:ids.organizer}}});assert.equal(organiserRow.acknowledgedAt,null,'Cannot acknowledge as another user');
 const oldId=version.id;
 const moved={...values,start:inputTime(new Date(now+30*60000)),end:inputTime(new Date(now+90*60000)),reason:'The client changed the appointment time.'};
 await action('saveActivity',[projectId,activityId,{},data(moved)],'organizer');
 version=await db.activityVersion.findUnique({where:{activityId_version:{activityId,version:2}}});assert.ok(version);
 assert.equal(await db.activityVersion.count({where:{activityId}}),2);
 assert.ok((await attendance('acknowledge',oldId)).text.includes('plan changed'));
 assert.equal((await db.activityAttendee.findUnique({where:{versionId_userId:{versionId:version.id,userId:ids.member}}})).acknowledgedAt,null);
 await attendance('acknowledge');assert.ok((await attendance('check-in')).text.includes('saved'));
 assert.ok((await action('saveActivity',[projectId,activityId,{},data(moved)],'organizer')).text.includes('cannot be rescheduled'));
 assert.ok((await action('cancelActivity',[activityId,{},data({confirm:'yes'})],'organizer')).text.includes('cannot be cancelled'));
 assert.ok((await action('completeCollaboration',[projectId,{},data({confirm:'yes'})],'organizer')).text.includes('Finish each attendee'));
 const filed=await action('fileSafetyReport',[{},data({collaborationId:projectId,priority:'URGENT',detail:'PRIVATE_INCIDENT_PROOF: I need a private safety follow-up.'})]);assert.ok(filed.text.includes('saved privately'));
 const report=await db.safetyCase.findFirst({where:{collaborationId:projectId,kind:'MEMBER_REPORT'}});assert.ok(report.founderNotifiedAt);
 assert.equal(await db.notification.count({where:{userId:ids.founder,href:`/safety/${report.id}`}}),1);
 assert.ok(!(await html(`/safety/${report.id}`,'outsider')).includes('PRIVATE_INCIDENT_PROOF'));
 assert.ok(!(await html(`/safety/${report.id}`,'team')).includes('PRIVATE_INCIDENT_PROOF'));
 const follow=(decision,role='founder',extras={})=>action('manageSafetyCase',[report.id,{},data({decision,note:'A private test follow-up note.',assigneeId:ids.team,...extras})],role);
 assert.ok((await follow('assign')).text.includes('acknowledged open case'));
 assert.ok((await follow('acknowledge','member')).text.includes('unavailable'));
 assert.ok((await follow('acknowledge')).text.includes('saved'));
 assert.ok((await follow('assign')).text.includes('saved'));
 assert.ok((await html(`/safety/${report.id}`,'team')).includes('PRIVATE_INCIDENT_PROOF'));
 assert.ok((await follow('restrict','team',{subjectId:ids.organizer})).text.includes('Only the founder'));
 assert.ok((await follow('restrict','founder',{subjectId:ids.member})).text.includes('saved'));
 await db.activityVersion.update({where:{id:version.id},data:{endsAt:new Date(now-31*60000)}});
 const scope={activityIds:[activityId],collaborationIds:[projectId]};
 await sweepSafety(db,ids.founder,new Date(now),scope);await sweepSafety(db,ids.founder,new Date(now),scope);
 const attendee=await db.activityAttendee.findUnique({where:{versionId_userId:{versionId:version.id,userId:ids.member}}});
 const overdue=await db.safetyCase.findUnique({where:{eventKey:`overdue:${attendee.id}`}});assert.ok(overdue);
 assert.equal(await db.notification.count({where:{userId:ids.founder,href:`/safety/${overdue.id}`}}),1,'Overdue notification is idempotent');
 assert.ok((await attendance('check-out')).text.includes('saved'),'Restricted accounts can still check out');
 assert.equal((await db.safetyCase.findUnique({where:{id:overdue.id}})).status,'NEW','Late checkout does not resolve safety case');
 assert.ok(await db.safetyAudit.findFirst({where:{caseId:overdue.id,action:'LATE_CHECKOUT'}}));
 assert.ok((await follow('restore','founder',{subjectId:ids.member})).text.includes('saved'));
 await attendance('decline',version.id,'organizer');
 assert.ok((await action('completeCollaboration',[projectId,{},data({confirm:'yes'})],'organizer')).text.includes('Collaboration completed'));
 // Provider callbacks use fake keys and synthetic identity results only; no external request is made.
 const sessionId=`qa-session-${suffix}`;await db.identityCheck.create({data:{userId:ids.outsider,provider:'DIDIT',sessionId,status:'PENDING'}});
 const stamp=Math.floor(Date.now()/1000);
 const event={event_id:`qa-event-${suffix}`,timestamp:stamp,created_at:stamp,application_id:'qa-application',workflow_id:'qa-workflow',environment:'live',session_id:sessionId,vendor_data:ids.outsider,webhook_type:'status.updated',status:'Approved',decision:{id_verifications:[{status:'Approved'}],liveness_checks:[{status:'Approved'}],face_matches:[{status:'Approved'}]}};
 const webhook=async(body,sig)=>fetch(base+'/api/identity/didit',{method:'POST',headers:{'Content-Type':'application/json','X-Timestamp':String(stamp),'X-Signature-V2':sig??createHmac('sha256',secret).update(canonicalJson(body)).digest('hex')},body:JSON.stringify(body)});
 assert.equal((await webhook(event,'00'.repeat(32))).status,401);
 assert.equal((await webhook({...event,timestamp:stamp-600})).status,401);
 assert.equal((await webhook({...event,environment:'sandbox'})).status,400);
 assert.equal((await webhook({...event,workflow_id:'other'})).status,400);
 assert.equal((await webhook(event)).status,204);
 assert.equal((await db.identityCheck.findUnique({where:{userId:ids.outsider}})).status,'VERIFIED');
 await webhook(event);assert.equal(await db.identityEvent.count({where:{userId:ids.outsider}}),1);
 assert.equal((await webhook({...event,event_id:`decline-${suffix}`,created_at:stamp+1,status:'Declined'})).status,204);
 assert.equal((await db.identityCheck.findUnique({where:{userId:ids.outsider}})).status,'DECLINED');
 await webhook({...event,event_id:`old-${suffix}`});assert.equal((await db.identityCheck.findUnique({where:{userId:ids.outsider}})).status,'DECLINED');
 console.log('PASS: identity gating, attendance ownership, SAST scheduling, rescheduling history, stale confirmations, check-in/out, cancellation/completion locks, private reports, founder-first assignment, staff permissions, suspension, durable idempotent overdue cases, late checkout and signed live-only replay-safe identity callbacks.');
}finally{
 if(server){server.kill('SIGTERM');await new Promise(resolve=>{server.once('exit',resolve);setTimeout(resolve,5000).unref();});}
 const cases=await db.safetyCase.findMany({where:{collaborationId:projectId},select:{id:true}});
 await db.safetyAudit.deleteMany({where:{caseId:{in:cases.map(c=>c.id)}}});await db.safetyCase.deleteMany({where:{collaborationId:projectId}});
 await db.activity.deleteMany({where:{collaborationId:projectId}});await db.collaboration.deleteMany({where:{id:projectId}});
 await db.business.deleteMany({where:{id:{in:[ba,bb]}}});await db.user.deleteMany({where:{id:{in:Object.values(ids)}}});await db.$disconnect();
 console.log('Temporary safety fixtures and isolated test server removed.');
}
