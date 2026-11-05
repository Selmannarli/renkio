import {HERO_TIMING} from './character-style.mjs';
import {makeBonusBoard,scoreLines} from './bonus-rules.mjs';
export const key=(x,y)=>`${x},${y}`;
export const dirs=[[1,0],[0,1]];
export function bag(){let a=[];for(let c=0;c<6;c++)for(let s=0;s<6;s++)for(let n=0;n<3;n++)a.push({id:`${c}${s}${n}`,c,s});for(let i=a.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
export function line(board,x,y,dx,dy){while(board[key(x-dx,y-dy)]){x-=dx;y-=dy}let a=[];while(board[key(x,y)]){a.push({...board[key(x,y)],x,y});x+=dx;y+=dy}return a}
function legal(a){return a.length<=6&&new Set(a.map(t=>`${t.c}:${t.s}`)).size===a.length&&(a.every(t=>t.c===a[0].c)||a.every(t=>t.s===a[0].s))}
export function validate(board,hand,placements,options={}){
 if(!Array.isArray(placements)||!placements.length||placements.length>6)return {error:'Önce elinden bir taş seçip masaya yerleştir.'};
 let b={...board},seen=new Set(),tiles=[];
 for(const p of placements){if(!Number.isInteger(p.x)||!Number.isInteger(p.y)||Math.abs(p.x)>110||Math.abs(p.y)>110)return {error:'Bu konuma taş yerleştirilemez.'};let t=hand.find(t=>t.id===p.id);if(!t||seen.has(p.id)||b[key(p.x,p.y)])return {error:'Taş ya da konum geçerli değil.'};if(t.joker){if(!options.experimental||!Number.isInteger(p.c)||!Number.isInteger(p.s)||p.c<0||p.c>5||p.s<0||p.s>5)return {error:'Joker için renk ve şekil seç.'};t={...t,c:p.c,s:p.s}}seen.add(p.id);tiles.push({...t,x:p.x,y:p.y});b[key(p.x,p.y)]=t}
 if(tiles.length>1&&!tiles.every(t=>t.x===tiles[0].x)&&!tiles.every(t=>t.y===tiles[0].y))return {error:'Bu turdaki bütün taşlar aynı satırda veya sütunda olmalı.'};
 if(tiles.length>1){const dx=tiles.every(t=>t.y===tiles[0].y)?1:0,dy=1-dx;const a=line(b,tiles[0].x,tiles[0].y,dx,dy);if(!tiles.every(t=>a.some(z=>z.x===t.x&&z.y===t.y)))return {error:'Taşların arasında boşluk kalamaz.'};if(!legal(tiles))return {error:'Oynadığın taşlar aynı renk veya aynı şekli paylaşmalı; tekrar olamaz.'}}
 if(Object.keys(board).length&&!tiles.some(t=>[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>board[key(t.x+dx,t.y+dy)])))return {error:'Hamleni masadaki taşlara kenardan bağla.'};
 let lines=new Map();
 for(const t of tiles)for(const [dx,dy] of dirs){const a=line(b,t.x,t.y,dx,dy);if(!legal(a))return {error:'Her çizgi aynı renkte farklı şekillerden veya aynı şekilde farklı renklerden oluşmalı. En fazla 6 taş olabilir.'};if(a.length>1)lines.set(`${dx}:${a[0].x},${a[0].y}`,a)}
 let renkios=[...lines.values()].filter(a=>a.length===6).length;const scoring=scoreLines([...lines.values()],tiles,{...options,openingBonus:!Object.keys(board).length});
 return {board:b,...scoring,renkios,scoredLines:[...lines.values()].map(a=>a.map(({x,y})=>({x,y})))};
}
export function largest(hand){let best=[];for(const attr of ['c','s'])for(let i=0;i<6;i++){let a=hand.filter(t=>t[attr]===i),u=[...new Map(a.map(t=>[`${t.c}${t.s}`,t])).values()];if(u.length>best.length)best=u}return best}
export function createGame(names,{turnSeconds=0,experimental=false}={}){let b=bag();let players=names.map(name=>({name,hand:b.splice(-6),score:0}));let turn=0;players.forEach((p,i)=>{if(largest(p.hand).length>largest(players[turn].hand).length)turn=i});return {board:{},bag:b,players,turn,started:true,over:false,...(experimental?{experimental:true,rulesVersion:'bonus-v1',bonusCells:makeBonusBoard()}:{}),opening:experimental?1:largest(players[turn].hand).length,history:[],timeoutCounts:names.map(()=>0),passes:0,revision:1,lastMoves:{},turnStartedAt:Date.now(),turnSeconds,turnDeadline:turnSeconds?Date.now()+turnSeconds*1000:null}}
export const celebrationLocked=(g,now=Date.now())=>!!g?.celebration&&now<g.celebration.until;
function checkCelebration(g){if(celebrationLocked(g))throw Error('Karakter yerine dönene kadar bekle.')}
export function play(g,actor,placements){checkCelebration(g);if(g.timeoutDecision)throw Error('Önce süre aşımı kararını bekle.');if(g.over||g.players[actor]?.eliminated||g.turn!==actor)throw Error('Şu an senin sıran değil.');let p=g.players[actor];let r=validate(g.board,p.hand,placements,g);if(r.error)throw Error(r.error);if(!Object.keys(g.board).length&&!g.experimental&&placements.length!==g.opening)throw Error(`Açılışta en büyük grubunu, ${g.opening} taşı oynamalısın.`);if(g.experimental&&!Object.keys(g.board).length&&!placements.some(t=>t.x===0&&t.y===0))throw Error('İlk hamleyi ortadaki 2× karesinden başlat.');const jokers=placements.filter(a=>p.hand.find(t=>t.id===a.id)?.joker);if(jokers.length&&(p.jokerUsed||jokers.length>1))throw Error('Her oyuncu bir maçta yalnızca 1 joker kullanabilir.');if(jokers.length)p.jokerUsed=true;g.board=r.board;g.lastScoring=r.scoredLines;for(const a of placements)if(g.bonusCells?.[key(a.x,a.y)])g.bonusCells[key(a.x,a.y)].used=true;p.hand=p.hand.filter(t=>!placements.some(a=>a.id===t.id));p.score+=r.score;while(p.hand.filter(t=>!t.joker).length<6&&g.bag.length)p.hand.push(g.bag.pop());g.passes=0;g.timeouts=0;g.last=placements.map(p=>({...p}));g.lastMoves??={};g.lastMoves[actor]=g.last;g.history.unshift({actor,name:p.name,score:r.score,renkios:r.renkios,bonuses:r.bonuses,baseScore:r.baseScore,tiles:placements.map(a=>{const t=r.board[key(a.x,a.y)];return {c:t.c,s:t.s,...(t.joker?{joker:true}:{})}}),text:`${placements.length} taş oynadı`});if(!p.hand.filter(t=>!t.joker).length){p.score+=6;g.over=true;g.history.unshift({name:p.name,score:6,text:'Elini bitirdi · bitiş bonusu'})}next(g);if(r.renkios){const startedAt=Date.now();g.celebration={revision:g.revision,actor,score:r.score,renkios:r.renkios,startedAt,until:startedAt+HERO_TIMING.duration,lines:r.scoredLines.filter(a=>a.length===6)};if(g.turnDeadline)g.turnDeadline+=HERO_TIMING.duration}return r}
export function exchange(g,actor,ids){checkCelebration(g);if(g.timeoutDecision)throw Error('Önce süre aşımı kararını bekle.');if(g.over||g.players[actor]?.eliminated||g.turn!==actor)throw Error('Şu an senin sıran değil.');if(!Object.keys(g.board).length)throw Error('Önce açılış grubu oynanmalı.');let p=g.players[actor];if(!Array.isArray(ids)||!ids.length||new Set(ids).size!==ids.length||ids.length>g.bag.length||ids.some(id=>!p.hand.some(t=>t.id===id&&!t.joker)))throw Error('Değiştirmek için torbadaki taş sayısını aşmayan taşlar seç.');let discarded=p.hand.filter(t=>ids.includes(t.id));p.hand=p.hand.filter(t=>!ids.includes(t.id));p.hand.push(...g.bag.splice(-ids.length));g.bag.push(...discarded);for(let i=g.bag.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[g.bag[i],g.bag[j]]=[g.bag[j],g.bag[i]]}g.passes=0;g.timeouts=0;g.history.unshift({name:p.name,score:0,text:`${ids.length} taş değiştirdi`});next(g)}
export function pass(g,actor){checkCelebration(g);if(g.timeoutDecision)throw Error('Önce süre aşımı kararını bekle.');if(g.over||g.players[actor]?.eliminated||g.turn!==actor)throw Error('Şu an senin sıran değil.');g.timeouts=0;g.passes++;g.history.unshift({name:g.players[actor].name,score:0,text:'Pas geçti'});if(g.passes>=g.players.filter(p=>!p.eliminated).length)g.over=true;next(g)}
export function settleRackPenalty(g){if(!g.over||g.rackPenaltyApplied)return;g.rackPenaltyApplied=true;for(const [actor,p]of g.players.entries()){const count=(p.hand||[]).filter(t=>!t.joker).length;p.rackPenalty=count;p.score-=count;if(count)g.history.push({actor,name:p.name,score:-count,text:'Elde kalan taşlar',penalty:true})}}
function next(g){settleRackPenalty(g);g.turnSerial=(g.turnSerial||0)+1;g.turnStartedAt=Date.now();do{g.turn=(g.turn+1)%g.players.length}while(g.players[g.turn].eliminated&&!g.over);g.revision++;g.turnDeadline=g.turnSeconds&&!g.over?Date.now()+g.turnSeconds*1000:null}
export function bestMove(board,hand,opening=0,options={}){
 if(options.thorough)return bestHintMove(board,hand,opening,options);
 hand=hand.filter(t=>!t.joker);let best=null,count=0;const limit=18000;let starts=new Map();if(!Object.keys(board).length)starts.set('0,0',[0,0]);else for(const pos of Object.keys(board)){let [x,y]=pos.split(',').map(Number);for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]])if(!board[key(x+dx,y+dy)])starts.set(key(x+dx,y+dy),[x+dx,y+dy])}
 const unique=[...new Map(hand.map(t=>[`${t.c}${t.s}`,t])).values()];
 for(const [sx,sy] of starts.values())for(const [dx,dy] of dirs){
  function search(x,y,remaining,placed){if(++count>limit)return;if(placed.length){const r=validate(board,hand,placed,options);if(!r.error&&(!opening||placed.length===opening)&&(!best||r.score>best.score||r.score===best.score&&placed.length>best.placements.length))best={score:r.score,placements:placed.map(t=>({...t}))}}
   if(!remaining.length)return;while(board[key(x,y)]){x+=dx;y+=dy}if(Math.abs(x)>110||Math.abs(y)>110)return;
   for(const t of remaining){if(placed.length&&(!placed.every(p=>hand.find(h=>h.id===p.id).c===t.c)&&!placed.every(p=>hand.find(h=>h.id===p.id).s===t.s)))continue;const np=[...placed,{id:t.id,x,y}],r=validate(board,hand,np);if(!r.error)search(x+dx,y+dy,remaining.filter(a=>a.id!==t.id),np)}
  }search(sx,sy,unique,[]);if(count>limit)return best
 }return best
}

function bestHintMove(board,hand,opening,options){
 let best=bestMove(board,hand,opening,{...options,thorough:false});
 const tiles=[...new Map(hand.filter(t=>!t.joker).map(t=>[`${t.c}:${t.s}`,t])).values()];
 if(!tiles.length)return best;
 const occupied=Object.keys(board),roots=new Map(),trial={...board};
 const adjacent=(x,y)=>[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>board[key(x+dx,y+dy)]);
 function addRoot(x,y,dx,dy){
  if(Math.abs(x)>110||Math.abs(y)>110||board[key(x,y)])return;
  let priority=0;
  for(let i=0;i<6;i++){
   const bonus=options.experimental&&options.bonusCells?.[key(x+i*dx,y+i*dy)];
   if(bonus&&!bonus.used)priority+=bonus.type==='3x'?18:bonus.type==='2x'?12:Number(bonus.type.slice(1))||0;
  }
  roots.set(`${x},${y}:${dx}`,{x,y,dx,dy,priority});
 }
 if(!occupied.length){for(const [dx,dy]of dirs)addRoot(0,0,dx,dy);}
 else for(const pos of occupied){
  const [x,y]=pos.split(',').map(Number);
  for(const [ax,ay]of [[1,0],[-1,0],[0,1],[0,-1]]){
   const sx=x+ax,sy=y+ay;if(board[key(sx,sy)])continue;
   // A legal line may begin before the first cell touching the existing board.
   for(const [dx,dy]of dirs)for(let offset=0;offset<6;offset++)addRoot(sx-offset*dx,sy-offset*dy,dx,dy);
  }
 }
 let nodes=0;
 const budget=300000;
 for(const {x,y,dx,dy}of [...roots.values()].sort((a,b)=>b.priority-a.priority)){
  function search(px,py,remaining,placed,connected){
   if(++nodes>budget)return;
   if(connected&&placed.length&&(!opening||placed.length===opening)){
    const result=validate(board,hand,placed,options);
    if(!result.error&&(!best||result.score>best.score||result.score===best.score&&placed.length>best.placements.length))best={score:result.score,placements:placed.map(p=>({...p}))};
   }
   if(!remaining.length)return;
   while(board[key(px,py)]){px+=dx;py+=dy;}
   if(Math.abs(px)>110||Math.abs(py)>110)return;
   for(const tile of remaining){
    if(placed.length&&!placed.every(p=>p.c===tile.c)&&!placed.every(p=>p.s===tile.s))continue;
    const position=key(px,py);trial[position]=tile;
    const valid=dirs.every(([lx,ly])=>legal(line(trial,px,py,lx,ly)));
    if(valid)search(px+dx,py+dy,remaining.filter(t=>t.id!==tile.id),[...placed,{id:tile.id,c:tile.c,s:tile.s,x:px,y:py}],connected||adjacent(px,py));
    delete trial[position];
    if(nodes>budget)return;
   }
  }
  search(x,y,tiles,[],!occupied.length);
  if(nodes>budget)break;
 }
 return best;
}

export function resignGame(g,actor,text='Pes etti'){
 if(!g||g.over||!g.players[actor]||g.players[actor].eliminated)return false;
 g.players[actor].eliminated=true;g.passes=0;
 g.history.unshift({name:g.players[actor].name,score:0,text,eliminated:true});
 const remaining=g.players.map((p,i)=>p.eliminated?-1:i).filter(i=>i>=0);
 if(remaining.length===1){g.over=true;settleRackPenalty(g);g.winner=remaining[0];g.turnDeadline=null;g.revision++}
 else if(g.turn===actor){next(g);if(!Object.keys(g.board).length)g.opening=g.experimental?1:largest(g.players[g.turn].hand).length}
 else g.revision++;
 if(g.timeoutDecision){if(g.over||g.timeoutDecision.actor===actor)g.timeoutDecision=null;else if(g.players[g.timeoutDecision.decider]?.eliminated)g.timeoutDecision.decider=g.turn;if(g.timeoutDecision)g.turnDeadline=null;else if(!g.over)g.turnDeadline=g.turnSeconds?Date.now()+g.turnSeconds*1000:null;}
 return true;
}
export function expireTurn(g,now=Date.now()){
 if(celebrationLocked(g,now)||g.over||g.timeoutDecision||!g.turnSeconds||!g.turnDeadline||now<g.turnDeadline)return false;
 const actor=g.turn;g.timeoutCounts??=g.players.map(()=>0);g.timeoutCounts[actor]=(g.timeoutCounts[actor]||0)+1;
 g.history.unshift({name:g.players[actor].name,score:0,text:'Süresi doldu · '+g.timeoutCounts[actor]+'/3',timeout:true});next(g);
 if(g.timeoutCounts[actor]>=3){g.timeoutDecision={actor,decider:g.turn};g.turnDeadline=null;}
 if(!Object.keys(g.board).length)g.opening=g.experimental?1:largest(g.players[g.turn].hand).length;
 if(!g.timeoutDecision)g.turnDeadline=now+g.turnSeconds*1000;return true;
}
export function resolveTimeout(g,actor,forfeit,now=Date.now()){
 const decision=g.timeoutDecision;if(!decision||g.over||actor!==decision.decider||g.players[actor]?.eliminated)throw Error('Bu karar sana ait değil.');
 if(typeof forfeit!=='boolean')throw Error('Bir seçenek seç.');g.timeoutDecision=null;
 if(forfeit)resignGame(g,decision.actor,'3. süre aşımı · rakibin kararıyla elendi');
 else{g.timeoutCounts[decision.actor]=0;g.history.unshift({name:g.players[actor].name,score:0,text:g.players[decision.actor].name+' ile devam etmeyi seçti'});g.revision++;}
 g.turnDeadline=g.over?null:g.turnSeconds?now+g.turnSeconds*1000:null;return true;
}
