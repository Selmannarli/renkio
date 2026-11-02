// A late HTTP reply must never undo a newer stream packet or a finished match.
export function acceptRoomSnapshot(current,next){
 if(!current||current.code!==next.code)return true;
 if(current.game&&next.game?.matchId===current.game.matchId){
  if(next.game.revision<current.game.revision||current.game.over&&!next.game.over)return false;
 }
 if(current.game&&!next.game&&!next.removed)return false;
 if(current.serverInstance&&current.serverInstance===next.serverInstance&&Number.isFinite(current.snapshotSerial)&&Number.isFinite(next.snapshotSerial))return next.snapshotSerial>current.snapshotSerial;
 return !(current.serverNow&&next.serverNow&&next.serverNow<current.serverNow);
}
export class ChatReadState{
 constructor(read,write){this.read=read;this.write=write}
 update(key,messages,isIncoming,open=false){
  const stored=this.read(key),seen=new Set(stored||[]);
  // Existing history is a baseline for accounts upgrading from the old badge.
  if(!stored||open){for(const m of messages)seen.add(m.id);this.write(key,[...seen].slice(-500));return false}
  return messages.some(m=>isIncoming(m)&&!seen.has(m.id));
 }
}
export function roomChatKey(room,owner){const ids=room.seats?.map(s=>s.playerId);return 'renkio-chat-read:'+owner+':'+(ids?.length===2&&ids.every(Boolean)&&!room.seats.some(s=>s.bot)?ids.sort().join(':'):'room:'+room.code)}
export function directChatKey(a,b){return 'renkio-chat-read:'+a+':'+[a,b].sort().join(':')}
export function giftLabel(m,translate=x=>x){return m.kind==='gift'?m.gift.amount+' × '+translate({joker:'Joker',hint:'İpucu',diamonds:'Elmas'}[m.gift.item]||'Hediye'):m.text}

// Board/history change with revision; cosmetic packets need not serialize them again.
export function gameRenderKey(g){return g?JSON.stringify([g.matchId,g.revision,g.turn,g.turnSerial,g.over,g.turnSeconds,g.turnDeadline,g.timeSupportUsed,g.timeoutCounts,g.timeoutDecision,g.players,g.celebration,g.bagCount]):''}

// A server echo and its optimistic row describe one event, not two balloons.
export class TransientEvents {
 constructor(){this.scopes=new Map()}
 messages(scope,messages,baseline=false){const first=!this.scopes.has(scope),seen=this.scopes.get(scope)||new Set(),fresh=[];for(const m of messages){const id=m.receipt||m.id;if(!seen.has(id)&&!first&&!baseline)fresh.push(m);seen.add(id)}this.scopes.set(scope,new Set([...seen].slice(-256)));while(this.scopes.size>40)this.scopes.delete(this.scopes.keys().next().value);return fresh}
}
