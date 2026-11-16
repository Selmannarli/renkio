import test from 'node:test';import assert from 'node:assert/strict';
import {createGame,play,validate,key} from '../public/engine.mjs';
import {makeBonusBoard,linePoints} from '../public/bonus-rules.mjs';
import {claimReward,rewardView,prepareJoker} from '../rewards.mjs';
import {remainingTiles} from '../public/tile-inventory.mjs';
const tile=(s,id='t'+s)=>({id,c:0,s});
test('experimental opening allows one or two tiles, doubles points and requires center; old games keep largest group',()=>{
 for(const size of [1,2]){const g=createGame(['a','b'],{experimental:true});g.turn=0;g.players[0].hand=[tile(0),tile(1),tile(2)];assert.equal(play(g,0,Array.from({length:size},(_,i)=>({id:'t'+i,x:i,y:0}))).score,size*2)}
 const g=createGame(['a','b'],{experimental:true});g.turn=0;g.players[0].hand=[tile(0)];assert.throws(()=>play(g,0,[{id:'t0',x:6,y:0}]),/ortadaki/);assert.deepEqual(g.board,{});
 const classic=createGame(['a','b']);classic.turn=0;classic.opening=2;classic.players[0].hand=[tile(0),tile(1)];assert.throws(()=>play(classic,0,[{id:'t0',x:0,y:0}]),/Açılışta/);
});
test('joker is zero points, stays the chosen identity and a six line with one joker is 10',()=>{
 const board={};for(let i=0;i<5;i++)board[key(i,0)]=tile(i);
 const hand=[{id:'j',joker:true,c:0,s:0}],p=[{id:'j',x:5,y:0,c:0,s:5}];const r=validate(board,hand,p,{experimental:true});assert.equal(r.score,10);assert.equal(r.board['5,0'].s,5);assert.equal(r.board['5,0'].joker,true);assert.equal(hand[0].s,0);
 assert.equal(linePoints([...Object.values(board),tile(5)]),12);assert.ok(validate(board,hand,[{id:'j',x:5,y:0,c:6,s:0}],{experimental:true}).error);
 assert.equal(remainingTiles({'5,0':r.board['5,0']},hand).flat().reduce((a,b)=>a+b),108);
});
test('new multiplier squares multiply the whole crossing line; flat bonuses are added once and old squares never fire again',()=>{
 const board={'0,0':tile(0)},hand=[tile(1)],p=[{id:'t1',x:1,y:0}];
 assert.equal(validate(board,hand,p,{experimental:true,bonusCells:{'1,0':{type:'3x'}}}).score,6);
 assert.equal(validate(board,hand,p,{experimental:true,bonusCells:{'1,0':{type:'+8'}}}).score,10);
 assert.equal(validate(board,hand,p,{experimental:true,bonusCells:{'0,0':{type:'3x'},'1,0':{type:'2x',used:true}}}).score,2);
 const g=createGame(['a','b'],{experimental:true});g.board=board;g.turn=0;g.players[0].hand=hand;g.bonusCells={'1,0':{type:'2x'}};assert.equal(play(g,0,p).score,4);assert.equal(g.bonusCells['1,0'].used,true);
 const crossed={'0,1':{id:'a',c:0,s:1},'1,0':{id:'b',c:1,s:0}},h=[tile(0)];assert.equal(validate(crossed,h,[{id:'t0',x:0,y:0}],{experimental:true,bonusCells:{'0,0':{type:'3x'}}}).score,12);
});
test('random squares stay from 4 through 36 cells from center, include every kind and survive JSON restoration',()=>{
 const a=makeBonusBoard(),b=makeBonusBoard();assert.notDeepEqual(a,b);assert.ok(Object.keys(a).length>80);assert.equal(new Set(Object.values(a).map(v=>v.type)).size,5);
 for(const pos of Object.keys(a)){const d=Math.max(...pos.split(',').map(v=>Math.abs(Number(v))));assert.ok(d>=4&&d<=36)}
 assert.deepEqual(JSON.parse(JSON.stringify(a)),a);
});
test('daily rewards use server Berlin calendar, accrue and prevent repeat claim across reload and DST',()=>{
 const p={};const before=Date.parse('2026-10-24T21:59:59Z'),after=Date.parse('2026-10-24T22:00:00Z'),next=Date.parse('2026-10-25T23:00:00Z');assert.equal(claimReward(p,before).diamonds,10);const copy=JSON.parse(JSON.stringify(p));assert.throws(()=>claimReward(copy,before),/zaten/);assert.equal(rewardView(copy,after).available,true);assert.equal(claimReward(copy,after).diamonds,20);assert.equal(claimReward(copy,next).streakDay,3);
});
test('each player has at most one joker per match; preparation is idempotent and an invalid move never uses it',()=>{
 const g=createGame(['a','b'],{experimental:true});g.turn=0;const j=prepareJoker(g,0,'j');assert.equal(prepareJoker(g,0,'different').id,j.id);assert.throws(()=>play(g,0,[{id:'j',x:1,y:1,c:0,s:0}]),/ortadaki/);assert.equal(g.players[0].jokerUsed,undefined);play(g,0,[{id:'j',x:0,y:0,c:0,s:0}]);assert.equal(g.players[0].jokerUsed,true);assert.throws(()=>prepareJoker(g,0,'next'),/kullandın/);assert.equal(prepareJoker(g,1,'other').id,'other');assert.equal(g.players[0].hand.filter(t=>!t.joker).length,6);
});
