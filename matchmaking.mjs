export const BOT_WAIT_MS=10000;
export const BOT_PLAYERS=Array.from({length:5},(_,i)=>({id:String(900000000001+i),tag:String(99001+i),name:'Player '+(99001+i),bot:true}));
export function ensureBotProfiles(profiles){for(const bot of BOT_PLAYERS)profiles[bot.id]??={name:bot.name,tag:bot.tag};return profiles}
export const MATCH_TIMERS=Object.freeze([30,60,120,43200]);
export function matchTimer(value=60){const seconds=Number(value);if(!MATCH_TIMERS.includes(seconds))throw Error('Geçersiz maç süresi.');return seconds}
export function matchLimit(rooms,player,seconds){
 if(!MATCH_TIMERS.includes(seconds))return null;
 const asyncMatch=seconds===43200;
 const limit=asyncMatch?5:3;
 let count=0;
 for(const room of rooms){
  const game=room.game;
  if(room.closedAt||!game||game.over||!MATCH_TIMERS.includes(game.turnSeconds)||(game.turnSeconds===43200)!==asyncMatch)continue;
  const seat=room.seats.findIndex(s=>!s.bot&&!s.kicked&&(player.id&&s.playerId===player.id||player.uid&&s.uid===player.uid||s===player));
  if(seat<0||game.players[seat]?.eliminated)continue;
  if(++count>=limit)return asyncMatch?'En fazla 5 açık 12 saatlik maç oynayabilirsin. Yeni maç için birini bitir.':'En fazla 3 açık kısa süreli maç oynayabilirsin. Yeni maç için birini bitir.';
 }
 return null;
}
export function serverBotDelay(seconds,random=Math.random,{humanSeconds=null,moves=14}={}){
 const sample=Math.max(0,Math.min(1,random())),progress=Math.min(1,Math.max(0,moves/14));
 if(seconds===43200){
  if(Number.isFinite(humanSeconds)&&humanSeconds>=0&&humanSeconds<=600){
   const pace=humanSeconds/600;
   return Math.round(60000+pace*30000+sample*(10000+pace*20000));
  }
  return Math.round(2000+sample*(88000+progress*510000));
 }
 const scale=(seconds||60)/60;
 if(humanSeconds===null)return Math.round(scale*(4+sample*(6+progress*10))*1000);
 const human=humanSeconds/scale;let delay;
 if(human>=40)delay=2+sample*8;
 else if(human<=10)delay=15+sample*(5+progress*15);
 else delay=Math.max(3,Math.min(35,40-human+(sample*2-1)*10-(1-progress)*4));
 return Math.round(delay*scale*1000);
}
export function updateBotPace(room,now=Date.now()){
 const g=room.game;if(!g)return;const key=[g.matchId,g.turn,g.history.length].join(':');
 if(room.turnTiming?.key===key)return;
 if(room.turnTiming&&!room.seats[room.turnTiming.actor]?.bot)room.lastHumanSeconds=Math.max(0,(now-room.turnTiming.startedAt)/1000);
 room.turnTiming={key,actor:g.turn,startedAt:g.turnDeadline?g.turnDeadline-g.turnSeconds*1000:now};
}
// Persist this plan with the room; polling and process restarts cannot reroll it.
export function planBotTurn(game,previous,now=Date.now(),random=Math.random,pace={}){
 if(previous?.revision===game.revision&&previous?.actor===game.turn)return previous;
 return {revision:game.revision,actor:game.turn,at:Math.min(now+serverBotDelay(game.turnSeconds,random,pace),game.turnDeadline?Math.max(now,game.turnDeadline-1500):Infinity)};
}
export class Matchmaker {
 constructor({createMatch,findMatch,checkLimit=()=>null,clock=Date.now,waitMs=BOT_WAIT_MS}){
  this.queue=new Map();this.results=new Map();this.createMatch=createMatch;this.findMatch=findMatch;
  this.checkLimit=checkLimit;this.clock=clock;this.waitMs=waitMs;
 }
 enter(player,seconds=60,searchId){
  seconds=matchTimer(seconds);
  const {uid}=player,previous=this.results.get(uid);
  if(searchId&&previous?.searchId===searchId)return previous.result;
  const message=this.checkLimit(player,seconds);
  if(message)return {status:'limited',message};
  if(player.id)for(const [other,e] of this.queue)if(other!==uid&&e.player.id===player.id)this.queue.delete(other);
  this.results.delete(uid);
  let entry=this.queue.get(uid);
  if(!entry||entry.seconds!==seconds||entry.searchId!==searchId){
   entry={player,seconds,searchId,joined:this.clock(),seen:this.clock()};this.queue.set(uid,entry);
  }else{entry.seen=this.clock();entry.player=player}
  this.tick();return this.status(uid,searchId);
 }
 status(uid,searchId){
  const settled=this.results.get(uid);
  if(settled&&(!searchId||settled.searchId===searchId))return settled.result;
  const e=this.queue.get(uid);
  if(!e||searchId&&e.searchId!==searchId)return {status:'idle'};
  return {status:'searching',turnSeconds:e.seconds,joinedAt:e.joined,serverNow:this.clock(),botAt:e.joined+this.waitMs,botsBusy:this.clock()-e.joined>=this.waitMs};
 }
 poll(player,searchId){
  const e=this.queue.get(player.uid);
  if(e&&(!searchId||e.searchId===searchId))e.seen=this.clock();
  this.tick();return this.status(player.uid,searchId);
 }
 cancel(uid,searchId){
  const result=this.status(uid,searchId);
  if(result.status==='matched')return result;
  if(result.status==='searching')this.queue.delete(uid);
  return {status:'idle'};
 }
 settle(entry,result,now){
  const uid=entry.player.uid;
  this.queue.delete(uid);this.results.set(uid,{searchId:entry.searchId,result,at:now});
 }
 eligible(entry,now){
  const message=this.checkLimit(entry.player,entry.seconds);
  if(!message)return true;
  this.settle(entry,{status:'limited',message},now);
  return false;
 }
 tick(){
  const now=this.clock();
  for(const [uid,settled] of this.results)if(now-settled.at>120000)this.results.delete(uid);
  for(const [uid,e] of this.queue){
   if(now-e.seen>35000){this.queue.delete(uid);continue}
   this.eligible(e,now);
  }
  for(const seconds of MATCH_TIMERS){
   const entries=[...this.queue.values()].filter(e=>e.seconds===seconds);
   while(entries.length>=2){
    const a=entries.shift();
    if(!this.eligible(a,now))continue;
    const b=entries.shift();
    if(!this.eligible(b,now)){entries.unshift(a);continue}
    const match=this.createMatch(a.player,b.player,seconds);
    if(!match)break;
    for(const entry of [a,b])this.settle(entry,{status:'matched',match},now);
   }
  }
  for(const e of this.queue.values()){
   if(now-e.joined<this.waitMs||!this.eligible(e,now))continue;
   const bot=BOT_PLAYERS.find(b=>!this.findMatch('bot:'+b.id));
   if(!bot)break;
   const match=this.createMatch(e.player,{...bot,uid:'bot:'+bot.id},e.seconds);
   if(match)this.settle(e,{status:'matched',match},now);
  }
 }
}
