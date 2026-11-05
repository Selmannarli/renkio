import test from 'node:test';
import assert from 'node:assert/strict';
import {matchLimit,Matchmaker,BOT_PLAYERS,BOT_WAIT_MS,serverBotDelay,matchTimer,planBotTurn,updateBotPace,ensureBotProfiles} from '../matchmaking.mjs';
import {createGame,play,validate} from '../public/engine.mjs';
import {BotRunner} from '../server-bots.mjs';
import {playerId,publicProfile} from '../account.mjs';
test('a fresh search can match again while a retry returns the assigned match',()=>{
 const {f,matches,player}=fixture();
 const a=player('a');
 f.enter(a,30,'first');f.enter(player('b'),30,'b');
 assert.equal(f.enter(a,30,'first').match,matches[0]);
 assert.equal(f.enter(a,60,'second').status,'searching');
 assert.equal(f.cancel(a.uid,'first').status,'idle');
 f.enter(player('c'),60,'c');
 assert.equal(f.poll(a,'second').match,matches[1]);
});
test('short matches share three slots and twelve-hour matches have five independent slots',()=>{
 const player={id:'stable-player',uid:'new-login'};
 const room=turnSeconds=>({seats:[{playerId:player.id,uid:'old-login'}],game:{turnSeconds,players:[{}]}});
 const short=[30,60,120].map(room),long=Array.from({length:5},()=>room(43200));
 const rooms=[...short,...long,room(0)];
 for(const seconds of [30,60,120])assert.match(matchLimit(rooms,player,seconds),/3 açık/);
 assert.match(matchLimit(rooms,player,43200),/5 açık/);
 assert.equal(matchLimit(short,player,43200),null);
 assert.equal(matchLimit(long,player,60),null);
 short[0].game.players[0].eliminated=true;long[0].game.over=true;
 assert.equal(matchLimit(rooms,player,30),null);
 assert.equal(matchLimit(rooms,player,43200),null);
});
test('a player who fills their last slot while searching is stopped before being paired',()=>{
 const blocked=new Set(),a={uid:'a'},b={uid:'b'};
 const f=new Matchmaker({checkLimit:p=>blocked.has(p.uid)?'Sınır dolu':null,createMatch:()=>assert.fail('Unexpected match'),findMatch:()=>null});
 f.enter(a,30,'a');blocked.add(a.uid);
 assert.equal(f.enter(b,30,'b').status,'searching');
 assert.deepEqual(f.poll(a,'a'),{status:'limited',message:'Sınır dolu'});
});
function fixture(){let now=0;const matches=[],f=new Matchmaker({clock:()=>now,findMatch:uid=>matches.find(m=>!m.over&&m.players.some(p=>p.uid===uid)),createMatch:(a,b,seconds)=>{const m={players:[a,b],turnSeconds:seconds};matches.push(m);return m}});return {f,matches,advance(ms){now+=ms},player(uid){return {uid,id:uid,name:'Player '+uid}}}}
test('human search pairs immediately, deduplicates requests and never exposes a self match',()=>{const {f,matches,player}=fixture();assert.equal(f.enter(player('a')).status,'searching');f.enter(player('a'));assert.equal(f.queue.size,1);assert.equal(f.enter(player('b')).status,'matched');assert.equal(f.poll(player('a')).status,'matched');assert.equal(matches.length,1);assert.equal(f.queue.size,0);assert.equal(f.enter(player('a')).status,'searching');assert.equal(matches.length,1)});
test('bot threshold is exactly ten seconds, heartbeat retains waiting time',()=>{const {f,matches,advance,player}=fixture();f.enter(player('a'));for(let t=0;t<9000;t+=1000){advance(1000);f.poll(player('a'))}assert.equal(matches.length,0);advance(1000);assert.equal(f.poll(player('a')).status,'matched');assert.equal(matches[0].players[1].bot,true);assert.equal(BOT_WAIT_MS,10000)});
test('five bots at most; sixth waits until a bot is free, humans still get priority',()=>{const {f,matches,advance,player}=fixture();for(let i=0;i<5;i++){f.enter(player('a'+i));for(let t=0;t<6;t++){advance(30000);f.poll(player('a'+i))}}assert.equal(matches.length,5);assert.equal(new Set(matches.map(m=>m.players[1].id)).size,5);assert.equal(BOT_PLAYERS.length,5);f.enter(player('sixth'));for(let t=0;t<6;t++){advance(30000);f.poll(player('sixth'))}assert.equal(f.status('sixth').botsBusy,true);assert.equal(matches.length,5);matches[0].over=true;f.tick();assert.equal(f.status('sixth').status,'matched');assert.equal(matches[5].players[1].id,BOT_PLAYERS[0].id);f.enter(player('human-a'));assert.equal(f.enter(player('human-b')).status,'matched');assert.equal(matches.at(-1).players[1].bot,undefined)});
test('cancel and expired searches never get a phantom match; cancel race returns already matched room',()=>{const {f,matches,advance,player}=fixture();f.enter(player('a'));f.cancel('a');f.enter(player('b'));advance(36000);f.tick();assert.equal(f.queue.size,0);assert.equal(matches.length,0);f.enter(player('c'));f.enter(player('d'));assert.equal(f.cancel('c').status,'matched')});
test('public IDs are stable across sign-in devices and cloud nickname changes',()=>{assert.equal(playerId('firebase-user-1'),playerId('firebase-user-1'));assert.notEqual(playerId('firebase-user-1'),playerId('firebase-user-2'));assert.match(publicProfile({uid:'firebase-user-1',guest:true}).name,/^Player \d{12}$/);assert.equal(publicProfile({uid:'firebase-user-1',name:'Ada',guest:false}).name,'Ada')});
test('server worker computes a legal bot opening without sharing or mutating another hand',async()=>{const runner=new BotRunner();try{const g=createGame(['A','B']),before=JSON.stringify(g),actor=g.turn;const move=await runner.solve(g.board,g.players[actor].hand,g.opening);assert.ok(move);assert.equal(JSON.stringify(g),before);assert.equal(validate(g.board,g.players[actor].hand,move.placements).error,undefined);play(g,actor,move.placements);assert.equal(g.revision,2)}finally{runner.close()}});

test('only matching timers pair, changing a timer restarts the wait and preserves FIFO',()=>{
 const {f,matches,advance,player}=fixture();f.enter(player('a'),30);f.enter(player('b'),120);assert.equal(matches.length,0);
 f.enter(player('c'),30);assert.equal(matches[0].turnSeconds,30);assert.deepEqual(matches[0].players.map(p=>p.uid),['a','c']);
 advance(5000);f.enter(player('b'),43200);assert.equal(f.queue.get('b').joined,5000);advance(9999);f.poll(player('b'));assert.equal(matches.length,1);advance(1);f.poll(player('b'));assert.equal(matches[1].turnSeconds,43200);
 assert.throws(()=>f.enter(player('x'),15));for(const seconds of [30,60,120,43200])assert.equal(matchTimer(String(seconds)),seconds);
});
test('bot timing spans human-sized thinking windows and twelve-hour turns stay under ten minutes',()=>{
 for(const [seconds,min,max]of [[30,2000,10000],[60,4000,20000],[120,8000,40000],[43200,2000,600000]]){
  assert.equal(serverBotDelay(seconds,()=>0),min);assert.equal(serverBotDelay(seconds,()=>1),max);assert.ok(serverBotDelay(seconds,()=>.5)>min);
 }
});

test('saved bot plans survive reloads, do not reroll on polling and leave deadline room to solve',()=>{
 const game={revision:3,turn:1,turnSeconds:60,turnDeadline:61000};const plan=planBotTurn(game,null,1000,()=>1);assert.equal(plan.at,21000);
 assert.deepEqual(planBotTurn(game,JSON.parse(JSON.stringify(plan)),40000,()=>0),plan);
 const next=planBotTurn({...game,revision:4},plan,60000,()=>1);assert.equal(next.at,60000);assert.equal(next.revision,4);
});

test('bot answers account for human thinking, become slower with progress and stay quick after long waits',()=>{
 for(const humanSeconds of [20,30,40,50,10]){const values=[0,.5,1].map(n=>serverBotDelay(60,()=>n,{humanSeconds,moves:14}));if(humanSeconds>=40)assert.ok(values.every(v=>v<=10000));if(humanSeconds===20)assert.equal(values[1],20000);if(humanSeconds===30)assert.equal(values[1],10000);if(humanSeconds===10)assert.deepEqual(values,[15000,25000,35000])}
 assert.ok(serverBotDelay(60,()=>.5,{humanSeconds:20,moves:0})<serverBotDelay(60,()=>.5,{humanSeconds:20,moves:14}));
 const room={seats:[{}, {bot:true}],game:{matchId:'a',turn:0,history:[],turnSeconds:60,turnDeadline:61000}};updateBotPace(room,1000);updateBotPace(room,9000);room.game.turn=1;room.game.history.push({});room.game.turnDeadline=81000;updateBotPace(room,21000);assert.equal(room.lastHumanSeconds,20);updateBotPace(room,40000);assert.equal(room.lastHumanSeconds,20);
});

test('all five server players support actual persisted friend requests by public tag',async()=>{
 const {Friends}=await import('../friends.mjs');const {resolvePlayerId}=await import('../player-tags.mjs');
 const state={profiles:ensureBotProfiles({'100000000001':{name:'Ada',tag:'12345'}})},friends=new Friends(state);
 for(const bot of BOT_PLAYERS){const id=resolvePlayerId(state.profiles,bot.tag);assert.equal(id,bot.id);friends.request('100000000001',id);friends.request('100000000001',id)}
 assert.equal(state.friends.length,5);assert.equal(friends.view('100000000001',new Map()).outgoing.length,5);
});
