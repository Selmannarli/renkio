import {opening} from './startup.mjs';
import {celebrationLocked} from './engine.mjs';
import {HERO_TIMING} from './character-style.mjs';
import {t} from './i18n.mjs';
export const CHARACTER_CLIPS=['El salla','Selam ver','Göz kırp','Ayağını kaldır','Göz kırp ve eğil','Kollarını dalgalandır'].map(name=>({name,duration:1850}));
let portraits,loading,installed=false;
const requests=new WeakMap();
const reduced=()=>document.body?.dataset.motion==='reduced'||matchMedia('(prefers-reduced-motion: reduce)').matches;
async function portraitRuntime(){
 if(portraits)return portraits;
 if(!loading)loading=Promise.resolve(opening?.finished).then(()=>import('./table-engine.mjs')).then(({CharacterPortraits})=>portraits=new CharacterPortraits({reduced})).catch(error=>{for(const art of document.querySelectorAll('.character-art'))art.dataset.modelState='unavailable';console.warn('Character renderer unavailable',error.message);return null});return loading;
}
export async function waitForCharacters(){await portraitRuntime();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))}
export function characterHasVoice(mood){return ['hello','win','lose','draw','celebrate','impact','angry','surprise'].includes(mood)||typeof mood==='string'&&mood.startsWith('greet')}
export function playCharacter(host,mood='hello',remaining=null,options={}){
 const art=host?.matches?.('.character-art')?host:host?.querySelector?.('.character-art');if(!art)return null;const request={};requests.set(art,request);
 return portraitRuntime().then(studio=>{if(studio&&art.isConnected&&requests.get(art)===request){const played=studio.play(art,mood,remaining,options);if(played&&remaining===null&&characterHasVoice(mood))document.dispatchEvent(new CustomEvent('character-voice',{detail:{face:Number(art.dataset.character),mood}}));return studio}});
}
export function installCharacterMotion(root=document){
 if(installed)return;installed=true;let frame;
 const sync=async()=>{frame=null;const arts=[...root.querySelectorAll('.character-art')];if(!arts.length)return;const studio=await portraitRuntime();if(!studio)return;
  for(const avatar of root.querySelectorAll('.illustrated-avatar'))if(!avatar.hasAttribute('role')&&!avatar.parentElement?.closest('button,a,[role="button"]')){avatar.setAttribute('role','button');avatar.tabIndex=0;avatar.dataset.motionOnly='true';avatar.setAttribute('aria-label',(avatar.dataset.avatarName||t('Karakter'))+' · '+t('Canlandır'))}
  for(const art of arts)if(art.isConnected)studio.add(art);studio.prune();studio.invalidate();
 };
 const schedule=()=>{if(!frame)frame=requestAnimationFrame(sync)};
 root.addEventListener('click',event=>{const host=event.target.closest?.('.illustrated-avatar,.home-portrait,.avatar-preview');if(host&&!host.matches(".avatar-preview"))playCharacter(host)},{capture:true});
 root.addEventListener('keydown',event=>{const host=event.target.closest?.('[data-motion-only="true"]');if(host&&['Enter',' '].includes(event.key)){event.preventDefault();host.click()}});
 const containsArt=n=>n.nodeType===1&&(n.matches('.character-art')||n.querySelector('.character-art'));
 new MutationObserver(records=>{if(records.some(r=>r.type==='attributes'||[...r.addedNodes,...r.removedNodes].some(containsArt)))schedule()}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['data-motion','open','data-character','data-colour','data-accessory','data-accessory-colours','data-animation-greeting','data-animation-win','data-animation-loss']});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelCharacterVisit();portraits?.pause()}else schedule()});window.addEventListener('scroll',()=>portraits?.request(),{passive:true});window.addEventListener('resize',()=>{cancelCharacterVisit();portraits?.invalidate()},{passive:true});window.addEventListener('pagehide',()=>portraits?.pause());window.addEventListener('pageshow',schedule);matchMedia('(prefers-reduced-motion: reduce)').addEventListener?.('change',schedule);schedule();
}

// Outcomes describe the character on screen, never the person viewing that character.
export function gameOutcomes(game){
 if(!game?.over||!Array.isArray(game.players))return [];
 const players=game.players,active=players.map((p,i)=>p.eliminated?-1:i).filter(i=>i>=0);
 if(!active.length)return players.map(()=>'lose');
 if(Number.isInteger(game.winner)&&active.includes(game.winner))return players.map((_,i)=>i===game.winner?'win':'lose');
 const score=i=>Number.isFinite(players[i].score)?players[i].score:0,highest=Math.max(...active.map(score)),leaders=active.filter(i=>score(i)===highest);
 return players.map((p,i)=>p.eliminated||!leaders.includes(i)?'lose':leaders.length>1?'draw':'win');
}
// Events are based on committed state. A final result overrides the last tile/timeout.
export function characterEvents(previous,next){
 if(!previous||!next||previous.matchId!==next.matchId||previous.revision===next.revision)return [];
 if(next.over){
  const outcomes=gameOutcomes(next);if(previous.over&&JSON.stringify(outcomes)===JSON.stringify(gameOutcomes(previous)))return [];
  return outcomes.map((mood,seat)=>({seat,mood}));
 }
 const events=new Map(),put=(seat,mood)=>events.set(seat,{seat,mood});
 next.timeoutCounts?.forEach((n,i)=>{if(n>(previous.timeoutCounts?.[i]||0))put(i,'sad')});
 const h=next.history?.[0];
 if(h&&JSON.stringify(h)!==JSON.stringify(previous.history?.[0])&&h.score>0){
  const names=next.players.map((p,i)=>p.name===h.name?i:-1).filter(i=>i>=0),actor=Number.isInteger(h.actor)?h.actor:names.length===1?names[0]:-1;
  if(actor>=0&&actor<next.players.length&&!next.players[actor].eliminated){put(actor,'celebrate');if(h.renkios||h.score>=12)next.players.forEach((p,i)=>{if(i!==actor&&!p.eliminated)put(i,'sad')})}
 }
 next.players.forEach((p,i)=>{if(p.eliminated&&!previous.players?.[i]?.eliminated)put(i,'lose')});
 return [...events.values()];
}

export class CharacterReactions{
 constructor(){this.snapshot=null;this.pending=new Map()}
 update(game,now=performance.now()){
  if(this.snapshot?.matchId!==game?.matchId)this.pending.clear();
  for(const event of characterEvents(this.snapshot,game))this.pending.set(event.seat,{...event,until:now+({celebrate:2650,win:2800,lose:2400,draw:1800}[event.mood]||2150)});
  this.snapshot={matchId:game?.matchId,revision:game?.revision,over:game?.over,winner:game?.winner,players:game?.players?.map(p=>({name:p.name,score:p.score,eliminated:!!p.eliminated})),history:game?.history?.slice(0,1),timeoutCounts:game?.timeoutCounts?.slice()};
  for(const [seat,event]of this.pending)if(event.until<=now)this.pending.delete(seat);
  return [...this.pending.values()].map(event=>({...event,remaining:event.until-now}));
 }
}
const reactions=new CharacterReactions();
let heroKey=null,heroNode=null,heroCancel=null;
function launchHero(source,{target=()=>({x:innerWidth/2,y:innerHeight*.47}),elapsed=0,detail={}}={}){
 if(document.hidden)return;if(!source||reduced()){setTimeout(()=>document.dispatchEvent(new CustomEvent('renkio-impact',{detail:{...detail,point:target()}})),Math.max(0,HERO_TIMING.impact-elapsed));return;}heroCancel?.();const rect=source.getBoundingClientRect(),hero=document.createElement('div'),art=source.cloneNode(false),point=target(),x=point.x,y=point.y-34;hero.className='character-hero';hero.setAttribute('aria-hidden','true');hero.append(art);hero.style.left=(x-120)+'px';hero.style.top=(y-140)+'px';(document.querySelector('dialog[open]:modal')||document.body).append(hero);heroNode=hero;document.dispatchEvent(new CustomEvent('renkio-flight',{detail:{busy:true}}));const previousVisibility=source.style.visibility;source.style.visibility='hidden';const light=document.createElement('div');light.className='character-stage-light';hero.parentNode.insertBefore(light,hero);let cleaned=false;const cleanup=()=>{if(cleaned)return;cleaned=true;source.style.visibility=previousVisibility;hero.remove();light.remove();if(heroNode===hero){heroNode=null;heroCancel=null;document.dispatchEvent(new CustomEvent('renkio-flight',{detail:{busy:false}}))}};heroCancel=cleanup;const dx=rect.left+rect.width/2-x,dy=rect.top+rect.height/2-y;playCharacter(art,'impact',Math.max(0,HERO_TIMING.duration-elapsed));
 const frames=[[0,dx,dy,.26,0],[.16,0,0,1,1],[.29,0,9,.96,1],[HERO_TIMING.impact/HERO_TIMING.duration,0,0,1.30,1],[.46,0,2,1.14,1],[.66,0,0,1,1],[.86,0,-5,1,1],[1,dx,dy,.26,0]],started=performance.now()-elapsed;let frame,impacted=false;
 const tick=now=>{if(cleaned)return;const t=Math.min(1,(now-started)/HERO_TIMING.duration);if(!impacted&&now-started>=HERO_TIMING.impact){impacted=true;document.dispatchEvent(new CustomEvent('renkio-impact',{detail:{...detail,point:target()}}))}let i=1;while(i<frames.length-1&&t>frames[i][0])i++;const a=frames[i-1],b=frames[i],u=(t-a[0])/(b[0]-a[0]),ease=u*u*(3-2*u),mix=j=>a[j]+(b[j]-a[j])*ease;hero.style.transform=`translate3d(${mix(1)}px,${mix(2)}px,0) scale(${mix(3)})`;hero.style.opacity=String(mix(4));light.style.opacity=String(Math.min(1,t/.12,(1-t)/.12));if(t<1)frame=requestAnimationFrame(tick);else cleanup()};light.style.animation='none';hero.style.willChange='transform,opacity';frame=requestAnimationFrame(tick);

}
export function previewCelebration(host){const source=host?.querySelector('.character-art');if(!source)return;launchHero(source,{detail:{preview:true,score:12,renkios:1}})}
function scoreHero(game,options){
 const h=game.celebration,key=game.matchId+':'+(h?.revision||game.revision);if(heroKey===null||!heroKey.startsWith(game.matchId+':')){heroKey=key;return}if(heroKey===key)return;heroKey=key;if(!h||h.revision!==game.revision)return;launchHero(document.querySelector('#scores [data-seat="'+h.actor+'"] .character-art'),{target:options.target,elapsed:options.elapsed||0,detail:{matchId:game.matchId,revision:h.revision,score:h.score,renkios:h.renkios}});
}
export function reactToGame(game,options={}){
 if(options.animateScore!==false)scoreHero(game,options);
 for(const event of reactions.update(game)){
  if(game.celebration&&!game.celebration.released&&Date.now()<game.celebration.until)continue;
  const host=document.querySelector('#scores [data-seat="'+event.seat+'"] .illustrated-avatar'),art=host?.querySelector('.character-art');
  const mood=event.mood==='sad'&&!game.over?(game.history?.[0]?.score>=24?'surprise':(game.timeoutCounts?.[event.seat]||0)>=2?'angry':'sad'):event.mood;const reactionId=game.matchId+':'+event.seat+':'+event.until;if(art&&art.dataset.reactionId!==reactionId){art.dataset.reactionId=reactionId;playCharacter(host,mood,Math.min(event.remaining,mood==='surprise'?1500:mood==='angry'?1800:event.remaining));}
 }
}

export class WaitingCharacters{
 constructor(){this.key=null;this.started=0;this.seen=new Set()}
 update(game,now,{visible=true,blocked=false}={}){
  const key=game?[game.matchId,game.turn,game.history?.length||0].join(':'):null;
  if(key!==this.key){this.key=key;this.started=now;this.seen.clear()}
  if(!visible||blocked||!game||game.over||game.timeoutDecision)return null;
  const since=game.turnDeadline&&game.turnSeconds?now-(game.turnDeadline-game.turnSeconds*1000):now-this.started;
  const cycle=Math.floor((since-6000)/26000);if(cycle<0||cycle>8||this.seen.has(cycle))return null;
  this.seen.add(cycle);const seats=game.players.map((p,i)=>!p.eliminated&&i!==game.turn?i:-1).filter(i=>i>=0);
  const script=['frameLean','frameSit','framePeek','frameVault','frameSleep','frameClean','frameFix','frameYawn','frameHighFive'];
  return {key,seats,mood:script[(cycle+(game.history?.length||0))%script.length]};
 }
}
// A short reminder, once per turn, with no translated walking/climbing actor.
export const TELEPORT_DURATION=3600;
export function teleportWindow(seconds){return ({30:5,60:9,120:30})[seconds]||0}
export function teleportEligible(game,me,now){const window=teleportWindow(game?.turnSeconds),remaining=(game?.turnDeadline||0)-now;return !!(window&&game&&!game.over&&!game.timeoutDecision&&game.turn===me&&!game.players?.[me]?.eliminated&&remaining>=TELEPORT_DURATION&&remaining<=window*1000)}
const waitingSeen=new Set();let visitor=null;
export function characterVisitActive(){return !!visitor}
export function cancelCharacterVisit(){visitor?.();visitor=null}
function smokeAt(x,y,size,parent,nodes){
 document.dispatchEvent(new CustomEvent('character-sound',{detail:{kind:'teleport'}}));
 const cloud=document.createElement('div');cloud.className='teleport-smoke';cloud.setAttribute('aria-hidden','true');cloud.style.left=x+'px';cloud.style.top=y+'px';cloud.style.setProperty('--smoke-size',size+'px');
 for(let i=0;i<9;i++){const puff=document.createElement('i'),angle=i/9*Math.PI*2;puff.style.setProperty('--smoke-x',Math.cos(angle)*(size*.46)+'px');puff.style.setProperty('--smoke-y',Math.sin(angle)*(size*.34)-size*.10+'px');puff.style.setProperty('--smoke-delay',i%3*25+'ms');cloud.append(puff)}parent.append(cloud);nodes.push(cloud);
}
export function updateWaitingCharacters(game,{now=Date.now(),me=0,button=null}={}){
 if(!game||game.over||document.hidden||document.querySelector('dialog[open]')||reduced()||game.timeoutDecision||celebrationLocked(game,now)||!button||document.querySelector('.apple-flight')){cancelCharacterVisit();return}
 const stamp=[game.matchId,game.turn,game.turnSerial||game.history?.length||0].join(':');
 if(visitor){if(visitor.stamp!==stamp||game.turn!==me||game.turnDeadline-now>teleportWindow(game.turnSeconds)*1000)cancelCharacterVisit();return}
 if(!teleportEligible(game,me,now)||waitingSeen.has(stamp))return;
 const source=document.querySelector('#scores [data-seat="'+me+'"] .character-art');if(!source||!source.getClientRects().length||source.dataset.emotion==='appleHit'||source.dataset.emotion==='knock'||/^(win|loss|impact)/.test(source.dataset.emotion||''))return;
 waitingSeen.add(stamp);while(waitingSeen.size>120)waitingSeen.delete(waitingSeen.values().next().value);
 const from=source.getBoundingClientRect(),to=button.getBoundingClientRect(),size=Math.min(148,Math.max(76,from.width*Number(source.dataset.fullFrameRatio||1.7))),wrap=document.createElement('div'),art=source.cloneNode(false),nodes=[],parent=document.body;
 delete art.dataset.emotion;delete art.dataset.baseEmotion;delete art.dataset.modelReady;wrap.className='character-visitor teleport-visitor';wrap.setAttribute('aria-hidden','true');wrap.append(art);wrap.style.width=wrap.style.height=size+'px';
 // Appear beside the button, facing it; the tile rack and button remain clickable.
 const x=Math.max(2,to.left-size*.78),y=Math.max(4,Math.min(innerHeight-size,to.top+to.height*.5-size*.64));wrap.style.left=x+'px';wrap.style.top=y+'px';wrap.style.opacity='0';parent.append(wrap);
 const originalVisibility=source.style.visibility,home={x:from.left+from.width/2,y:from.top+from.height/2},away={x:x+size*.5,y:y+size*.52};
 let frame,done=false,phase=-1,appeared=false,left=false,returned=false,hit1=false,hit2=false;const began=performance.now();
 const cleanup=()=>{if(done)return;done=true;cancelAnimationFrame(frame);wrap.remove();for(const n of nodes)n.remove();source.style.visibility=originalVisibility;button.classList.remove('character-bop');if(visitor===cleanup)visitor=null};cleanup.stamp=stamp;visitor=cleanup;source.style.visibility='hidden';smokeAt(home.x,home.y,Math.max(72,from.width*1.5),parent,nodes);
 const tick=time=>{if(done)return;const elapsed=time-began;if(document.hidden||!source.isConnected||!button.isConnected||document.querySelector('dialog[open]')||reduced()){cleanup();return}
  if(elapsed>=350&&!appeared){appeared=true;smokeAt(away.x,away.y,size,parent,nodes);wrap.style.opacity='1'}
  const next=elapsed<650?0:elapsed<1550?1:elapsed<2500?2:3;
  if(next!==phase){phase=next;wrap.dataset.teleportPhase=['arrival','punch','kick','return'][phase];const start=[350,650,1550,2500][phase],mood=phase===1?'visitorStrike':phase===2?(Number(source.dataset.character)===5?'visitorStrike':'kick'):'idle';playCharacter(art,mood,phase===1||Number(source.dataset.character)===5&&phase===2?Math.max(1,650-(elapsed-start)):phase===2?Math.max(1,900-(elapsed-start)):1,{force:true})}
  if(elapsed>=930&&!hit1){hit1=true;document.dispatchEvent(new CustomEvent('character-sound',{detail:{kind:'buttonHit'}}));button.classList.add('character-bop')}
  if(elapsed>=1380&&elapsed<(Number(source.dataset.character)===5?1830:1940))button.classList.remove('character-bop');
  if(elapsed>=(Number(source.dataset.character)===5?1830:1940)&&!hit2){hit2=true;document.dispatchEvent(new CustomEvent('character-sound',{detail:{kind:'buttonHit'}}));button.classList.add('character-bop')}
  if(elapsed>=2390)button.classList.remove('character-bop');
  if(elapsed>=2800&&!left){left=true;wrap.style.opacity='0';smokeAt(away.x,away.y,size,parent,nodes)}
  if(elapsed>=3100&&!returned){returned=true;source.style.visibility=originalVisibility;smokeAt(home.x,home.y,Math.max(72,from.width*1.5),parent,nodes)}
  if(elapsed<TELEPORT_DURATION)frame=requestAnimationFrame(tick);else cleanup();
 };frame=requestAnimationFrame(tick);
}

export function scoreStripKey(game,me,room,ownAvatar){return JSON.stringify([game.matchId,me,game.turn,game.over,game.timeoutCounts,ownAvatar,game.players.map((p,i)=>[p.name,p.score,p.eliminated,p.count??p.hand?.length,room?.seats[i]?.kicked,room?.seats[i]?.avatar,room?.seats[i]?.playerId])])}



