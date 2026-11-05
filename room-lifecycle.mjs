import {resignGame} from './public/engine.mjs';

export function canKick(room,actor,target){
 return actor===0&&!room.matchmaking&&Number.isInteger(target)&&target>0&&target<room.seats.length&&!room.seats[target].kicked&&(!room.game||room.game.players.length>=3&&!room.game.over&&!room.game.players[0].eliminated&&!room.game.players[target].eliminated);
}
export function kickSeat(room,actor,target){
 if(!canKick(room,actor,target))throw Error('Bu oyuncuyu yalnızca masa sahibi çıkarabilir.');
 const seat=room.seats[target];
 if(room.game){resignGame(room.game,target,'Masa sahibi tarafından çıkarıldı');seat.kicked=true;}
 else{delete room.tableGame;room.seats.splice(target,1);room.messages=(room.messages||[]).filter(m=>m.seat!==target).map(m=>({...m,seat:m.seat>target?m.seat-1:m.seat}));room.reports=(room.reports||[]).filter(r=>r.by!==target&&r.seat!==target).map(r=>({...r,by:r.by>target?r.by-1:r.by,seat:r.seat>target?r.seat-1:r.seat}));}
 return seat;
}
export function openRoomEntry(room,uid,profiles={}){
 if(room.closedAt)return null;
 const me=room.seats.findIndex(s=>s.uid===uid&&!s.bot&&!s.kicked);
 if(me<0||room.game&&(room.game.over||room.game.players[me]?.eliminated))return null;
 return {room:room.code,matchId:room.game?.matchId||null,turnSeconds:room.game?.turnSeconds||0,token:room.seats[me].token,updated:room.updated,waiting:!room.game,seats:room.seats.filter(s=>!s.kicked).map(s=>({name:profiles[s.playerId]?.name||s.name,playerId:s.playerId,avatar:profiles[s.playerId]?.avatar||s.avatar})),host:me===0,count:room.seats.length,names:room.seats.filter((s,i)=>i!==me&&!s.kicked).map(s=>s.name),turn:room.game?.turn===me,score:room.game?.players[me]?.score||0,timeouts:room.game?.timeoutCounts?.[me]||0};
}
export function waitingRoomFor(rooms,uid){return uid?[...rooms.values()].find(r=>!r.closedAt&&!r.game&&r.seats.some(s=>s.uid===uid&&!s.kicked))||null:null}
export function leaveLobby(room,actor,{disband=false,now=Date.now()}={}){
 if(room.game||room.closedAt)throw Error('Bu masa artık lobi değil.');
 if(!Number.isInteger(actor)||!room.seats[actor])throw Error('Masa üyeliği bulunamadı.');
 if(disband&&actor!==0)throw Error('Masayı yalnızca masa sahibi dağıtabilir.');
 const removed=disband?[...room.seats]:[room.seats[actor]];
 if(disband||room.seats.length===1){room.closedAt=now;room.closeReason='disbanded';delete room.tableGame;}
 else{room.seats.splice(actor,1);room.messages=(room.messages||[]).filter(m=>m.seat!==actor).map(m=>({...m,seat:m.seat>actor?m.seat-1:m.seat}));delete room.tableGame;}
 room.updated=now;return removed;
}
