import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

async function fixture({signedIn=true,conflict=false}={},check){
 const saved={window:globalThis.window,document:globalThis.document,localStorage:globalThis.localStorage};
 const storage=new Map(),events=new EventTarget(),actions=[];let state={signedIn,migrationDone:true,uid:'device',guest:true,providers:[]},selected='device';
 events.RenkioNative={accountRequest(id,action){actions.push(action);let value;
  if(action==='guest'){state={...state,signedIn:true};value=state}
  else if(action==='token')value={token:state.uid};
  else if(action==='google')value={candidateToken:'google'};
  else if(action==='finishCandidate'){state={signedIn:true,migrationDone:true,uid:'google',guest:false,email:'test@example.invalid',providers:['google.com']};value=state}
  else value=state;
  queueMicrotask(()=>events.dispatchEvent(new CustomEvent('renkio-account-result',{detail:{id,value}})));
 }};
 globalThis.window=events;globalThis.document={body:{dataset:{}}};globalThis.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
 globalThis.__nativeApi=async(url,options)=>{const b=JSON.parse(options.body);assert.equal(b.accountProtocol,2);
  if(url.endsWith('/prepare'))return {ticket:'test',choice:conflict?'conflict':'current',current:{id:'device'},cloud:{id:'cloud'}};
  if(url.endsWith('/commit')){if(b.choice==='keep')return {action:'keep'};selected=b.choice==='cloud'?'cloud':'device';return {action:'switch'}};
  return {id:selected,tag:'12345',name:'Player 12345'};
 };
 try{let source=await readFile(new URL('../public/account-native.mjs',import.meta.url),'utf8');source=source.replace("import {requestApiJson} from './network.mjs';","const requestApiJson=(...args)=>globalThis.__nativeApi(...args);").replace('./identity-policy.mjs',new URL('../public/identity-policy.mjs',import.meta.url).href);const adapter=await import('data:text/javascript;base64,'+Buffer.from(source+'\n// '+crypto.randomUUID()).toString('base64'));await check(adapter,events,actions,()=>state)}
 finally{Object.assign(globalThis,saved);delete globalThis.__nativeApi}
}

test('native first launch waits for an explicit choice instead of creating another guest',()=>fixture({signedIn:false},async(a,e,actions)=>{
 const offered=new Promise(resolve=>e.addEventListener('renkio-account-required',resolve,{once:true}));const initial=a.ensureAccount();await offered;assert.equal(actions.includes('guest'),false);await a.guestAccount();assert.equal((await initial).id,'device');assert.equal(actions.filter(x=>x==='guest').length,1);
}));
test('keeping a conflicting device save never signs into the Google candidate',()=>fixture({conflict:true},async(a,e,actions,state)=>{
 await a.ensureAccount();e.addEventListener('renkio-account-conflict',event=>event.detail.resolve('keep'),{once:true});await a.googleLogin();assert.equal(state().uid,'device');assert.equal(actions.includes('finishCandidate'),false);assert.equal(a.profile.id,'device');
}));
test('successful native Google linking keeps the canonical player and exposes real provider state',()=>fixture({},async(a,_e,actions)=>{
 await a.ensureAccount();await a.googleLogin();assert.equal(a.profile.id,'device');assert.equal(a.profile.nativeUid,'google');assert.deepEqual(a.profile.providers,['google.com']);assert.equal(a.profile.email,'test@example.invalid');assert.ok(actions.includes('finishCandidate'));
}));
