import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import manifest from '../src/app/manifest.ts';
const source=readFileSync(new URL('../public/sw.js',import.meta.url),'utf8');
function worker(online=true) {
 const handlers={},cached=[],deleted=[];let claims=0,skips=0,network=0;
 const fallback=new Response('PUBLIC_OFFLINE_FALLBACK');
 const context={URL,Response,self:{location:{origin:'https://app.example'},clients:{claim:async()=>{claims++;}},skipWaiting:()=>{skips++;},addEventListener:(name,handler)=>{handlers[name]=handler;}},caches:{open:async()=>({addAll:async assets=>cached.push(...assets)}),keys:async()=>['business-collab-public-v0','another-app-cache','business-collab-public-v1'],delete:async key=>{deleted.push(key);},match:async path=>path==='/offline.html'?fallback.clone():undefined},fetch:async(request,options)=>{network++;assert.equal(options.cache,'no-store');if(!online)throw new Error('Disconnected');return new Response('PRIVATE_NETWORK_RESPONSE');}};
 vm.runInNewContext(source,context);
 return {handlers,cached,deleted,claims:()=>claims,skips:()=>skips,network:()=>network};
}
test('manifest uses scoped standalone launch and real suitably sized icons',()=>{
 const data=manifest();assert.equal(data.display,'standalone');assert.equal(data.start_url,'/');assert.equal(data.scope,'/');
 for(const size of [192,512]){const bytes=readFileSync(new URL(`../public/icons/icon-${size}.png`,import.meta.url));assert.equal(bytes.readUInt32BE(16),size);assert.equal(bytes.readUInt32BE(20),size);assert.ok(data.icons.some(i=>i.sizes===`${size}x${size}`));}
 assert.ok(data.icons.some(i=>i.purpose==='maskable'));
});
test('service worker caches only public fallback assets and cleans only its own old cache',async()=>{
 const w=worker();let install;w.handlers.install({waitUntil:p=>{install=p;}});await install;assert.deepEqual(w.cached,['/offline.html','/icons/icon-192.png','/icons/icon-512.png']);
 let activation;w.handlers.activate({waitUntil:p=>{activation=p;}});await activation;assert.deepEqual(w.deleted,['business-collab-public-v0']);assert.equal(w.claims(),1);assert.equal(w.skips(),0,'An update does not automatically replace a worker');
 w.handlers.message({data:{type:'ACTIVATE_UPDATE'}});assert.equal(w.skips(),1);
});
test('API calls, private data fetches, writes and cross-origin requests are never intercepted',()=>{
 const w=worker(false);
 for(const request of [{method:'POST',mode:'navigate',url:'https://app.example/safety'},{method:'GET',mode:'cors',url:'https://app.example/api/auth/get-session'},{method:'GET',mode:'cors',url:'https://app.example/messages?_rsc=abc'},{method:'GET',mode:'navigate',url:'https://other.example/'}])w.handlers.fetch({request,respondWith:()=>assert.fail('Must not intercept')});
 assert.equal(w.network(),0);
});
test('offline navigation returns generic fallback without cached private content or false saved confirmation',async()=>{
 const w=worker(false);let response;w.handlers.fetch({request:{method:'GET',mode:'navigate',url:'https://app.example/safety/private-case'},respondWith:p=>{response=p;}});
 assert.equal(await (await response).text(),'PUBLIC_OFFLINE_FALLBACK');
 const offline=readFileSync(new URL('../public/offline.html',import.meta.url),'utf8');assert.ok(offline.includes('cannot send an alert'));assert.ok(offline.includes('need a connection'));
});
test('online navigation uses the network without storing its authenticated response',async()=>{
 const w=worker();let response;w.handlers.fetch({request:{method:'GET',mode:'navigate',url:'https://app.example/messages'},respondWith:p=>{response=p;}});assert.equal(await (await response).text(),'PRIVATE_NETWORK_RESPONSE');assert.deepEqual(w.cached,[]);
});
