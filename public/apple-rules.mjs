// Throws never change the board, score or racks; short timed matches grant the active rival five seconds on a hit.
export const APPLE_GRAVITY=5,APPLE_COOLDOWN=3200;
export function appleOrder(game){return game.players.map((p,seat)=>({seat,score:p.score||0})).filter(p=>!game.players[p.seat].eliminated).sort((a,b)=>b.score-a.score||a.seat-b.seat).map(p=>p.seat)}
export function canThrowApple(game,seat,now=Date.now()){return !!(game&&!game.over&&!game.timeoutDecision&&Number.isInteger(seat)&&game.players?.[seat]&&!game.players[seat].eliminated&&game.turn!==seat&&!(game.celebration&&!game.celebration.released&&now<game.celebration.until))}
export function applePoint(shot,t){return {x:shot.start+shot.vx*t,y:shot.vy*t-APPLE_GRAVITY*t*t/2}}
export function appleFlight(game,seat,vx,vy){
 if(!Number.isFinite(vx)||!Number.isFinite(vy)||Math.abs(vx)>4.5||Math.abs(vy)>3.6||Math.hypot(vx,vy)<.35)throw Error('Geçersiz atış.');
 const order=appleOrder(game),start=order.indexOf(seat);if(start<0)throw Error('Oyuncu bulunamadı.');const shot={order,start,vx,vy,hit:null,duration:1.8};
 for(let step=1;step<=432;step++){const t=step/240,p=applePoint(shot,t);for(let i=0;i<order.length;i++){if(order[i]===seat)continue;if(((p.x-i)/.17)**2+(p.y/.45)**2<=1){shot.hit=order[i];shot.duration=t;return shot}}if(p.y< -2.5||p.x< -1||p.x>order.length){shot.duration=t;break}}
 return shot;
}
export function recordApple(room,seat,input,now=Date.now()){
 if(typeof input.receipt!=='string'||!/^[-\w]{16,80}$/.test(input.receipt))throw Error('Geçersiz atış.');
 const previous=(room.appleThrows||[]).find(s=>s.id===input.receipt);if(previous){if(previous.seat!==seat||previous.vx!==input.vx||previous.vy!==input.vy)throw Error('İşlem kimliği daha önce kullanıldı.');return previous}
 if(!canThrowApple(room.game,seat,now)||room.game.turnDeadline&&room.game.turnDeadline<=now)throw Error('Elmayı sıranı beklerken fırlatabilirsin.');
 const last=(room.appleThrows||[]).filter(s=>s.seat===seat).at(-1);if(last&&now-last.at<APPLE_COOLDOWN)throw Error('Biraz bekle.');
 const shot={...appleFlight(room.game,seat,input.vx,input.vy),seat,id:input.receipt,at:now,turn:room.game.turn,serial:room.game.turnSerial||room.game.history?.length||0,matchId:room.game.matchId};
 if(shot.hit===room.game.turn&&[30,60,120].includes(room.game.turnSeconds)&&Number.isFinite(room.game.turnDeadline)&&room.game.turnDeadline>now){room.game.turnDeadline+=5000;shot.extraSeconds=5}
 room.appleThrows=[...(room.appleThrows||[]),shot].slice(-16);return shot;
}
