import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
const root=fileURLToPath(new URL('../',import.meta.url)).replace(/\/$/,'');
const require=createRequire(`${root}/package.json`);
const {encodeReply}=require('next/dist/compiled/react-server-dom-webpack/client.node.js');
const base=process.env.TEST_APP_URL || 'http://127.0.0.1:3000';
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname),'Account integration tests are local-only.');
const suffix=randomBytes(5).toString('hex');
const password=randomBytes(24).toString('base64url');
const users=[];
const businesses=[];
const sql=query=>execFileSync('psql',['-d','business_collab','-At','-v','ON_ERROR_STOP=1','-c',query],{encoding:'utf8'}).trim();
const cleanId=id=>{assert.match(id,/^[a-zA-Z0-9-]+$/);return id;};
const api=async(path,body,cookie='')=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:base,...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(body)});
const cookies=response=>response.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ');
let actionId;
const form=()=>{
 const data=new FormData();
 const values={name:`Ownership QA ${suffix}`,description:'Temporary account ownership test business.',location:'Pretoria',discoveryArea:'Pretoria, Centurion & Johannesburg',industry:'Catering',categories:'Catering',email:`business-${suffix}@example.com`,phone:'0125550100',website:'',portfolio:'',intent:'draft'};
 for(const [key,value] of Object.entries(values)) data.set(key,value);
 return data;
};
const save=async(id,cookie,data=form())=>{
 const body=await encodeReply([id,{},data]);
 return fetch(base+'/businesses/new',{method:'POST',headers:{'Next-Action':actionId,Origin:base,...(cookie?{Cookie:cookie}:{})},body,redirect:'manual'});
};
try {
 for(const label of ['a','b']) {
  const email=`ownership-${label}-${suffix}@example.com`;
  const response=await api('/api/auth/sign-up/email',{name:`Ownership QA ${label}`,email,password});
  assert.equal(response.status,200,`sign-up ${label} failed: ${response.status} ${(await response.clone().text()).slice(0,500)}`);
  const data=await response.json();
  users.push({id:cleanId(data.user.id),email,cookie:cookies(response)});
  assert.ok(users.at(-1).cookie.includes('session_token'));
  assert.match(response.headers.getSetCookie().join(' '),/HttpOnly/i);
 }
 for(const user of users)sql(`INSERT INTO "IdentityCheck" ("userId",provider,status,"updatedAt") VALUES ('${user.id}','TEST_ONLY','VERIFIED',now())`);
 const [a,b]=users;
 const duplicate=await api('/api/auth/sign-up/email',{name:'Duplicate',email:a.email,password});
 assert.ok(duplicate.status>=400,'duplicate account must be rejected');
 const badLogin=await api('/api/auth/sign-in/email',{email:a.email,password:'incorrect-password-123'});
 assert.ok(badLogin.status>=400,'incorrect password must fail');
 const hashed=sql(`SELECT password FROM "Account" WHERE "userId"='${a.id}' AND "providerId"='credential'`);
 assert.ok(hashed && hashed!==password,'only a password hash may be stored');
 await fetch(base+'/businesses/new',{headers:{Cookie:a.cookie}}).then(r=>r.text());
 const manifest=JSON.parse(readFileSync(`${root}/.next/dev/server/server-reference-manifest.json`,'utf8'));
 actionId=Object.entries(manifest.node).find(([,entry])=>entry.exportedName==='saveBusiness')?.[0];
 assert.ok(actionId,'saveBusiness server action must be registered');
 const createData=form();createData.set('ownerId',b.id);
 const created=await save(null,a.cookie,createData);
 const redirect=created.headers.get('x-action-redirect')??created.headers.get('location')??'';
 assert.ok(redirect.includes('/businesses/'),`save did not redirect: ${created.status} ${(await created.text()).slice(0,1000)}`);
 const id=cleanId(redirect.match(/\/businesses\/([a-zA-Z0-9-]+)/)[1]);businesses.push(id);
 assert.equal(sql(`SELECT "ownerId" FROM "Business" WHERE id='${id}'`),a.id,'ownerId in form must be ignored');
 const mediaId=`qa-private-media-${suffix}`;
 sql(`UPDATE "Business" SET logo=decode('00','hex') WHERE id='${id}'; INSERT INTO "BusinessMedia" (id,"businessId",kind,position,"contentType",data,"updatedAt") VALUES ('${mediaId}','${id}','PHOTO',0,'image/webp',decode('00','hex'),now());`);
 const ownEdit=await fetch(base+`/businesses/${id}/edit`,{headers:{Cookie:a.cookie}}).then(r=>r.text());
 assert.ok(ownEdit.includes('Edit business profile'));
 const myA=await fetch(base+'/my-businesses',{headers:{Cookie:a.cookie}}).then(r=>r.text());
 const myB=await fetch(base+'/my-businesses',{headers:{Cookie:b.cookie}}).then(r=>r.text());
 assert.ok(myA.includes(`Ownership QA ${suffix}`));assert.ok(!myB.includes(`Ownership QA ${suffix}`));
 const foreignEdit=await fetch(base+`/businesses/${id}/edit`,{headers:{Cookie:b.cookie}}).then(r=>r.text());
 assert.ok(!foreignEdit.includes('Temporary account ownership test business.'));
 const foreignProfile=await fetch(base+`/businesses/${id}`,{headers:{Cookie:b.cookie}}).then(r=>r.text());
 assert.ok(!foreignProfile.includes('Temporary account ownership test business.'));
 for(const path of [`/businesses/${id}/logo`,`/businesses/${id}/media/${mediaId}`]) {
  assert.equal((await fetch(base+path,{headers:{Cookie:b.cookie}})).status,404,'foreign draft media must be hidden');
  assert.equal((await fetch(base+path)).status,401,'anonymous media must be blocked');
  assert.equal((await fetch(base+path,{headers:{Cookie:a.cookie}})).status,200,'owner must access draft media');
 }
 const forged=form();forged.set('name','UNAUTHORISED EDIT');forged.set('ownerId',b.id);
 const foreignSave=await save(id,b.cookie,forged).then(r=>r.text());
 assert.ok(foreignSave.includes('You do not have access'));
 assert.equal(sql(`SELECT name FROM "Business" WHERE id='${id}'`),`Ownership QA ${suffix}`);
 const anonymous=await save(id,'',forged).then(r=>r.text());assert.ok(anonymous.includes('Please sign in'));
 const ownerUpdate=form();ownerUpdate.set('name',`Updated ownership QA ${suffix}`);
 const ownSave=await save(id,a.cookie,ownerUpdate);assert.ok(ownSave.headers.get('x-action-redirect'));
 assert.equal(sql(`SELECT name FROM "Business" WHERE id='${id}'`),`Updated ownership QA ${suffix}`);
 // Test the read policy for a published profile independently of media completeness.
 sql(`UPDATE "Business" SET published=true WHERE id='${id}'`);
 const publicProfile=await fetch(base+`/businesses/${id}`,{headers:{Cookie:b.cookie}}).then(r=>r.text());
 assert.ok(publicProfile.includes(`Updated ownership QA ${suffix}`));
 assert.ok(!publicProfile.includes('>Edit profile</a>'));
 const publishedForeignEdit=await save(id,b.cookie,forged).then(r=>r.text());assert.ok(publishedForeignEdit.includes('You do not have access'));
 const logout=await api('/api/auth/sign-out',{},a.cookie);assert.equal(logout.status,200);
 const oldSession=await fetch(base+'/api/auth/get-session',{headers:{Cookie:a.cookie}}).then(r=>r.json());assert.equal(oldSession,null,'sign-out must revoke the server session');
 const afterLogout=await save(id,a.cookie,forged).then(r=>r.text());assert.ok(afterLogout.includes('Please sign in'));
 const login=await api('/api/auth/sign-in/email',{email:a.email,password});assert.equal(login.status,200);
 const renewedCookie=cookies(login);assert.ok(renewedCookie.includes('session_token'));
 const newSession=await fetch(base+'/api/auth/get-session',{headers:{Cookie:renewedCookie}}).then(r=>r.json());assert.equal(newSession.user.id,a.id);
 const csrf=await fetch(base+'/api/auth/sign-out',{method:'POST',headers:{'Content-Type':'application/json',Cookie:renewedCookie,Origin:'https://untrusted.example'},body:'{}'});assert.ok(csrf.status>=400);
 console.log('PASS: sign-up, duplicate rejection, password hashing, wrong-password rejection, sign-in, HttpOnly sessions, sign-out revocation, CSRF, owner-only lists/edits/drafts/media, published read-only access, and forged action/ownerId rejection.');
} finally {
 for(const id of businesses) sql(`DELETE FROM "Business" WHERE id='${cleanId(id)}'`);
 for(const user of users) sql(`DELETE FROM "User" WHERE id='${cleanId(user.id)}' AND email='${user.email}'`);
 console.log('Temporary integration-test accounts, sessions and profiles removed.');
}
