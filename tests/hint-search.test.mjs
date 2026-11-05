import test from 'node:test';
import assert from 'node:assert/strict';
import {bestMove,validate,createGame,play,exchange,pass} from '../public/engine.mjs';
import {hintUsesForViewer} from '../public/chat-outbox.mjs';

const tile=(c,s)=>({id:`${c}${s}`,c,s});
test('hint reaches a multiplier behind a disconnected prefix and includes flat bonuses',()=>{
 const board={'0,0':tile(0,0)},hand=[tile(0,1),tile(0,2)];
 const options={experimental:true,thorough:true,bonusCells:{'-2,0':{type:'3x'},'-1,0':{type:'+8'}}};
 const hint=bestMove(board,hand,0,options);
 assert.equal(hint.score,17);
 assert.deepEqual(hint.placements.map(p=>p.x).sort((a,b)=>a-b),[-2,-1]);
 assert.equal(validate(board,hand,hint.placements,options).score,hint.score);
});
test('hint evaluates crossing lines, stacked multipliers and already consumed bonuses against exhaustive two-tile search',()=>{
 const board={'0,0':tile(0,0),'1,0':tile(0,1),'0,1':tile(1,0)};
 const hand=[tile(1,1),tile(2,1)];
 const options={experimental:true,thorough:true,bonusCells:{'1,1':{type:'3x'},'1,2':{type:'2x'},'-1,0':{type:'+8'},'2,0':{type:'3x',used:true}}};
 const empty=[];for(let x=-3;x<=4;x++)for(let y=-3;y<=4;y++)if(!board[`${x},${y}`])empty.push({x,y});
 let maximum=0;
 for(const a of empty)for(const first of hand){
  const placed=[{id:first.id,...a}],single=validate(board,hand,placed,options);if(!single.error)maximum=Math.max(maximum,single.score);
  for(const b of empty){if(a.x!==b.x&&a.y!==b.y)continue;const other=hand.find(t=>t.id!==first.id);const result=validate(board,hand,[...placed,{id:other.id,...b}],options);if(!result.error)maximum=Math.max(maximum,result.score);}
 }
 const hint=bestMove(board,hand,0,options);
 assert.equal(hint.score,maximum);
 assert.equal(validate(board,hand,hint.placements,options).score,maximum);
});
test('private hint counts stay available to their owner and never reach opponents, including reconnect snapshots',()=>{
 const game={hintUses:{0:5,1:1,2:2}},seats=[{playerId:'admin'},{playerId:'friend'},{playerId:'other'}];
 assert.deepEqual(hintUsesForViewer(game,seats,0,'admin'),{0:5,1:1,2:2});
 assert.deepEqual(hintUsesForViewer(game,seats,1,'admin'),{1:1,2:2});
 assert.deepEqual(hintUsesForViewer(JSON.parse(JSON.stringify(game)),seats,2,'admin'),{1:1,2:2});
 assert.equal(game.hintUses[0],5);
});
test('strong hints remain legal and at least as good as ordinary search as a match grows',()=>{
 const game=createGame(['A','B'],{experimental:true});
 for(let turn=0;turn<24&&!game.over;turn++){
  if(game.celebration)game.celebration.until=0;
  const hand=game.players[game.turn].hand,options={experimental:true,bonusCells:game.bonusCells};
  const normal=bestMove(game.board,hand,0,options),hint=bestMove(game.board,hand,0,{...options,thorough:true});
  if(normal)assert(hint.score>=normal.score);
  if(hint){assert.equal(validate(game.board,hand,hint.placements,options).score,hint.score);play(game,game.turn,hint.placements);}
  else if(game.bag.length)exchange(game,game.turn,hand.slice(0,Math.min(6,game.bag.length)).map(t=>t.id));
  else pass(game,game.turn);
 }
});
