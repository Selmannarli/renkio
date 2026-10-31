// Isolated account-ledger integration. Firebase anonymous identities only; no live game data.
import assert from 'node:assert/strict';import {firebaseConfig} from '../public/firebase-config.mjs';import{mkdtemp,writeFile,readFile,rm}from'node:fs/promises';import{tmpdir}from'node:os';import path from'node:path';import{spawn}from'node:child_process';import{createHash}from'node:crypto';
const firebase=async(method,body)=>{const r=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:'+method+'?key='+firebaseConfig.apiKey,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});const v=await r.json();if(!r.ok)throw Error(v.error?.message||'Test authentication failed');return v};
const accounts=[];let child;const dir=await mkdtemp(path.join(tmpdir(),'renkio-tutorial-'));let url;
const stop=async()=>{if(child){const done=new Promise(r=>child.once('exit',r));child.kill();await done;child=null}};
const start=()=>new Promise((resolve,reject)=>{child=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:'0',RENKIO_DATA:dir,FIREBASE_ADMIN_JSON:''}});child.stdout.on('data',b=>{const m=String(b).match(/http:\/\/localhost:\d+/);if(m){url=m[0];resolve()}});child.on('error',reject);child.on('exit',code=>{if(code)reject(Error('Test server exited'))})});
const call=async(route,i,body={})=>{const r=await fetch(url+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,accountToken:accounts[i]?.idToken}),signal:AbortSignal.timeout(20000)});return {status:r.status,body:await r.json()}};
try{
 for(let i=0;i<2;i++)accounts.push(await firebase('signUp',{returnSecureToken:true}));
 const id=(BigInt('0x'+createHash('sha256').update(accounts[1].localId).digest('hex').slice(0,16))%800000000000n+100000000000n).toString();
 await writeFile(path.join(dir,'social.json'),JSON.stringify({profiles:{[id]:{name:'Existing tutorial QA',wins:73,diamonds:777,createdAt:1}},matches:[],directMessages:[]}));
 await start();
 for(let i=0;i<2;i++){const r=await call('tutorial',i);assert.equal(r.status,200);assert.equal(r.body.tutorial,null)}
 assert.equal((await call('tutorial/finish',0,{version:1,status:'completed'})).body.tutorial.status,'completed');
 assert.equal((await call('tutorial/finish',1,{version:1,status:'skipped'})).body.tutorial.status,'skipped');
 // Independent HTTP client/session reads server-owned progress, without browser storage.
 assert.equal((await call('tutorial',0)).body.tutorial.status,'completed');assert.equal((await call('tutorial',1)).body.tutorial.status,'skipped');
 assert.equal((await call('tutorial/finish',0,{version:1,status:'skipped'})).body.tutorial.status,'completed');
 assert.equal((await call('tutorial/finish',0,{version:99,status:'completed'})).status,400);
 assert.equal((await call('tutorial',99)).status,400);
 await stop();await start();assert.equal((await call('tutorial',0)).body.tutorial.status,'completed');assert.equal((await call('tutorial',1)).body.tutorial.status,'skipped');
 await stop();const saved=JSON.parse(await readFile(path.join(dir,'social.json'),'utf8'));assert.equal(saved.profiles[id].wins,73);assert.equal(saved.profiles[id].diamonds,777);assert.equal(saved.matches.length,0);
 console.log('PASS: authenticated fresh + pre-existing profiles; terminal completion/skip; independent device reads; idempotence; auth/version checks; server restart; stats, wallet and match archive preserved.');
}finally{await stop();for(const a of accounts)await firebase('delete',{idToken:a.idToken}).catch(()=>console.error('Temporary anonymous QA account cleanup requires retry'));const target=path.resolve(dir);if(!target.startsWith(path.resolve(tmpdir())+path.sep)||!path.basename(target).startsWith('renkio-tutorial-'))throw Error('Unexpected test directory');await rm(target,{recursive:true,force:true})}
