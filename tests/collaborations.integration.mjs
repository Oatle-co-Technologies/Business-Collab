import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {randomBytes} from 'node:crypto';
const root=fileURLToPath(new URL('../',import.meta.url)).replace(/\/$/,'');
const {encodeReply}=createRequire(`${root}/package.json`)('next/dist/compiled/react-server-dom-webpack/client.node.js');
const base=process.env.TEST_APP_URL||'http://127.0.0.1:3000';
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname),'Local testing only.');
const suffix=randomBytes(5).toString('hex');
const password=randomBytes(24).toString('base64url');
const users=[],businesses=[],requests=[];
const sql=query=>execFileSync('psql',['-d','business_collab','-At','-v','ON_ERROR_STOP=1','-c',query],{encoding:'utf8'}).trim();
const id=value=>{assert.match(value,/^[a-zA-Z0-9-]+$/);return value;};
const cookie=response=>response.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ');
const data=values=>{const form=new FormData();for(const [key,value]of Object.entries(values))form.set(key,value);return form;};
let actions;
async function action(name,args,session='') {
 const encoded=await encodeReply(args);
 const key=Object.entries(actions.node).find(([,value])=>value.exportedName===name)?.[0];
 assert.ok(key,`${name} must be registered`);
 const response=await fetch(base+'/collaborations/new',{method:'POST',headers:{'Next-Action':key,Origin:base,...(session?{Cookie:session}:{})},body:encoded,redirect:'manual'});
 return {response,text:await response.text()};
}
async function create(user,organizerId,visibility='OPEN') {
 const values={organizerId,title:`QA ${visibility} project ${suffix}`,description:'We need baking and makeup businesses for a client wedding project.',servicesNeeded:'Baking, Makeup',location:'Pretoria',discoveryArea:'Pretoria, Centurion & Johannesburg',visibility};
 const result=await action('createCollaboration',[{},data(values)],user.cookie);
 const redirect=result.response.headers.get('x-action-redirect')||'';
 assert.ok(redirect.includes('/collaborations/'),`creation failed: ${result.text.slice(0,1000)}`);
 const requestId=id(redirect.match(/\/collaborations\/([a-zA-Z0-9-]+)/)[1]);requests.push(requestId);return requestId;
}
const entry=(requestId,businessId)=>id(sql(`SELECT id FROM "CollaborationParticipant" WHERE "collaborationId"='${requestId}' AND "businessId"='${businessId}'`));
const status=entryId=>sql(`SELECT status FROM "CollaborationParticipant" WHERE id='${entryId}'`);
try {
 for(const label of ['a','b','c']) {
  const email=`collaboration-qa-${label}-${suffix}@example.com`;
  const response=await fetch(base+'/api/auth/sign-up/email',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({name:`Collaboration QA ${label}`,email,password})});
  assert.equal(response.status,200,`sign-up failed: ${response.status}`);
  const body=await response.json();users.push({id:id(body.user.id),email,cookie:cookie(response)});
 }
 for(const user of users)sql(`INSERT INTO "IdentityCheck" ("userId",provider,status,"updatedAt") VALUES ('${user.id}','TEST_ONLY','VERIFIED',now())`);
 const [a,b,c]=users;
 function business(owner,label,published=true) {
  const businessId=`qa-collab-${label}-${suffix}`;businesses.push(businessId);
  sql(`INSERT INTO "Business" (id,"ownerId",name,description,location,"discoveryArea",categories,email,phone,published,"updatedAt") VALUES ('${businessId}','${owner.id}','Temporary Collab ${label}','Temporary collaboration test business.','Pretoria','Pretoria, Centurion & Johannesburg',ARRAY['Baking'],'qa-${suffix}@example.com','0125550100',${published},now());`);
  return businessId;
 }
 const ba=business(a,'organizer'),ba2=business(a,'same-owner'),bb=business(b,'invitee'),bc=business(c,'applicant'),draft=business(b,'draft',false);
 await fetch(base+'/collaborations/new',{headers:{Cookie:a.cookie}}).then(r=>r.text());
 actions=JSON.parse(readFileSync(`${root}/.next/dev/server/server-reference-manifest.json`,'utf8'));
 const requestId=await create(a,ba);
 const invalidCreate=await action('createCollaboration',[{},data({organizerId:ba,title:'Forged organizer request',description:'This is an invalid attempt to organise for another owner.',servicesNeeded:'Baking',location:'Pretoria',discoveryArea:'Gauteng',visibility:'OPEN'})],b.cookie);
 assert.ok(invalidCreate.text.includes('published business that you own'));
 const anonymous=await action('sendInvitation',[{},data({collaborationId:requestId,businessId:bb,note:''})]);assert.ok(anonymous.text.includes('Please sign in'));
 const wrongInviter=await action('sendInvitation',[{},data({collaborationId:requestId,businessId:bc,note:''})],b.cookie);assert.ok(wrongInviter.text.includes('permission'));
 const self=await action('sendInvitation',[{},data({collaborationId:requestId,businessId:ba2,note:''})],a.cookie);assert.ok(self.text.includes('own businesses'));
 const draftInvite=await action('sendInvitation',[{},data({collaborationId:requestId,businessId:draft,note:''})],a.cookie);assert.ok(draftInvite.text.includes('published business'));
 const sent=await action('sendInvitation',[{},data({collaborationId:requestId,businessId:bb,note:'PRIVATE_INVITATION_FOR_B'})],a.cookie);assert.ok(sent.text.includes('Invitation sent'));
 assert.equal(sql(`SELECT count(*) FROM "Notification" WHERE "userId"='${b.id}' AND title='New collaboration invitation'`),'1');
 const invited=entry(requestId,bb);assert.equal(status(invited),'PENDING');
 const duplicate=await action('sendInvitation',[{},data({collaborationId:requestId,businessId:bb,note:''})],a.cookie);assert.ok(duplicate.text.includes('already applied or been invited'));
 const forgedResponse=await action('respondToInvitation',[invited,{},data({decision:'accept',note:''})],c.cookie);assert.ok(forgedResponse.text.includes('permission'));
 const premature=await action('reviewApplicant',[invited,{},data({decision:'select'})],a.cookie);assert.ok(premature.text.includes('no longer available'));assert.equal(status(invited),'PENDING');
 const accepted=await action('respondToInvitation',[invited,{},data({decision:'accept',note:'PRIVATE_RESPONSE_FROM_B'})],b.cookie);assert.ok(accepted.text.includes('Interest confirmed'));assert.equal(status(invited),'INTERESTED');
 const wrongBusiness=await action('applyToCollaboration',[requestId,{},data({businessId:bb,note:''})],c.cookie);assert.ok(wrongBusiness.text.includes('business that you own'));
 const selfApply=await action('applyToCollaboration',[requestId,{},data({businessId:ba2,note:''})],a.cookie);assert.ok(selfApply.text.includes('own request'));
 const applied=await action('applyToCollaboration',[requestId,{},data({businessId:bc,note:'PRIVATE_APPLICATION_FROM_C'})],c.cookie);assert.ok(applied.text.includes('interest has been sent'));
 const application=entry(requestId,bc);assert.equal(status(application),'INTERESTED');
 const duplicateApply=await action('applyToCollaboration',[requestId,{},data({businessId:bb,note:''})],b.cookie);assert.ok(duplicateApply.text.includes('already applied or been invited'));
 const bView=await fetch(base+`/collaborations/${requestId}`,{headers:{Cookie:b.cookie}}).then(r=>r.text());assert.ok(!bView.includes('PRIVATE_APPLICATION_FROM_C'));assert.ok(bView.includes('PRIVATE_INVITATION_FOR_B'));
 const cView=await fetch(base+`/collaborations/${requestId}`,{headers:{Cookie:c.cookie}}).then(r=>r.text());assert.ok(!cView.includes('PRIVATE_RESPONSE_FROM_B'));
 const forgedSelect=await action('reviewApplicant',[application,{},data({decision:'select'})],b.cookie);assert.ok(forgedSelect.text.includes('Only the organiser'));
 const selected=await action('reviewApplicant',[invited,{},data({decision:'select'})],a.cookie);assert.ok(selected.text.includes('updated'));assert.equal(status(invited),'SELECTED');
 await action('reviewApplicant',[application,{},data({decision:'reject'})],a.cookie);assert.equal(status(application),'NOT_SELECTED');
 const wrongClose=await action('setCollaborationStatus',[requestId,{},data({status:'CLOSED'})],b.cookie);assert.ok(wrongClose.text.includes('Only the organiser'));
 await action('setCollaborationStatus',[requestId,{},data({status:'CLOSED'})],a.cookie);
 const closedInvite=await action('sendInvitation',[{},data({collaborationId:requestId,businessId:bc,note:''})],a.cookie);assert.ok(closedInvite.text.includes('Reopen'));
 const closedApply=await action('applyToCollaboration',[requestId,{},data({businessId:bb,note:''})],b.cookie);assert.ok(closedApply.text.includes('closed to new responses'));
 await action('respondToInvitation',[invited,{},data({decision:'withdraw',note:''})],b.cookie);assert.equal(status(invited),'WITHDRAWN');
 await action('setCollaborationStatus',[requestId,{},data({status:'OPEN'})],a.cookie);assert.equal(sql(`SELECT status FROM "Collaboration" WHERE id='${requestId}'`),'OPEN');
 const privateId=await create(a,ba,'INVITE_ONLY');
 const privateTitle=`QA INVITE_ONLY project ${suffix}`;
 const privateView=await fetch(base+`/collaborations/${privateId}`,{headers:{Cookie:b.cookie}}).then(r=>r.text());assert.ok(!privateView.includes(privateTitle));
 const privateApply=await action('applyToCollaboration',[privateId,{},data({businessId:bb,note:''})],b.cookie);assert.ok(privateApply.text.includes('not open to applications'));
 await action('sendInvitation',[{},data({collaborationId:privateId,businessId:bc,note:'PRIVATE_INVITATION_FOR_C'})],a.cookie);
 const privateEntry=entry(privateId,bc);
 const invitedView=await fetch(base+`/collaborations/${privateId}`,{headers:{Cookie:c.cookie}}).then(r=>r.text());assert.ok(invitedView.includes(privateTitle));
 await action('respondToInvitation',[privateEntry,{},data({decision:'decline',note:''})],c.cookie);assert.equal(status(privateEntry),'DECLINED');
 const bHub=await fetch(base+'/collaborations',{headers:{Cookie:b.cookie}}).then(r=>r.text());assert.ok(!bHub.includes(privateTitle));
 console.log('PASS: request creation, organizer ownership, self/duplicate prevention, invitations, consent before selection, open applications, private notes, invite-only access, accept/decline, selection/rejection, closed-request rules, withdrawal and reopening.');
} finally {
 for(const requestId of requests)sql(`DELETE FROM "Collaboration" WHERE id='${id(requestId)}'`);
 for(const businessId of businesses)sql(`DELETE FROM "Business" WHERE id='${id(businessId)}'`);
 for(const user of users)sql(`DELETE FROM "User" WHERE id='${id(user.id)}' AND email='${user.email}'`);
 console.log('Temporary collaboration test accounts, requests and profiles removed.');
}
