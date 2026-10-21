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
 const response=await fetch(base+'/messages',{method:'POST',headers:{'Next-Action':key,Origin:base,...(session?{Cookie:session}:{})},body:encoded,redirect:'manual'});
 return {response,text:await response.text()};
}
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
 const ba=business(a,'organizer'),bb=business(b,'invitee'),bc=business(c,'applicant');
 await fetch(base+'/messages',{headers:{Cookie:a.cookie}}).then(r=>r.text());
 actions=JSON.parse(readFileSync(`${root}/.next/dev/server/server-reference-manifest.json`,'utf8'));

 const project=`qa-review-project-${suffix}`;requests.push(project);
 const selected=`qa-review-selected-${suffix}`;
 const outsider=`qa-review-outsider-${suffix}`;
 const sameOwner=business(a,'same-owner');
 sql(`INSERT INTO "Collaboration" (id,"organizerId",title,description,"servicesNeeded",location,"discoveryArea",visibility,"updatedAt") VALUES ('${project}','${ba}','PRIVATE_REVIEW_PROJECT_${suffix}','Temporary completed project',ARRAY['Baking'],'Pretoria','Gauteng','INVITE_ONLY',now());`);
 await fetch(base+`/collaborations/${project}`,{headers:{Cookie:a.cookie}}).then(r=>r.text());
 actions=JSON.parse(readFileSync(`${root}/.next/dev/server/server-reference-manifest.json`,'utf8'));
 const complete=(user,confirm='yes')=>action('completeCollaboration',[project,{},data({confirm})],user?.cookie);
 const review=(user,authorId,targetId,rating='5',body='REVIEW_PROOF: Excellent communication and reliable collaboration.')=>action('leaveReview',[project,{},data({authorId,targetId,rating,body})],user?.cookie);
 assert.ok((await complete(null)).text.includes('Please sign in'));
 assert.ok((await complete(b)).text.includes('Only the organiser'));
 assert.ok((await complete(a)).text.includes('Select at least one'));
 sql(`INSERT INTO "CollaborationParticipant" (id,"collaborationId","businessId",source,status,"updatedAt") VALUES ('${selected}','${project}','${bb}','INVITATION','SELECTED',now()),('${outsider}','${project}','${bc}','APPLICATION','INTERESTED',now()),('qa-review-same-${suffix}','${project}','${sameOwner}','APPLICATION','SELECTED',now())`);
 assert.ok((await review(a,ba,bb)).text.includes('only after'));
 assert.ok((await complete(a,'')).text.includes('Confirm that'));
 await action('setCollaborationStatus',[project,{},data({status:'CLOSED'})],a.cookie);
 assert.ok((await complete(a)).text.includes('Collaboration completed'));
 assert.equal(sql(`SELECT status FROM "Collaboration" WHERE id='${project}'`),'COMPLETED');
 assert.equal(sql(`SELECT count(*) FROM "Notification" WHERE "userId"='${b.id}' AND title LIKE 'Collaboration completed%'`),'1');
 assert.ok((await action('setCollaborationStatus',[project,{},data({status:'OPEN'})],a.cookie)).text.includes('cannot be reopened'));
 assert.ok((await action('respondToInvitation',[selected,{},data({decision:'withdraw'})],b.cookie)).text.includes('cannot change'));
 assert.ok((await action('reviewApplicant',[selected,{},data({decision:'unselect'})],a.cookie)).text.includes('cannot change'));
 assert.ok((await complete(a)).text.includes('already complete'));
 assert.ok((await review(c,bc,bb)).text.includes('only another business'));
 assert.ok((await review(a,bb,ba)).text.includes('only another business'));
 assert.ok((await review(a,ba,ba)).text.includes('only another business'));
 assert.ok((await review(a,ba,sameOwner)).text.includes('only another business'));
 assert.ok((await review(a,ba,bc)).text.includes('only another business'));
 assert.ok((await review(a,ba,bb,'6')).text.includes('rating'));
 assert.ok((await review(a,ba,bb,'5','short')).text.includes('10 characters'));
 assert.ok((await review(a,ba,bb)).text.includes('Review published'));
 assert.ok((await review(a,ba,bb)).text.includes('already reviewed'));
 assert.ok((await review(b,bb,ba,'4','Reverse review: A helpful and well-organised project.')).text.includes('Review published'));
 const profile=await fetch(base+`/businesses/${bb}`,{headers:{Cookie:c.cookie}}).then(r=>r.text());
 assert.ok(profile.includes('REVIEW_PROOF'));assert.ok(!profile.includes('PRIVATE_REVIEW_PROJECT_'));
 assert.equal(sql(`SELECT count(*) FROM "Review" WHERE "collaborationId"='${project}'`),'2');
 sql(`INSERT INTO "BusinessMedia" (id,"businessId",kind,position,"contentType",data,"updatedAt") VALUES ('qa-review-video-${suffix}','${bb}','INTRODUCTION',0,'video/mp4',decode('00','hex'),now())`);
 const feed=await fetch(base+'/?area=Pretoria%2C%20Centurion%20%26%20Johannesburg',{headers:{Cookie:c.cookie}}).then(r=>r.text());assert.ok(feed.includes('5.0 out of 5'));
 console.log('PASS: organiser-only confirmed completion, final-team lock, no reopening, eligible participant reviews only, no spoof/self/duplicate/invalid reviews, reciprocal reviews, notifications, profile privacy and feed ratings.');
} finally {
 for(const requestId of requests)sql(`DELETE FROM "Collaboration" WHERE id='${id(requestId)}'`);
 for(const businessId of businesses)sql(`DELETE FROM "Business" WHERE id='${id(businessId)}'`);
 for(const user of users)sql(`DELETE FROM "User" WHERE id='${id(user.id)}' AND email='${user.email}'`);
 console.log('Temporary completion/review test data removed.');
}
