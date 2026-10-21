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

 const profile=await fetch(base+`/businesses/${bb}`,{headers:{Cookie:a.cookie}}).then(r=>r.text());
 assert.ok(!profile.includes("Message business"));
 actions=JSON.parse(readFileSync(`${root}/.next/dev/server/server-reference-manifest.json`,'utf8'));
 const start=async(user,values)=>action('startChat',[{},data(values)],user?.cookie);
 assert.ok((await start(a,{businessId:ba,targetId:bb})).text.includes('only after an invited'));
 const project=`qa-chat-project-${suffix}`;requests.push(project);
 const entryId=`qa-chat-entry-${suffix}`;
 sql(`INSERT INTO "Collaboration" (id,"organizerId",title,description,"servicesNeeded",location,"discoveryArea","updatedAt") VALUES ('${project}','${ba}','QA chat project','Temporary group chat',ARRAY['Baking'],'Pretoria','Gauteng',now()); INSERT INTO "CollaborationParticipant" (id,"collaborationId","businessId",source,status,"updatedAt") VALUES ('${entryId}','${project}','${bb}','INVITATION','PENDING',now());`);
 const pendingPage=await fetch(base+`/collaborations/${project}`,{headers:{Cookie:a.cookie}}).then(r=>r.text());
 assert.ok(!pendingPage.includes("Message about this role"));
 actions=JSON.parse(readFileSync(`${root}/.next/dev/server/server-reference-manifest.json`,'utf8'));
 const invitationValues={entryId};
 assert.ok((await start(a,invitationValues)).text.includes('only after an invited'));
 sql(`UPDATE "CollaborationParticipant" SET status='INTERESTED' WHERE id='${entryId}'`);
 assert.ok((await start(c,invitationValues)).text.includes('Only the organiser'));
 const interestedPage=await fetch(base+`/collaborations/${project}`,{headers:{Cookie:b.cookie}}).then(r=>r.text());
 assert.ok(interestedPage.includes("Message about this role"));
 const legacy=`qa-legacy-chat-${suffix}`;
 sql(`INSERT INTO "Conversation" (id,"businessIds","updatedAt") VALUES ('${legacy}',ARRAY['${ba}','${bb}'],now())`);
 const legacyPage=await fetch(base+`/messages/${legacy}`,{headers:{Cookie:a.cookie}}).then(r=>r.text());
 assert.ok(!legacyPage.includes("Send message"));
 const result=await start(b,invitationValues);
 const chatId=id(result.response.headers.get('x-action-redirect').match(/messages\/([a-zA-Z0-9-]+)/)[1]);
 await fetch(base+`/messages/${chatId}`,{headers:{Cookie:a.cookie}}).then(r=>r.text());
 await fetch(base+'/notifications',{headers:{Cookie:a.cookie}}).then(r=>r.text());
 actions=JSON.parse(readFileSync(`${root}/.next/dev/server/server-reference-manifest.json`,'utf8'));
 const send=(user,senderId,body,chat=chatId)=>action('sendMessage',[chat,{},data({senderId,body})],user?.cookie);
 assert.ok((await send(null,ba,'anonymous')).text.includes('Please sign in'));
 assert.ok((await send(c,bc,'intruder')).text.includes('cannot send'));
 assert.ok((await send(a,bb,'spoof')).text.includes('cannot send'));
 assert.ok((await send(a,ba,'PRIVATE_CHAT_PROOF')).text.includes('Message sent'));
 assert.equal(sql(`SELECT count(*) FROM "Notification" WHERE "userId"='${b.id}' AND "readAt" IS NULL`),'1');
 const outsider=await fetch(base+`/messages/${chatId}`,{headers:{Cookie:c.cookie}}).then(r=>r.text());assert.ok(!outsider.includes('PRIVATE_CHAT_PROOF'));
 const recipient=await fetch(base+`/messages/${chatId}`,{headers:{Cookie:b.cookie}}).then(r=>r.text());assert.ok(recipient.includes('PRIVATE_CHAT_PROOF'));
 const unread=await fetch(base+'/messages',{headers:{Cookie:b.cookie}}).then(r=>r.text());assert.ok(unread.includes('Unread'));
 await action('markChatRead',[chatId,{},data({})],b.cookie);
 assert.equal(sql(`SELECT count(*) FROM "Notification" WHERE "userId"='${b.id}' AND "readAt" IS NULL`),'0');
 await action('blockChat',[chatId,{},data({})],b.cookie);
 assert.ok((await send(a,ba,'blocked message')).text.includes('unavailable'));
 assert.ok((await start(a,invitationValues)).text.includes('unavailable'));
 await action('blockChat',[chatId,{},data({unblock:'yes'})],a.cookie);
 assert.ok((await send(a,ba,'still blocked')).text.includes('unavailable'));
 const mid=id(sql(`SELECT id FROM "ChatMessage" WHERE "conversationId"='${chatId}' LIMIT 1`));
 assert.ok((await action('reportMessage',[chatId,{},data({messageId:mid,reason:'A private test report'})],b.cookie)).text.includes('Report saved'));
 assert.ok((await action('reportMessage',[chatId,{},data({messageId:mid,reason:'Forged report'})],c.cookie)).text.includes('unavailable'));
 await action('blockChat',[chatId,{},data({unblock:'yes'})],b.cookie);
 assert.ok((await send(a,ba,'unblocked message')).text.includes('Message sent'));
 sql(`UPDATE "CollaborationParticipant" SET status='NOT_SELECTED' WHERE id='${entryId}'`);
 assert.ok((await send(b,bb,'revoked private message')).text.includes('cannot send'));
 const hidden=await fetch(base+`/messages/${chatId}`,{headers:{Cookie:b.cookie}}).then(r=>r.text());assert.ok(!hidden.includes('PRIVATE_CHAT_PROOF'));
 const hiddenInbox=await fetch(base+'/messages',{headers:{Cookie:b.cookie}}).then(r=>r.text());assert.ok(!hiddenInbox.includes(`/messages/${chatId}`));
 sql(`UPDATE "CollaborationParticipant" SET source='APPLICATION',status='INTERESTED' WHERE id='${entryId}'`);
 assert.ok((await start(a,invitationValues)).text.includes('only after an invited'));
 sql(`UPDATE "CollaborationParticipant" SET source='INVITATION',status='SELECTED' WHERE id='${entryId}'`);
 const group=await start(a,{collaborationId:project});const gid=id(group.response.headers.get('x-action-redirect').match(/messages\/([a-zA-Z0-9-]+)/)[1]);
 assert.ok((await start(c,{collaborationId:project})).text.includes('Only the organiser'));
 assert.ok((await send(b,bb,'TEAM_CHAT_PROOF',gid)).text.includes('Message sent'));
 sql(`UPDATE "CollaborationParticipant" SET status='WITHDRAWN' WHERE "collaborationId"='${project}'`);
 assert.ok((await send(b,bb,'revoked',gid)).text.includes('cannot send'));
 const revoked=await fetch(base+`/messages/${gid}`,{headers:{Cookie:b.cookie}}).then(r=>r.text());assert.ok(!revoked.includes('TEAM_CHAT_PROOF'));
 console.log('PASS: invitation-scoped chat, no random messaging, pending invitation and open application denial, revoked private access, private chat ownership, anonymous and outsider denial, sender spoofing, unread/read alerts, owner-wide blocking/unblocking, private reports, project membership and immediate revocation.');
} finally {
 for(const user of users){sql(`DELETE FROM "SafetyAudit" WHERE "caseId" IN (SELECT id FROM "SafetyCase" WHERE "reporterId"='${id(user.id)}')`);sql(`DELETE FROM "Notification" WHERE href IN (SELECT '/safety/' || id FROM "SafetyCase" WHERE "reporterId"='${id(user.id)}')`);sql(`DELETE FROM "SafetyCase" WHERE "reporterId"='${id(user.id)}'`);}
 for(const bid of businesses)sql(`DELETE FROM "Conversation" WHERE "businessIds" @> ARRAY['${id(bid)}']::text[]`);
 for(const requestId of requests)sql(`DELETE FROM "Collaboration" WHERE id='${id(requestId)}'`);
 for(const businessId of businesses)sql(`DELETE FROM "Business" WHERE id='${id(businessId)}'`);
 for(const user of users)sql(`DELETE FROM "User" WHERE id='${id(user.id)}' AND email='${user.email}'`);
 console.log('Temporary chat test data removed.');
}
