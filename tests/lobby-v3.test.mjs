import test from 'node:test';
import assert from 'node:assert/strict';
import {claimReward,rewardView} from '../rewards.mjs';
import {sendDirect,directMessages,conversationList,migrateRoomMessages,conversationAllowed} from '../conversations.mjs';
import {stateDocuments} from '../durable-state.mjs';
import {makeBonusBoard} from '../public/bonus-rules.mjs';
const rewardDate=day=>Date.UTC(2026,10,day,12);
test('six daily rewards of 10 and a grand prize of 50 cycle without allowing double claims',()=>{
 const profile={},awards=[10,10,10,10,10,10,50];
 let total=0;
 for(let i=0;i<=awards.length;i++){
  const at=rewardDate(i+1),day=i%awards.length,view=rewardView(profile,at);
  assert.deepEqual(view.rewardAmounts,awards);
  assert.equal(view.available,true);
  assert.equal(view.streakDay,day+1);
  assert.equal(view.nextAmount,awards[day]);
  total+=awards[day];
  const claimed=claimReward(profile,at);
  assert.equal(claimed.diamonds,total);
  assert.equal(claimed.streakDay,day+1);
  assert.equal(claimed.available,false);
  assert.equal(claimed.nextAmount,awards[(day+1)%awards.length]);
  assert.throws(()=>claimReward(structuredClone(profile),at),/zaten/);
 }
 assert.equal(total,120);
});
test('a missed Berlin calendar day restarts the streak and preserves balance and claim history',()=>{
 const profile={};
 claimReward(profile,rewardDate(1));
 claimReward(profile,rewardDate(2));
 assert.equal(rewardView(profile,rewardDate(4)).streakDay,1);
 const claimed=claimReward(profile,rewardDate(4));
 assert.equal(claimed.streakDay,1);
 assert.equal(claimed.diamonds,30);
 assert.equal(claimed.claimedDays,3);
});
test('legacy claim history cannot duplicate a reward or fabricate a full streak after migration',()=>{
 const profile={economy:{version:2,diamonds:340,inventory:{joker:4,hint:2},lastClaim:'2026-11-01',claimedDays:64,receipts:[]}};
 assert.equal(rewardView(profile,rewardDate(1)).available,false);
 assert.equal(rewardView(profile,rewardDate(1)).streakDay,1);
 assert.throws(()=>claimReward(profile,rewardDate(1)),/zaten/);
 assert.equal(rewardView(profile,rewardDate(2)).streakDay,2);
 const claimed=claimReward(profile,rewardDate(2));
 assert.equal(claimed.diamonds,350);
 assert.deepEqual(claimed.inventory,{joker:4,hint:2});
 assert.equal(claimed.claimedDays,65);
 assert.equal(rewardView(structuredClone(profile),rewardDate(3)).streakDay,3);
});
const state=()=>({profiles:{a:{name:'A'},b:{name:'B'},c:{name:'C'}},friends:[{from:'a',to:'b',status:'accepted'}],matches:[]});
test('direct conversation is private, receipt-idempotent and survives removal of friendship',()=>{
 const s=state(),receipt='message-receipt-001';const m=sendDirect(s,'a','b','Hello',receipt,10000);assert.equal(sendDirect(s,'a','b','Hello',receipt,10000),m);assert.throws(()=>sendDirect(s,'a','c','Hello','message-receipt-002',12000));assert.throws(()=>sendDirect(s,'a','b','Changed',receipt,12000));s.friends=[];sendDirect(s,'b','a','Hi','message-receipt-003',12000);assert.equal(directMessages(s,'b','a').length,2);assert.equal(directMessages(s,'a','c').length,0);assert.equal(conversationList(s,'a')[0].name,'B');assert.equal(stateDocuments({rooms:[],social:s}).size,5);
});
test('old two-person room messages migrate once; group and bot chats stay in their rooms',()=>{
 const s=state(),rooms=[{code:'ABCDEF',seats:[{playerId:'a'},{playerId:'b'}],messages:[{id:'m1',seat:0,text:'Hello',at:1000}]},{code:'123456',seats:[{playerId:'a'},{playerId:'b',bot:true}],messages:[{id:'m2',seat:0,text:'Bot',at:2000}]}];assert.equal(migrateRoomMessages(s,rooms),1);assert.equal(migrateRoomMessages(s,rooms),0);assert.equal(directMessages(s,'a','b').length,1);
});
test('same-timestamp pagination does not skip a message, deleted accounts lose access and blocking stops sends',()=>{
 const s=state();sendDirect(s,'a','b','First','message-receipt-001',10000);sendDirect(s,'b','a','Second','message-receipt-002',10000);
 const page=directMessages(s,'a','b',{limit:1});const older=directMessages(s,'a','b',{before:page[0].at,beforeId:page[0].id});assert.equal(older.length,1);assert.notEqual(older[0].id,page[0].id);
 s.profiles.b.blockedPlayers=['a'];assert.throws(()=>sendDirect(s,'a','b','Blocked','message-receipt-003',12000));delete s.profiles.b;assert.equal(conversationAllowed(s,'a','b'),false);
});
test('bonus field starts at four cells and stays inside 36',()=>{
 let seed=123;const rand=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/2**32);const cells=Object.keys(makeBonusBoard(rand)).map(k=>k.split(',').map(Number));assert(cells.some(([x,y])=>Math.max(Math.abs(x),Math.abs(y))<6));for(const [x,y]of cells){const d=Math.max(Math.abs(x),Math.abs(y));assert(d>=4&&d<=36)}
});
