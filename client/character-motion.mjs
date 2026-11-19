import {HERO_TIMING} from '../public/character-style.mjs';
import {sampleEmoteClip,hasEmoteClip,stopEmoteClip} from './emote-clips.mjs';
import {Vector3,Quaternion,Euler} from 'three';
import {ANIMATION_DURATIONS,animationEmotion} from '../public/animation-style.mjs';
// Shared articulated animation. Every sample starts from the authored rest pose,
// so a portrait, a seated player and a paused/seeked preview have identical motion.
export const CHARACTER_DURATIONS=Object.freeze({appleAim:60,appleThrow:.65,appleHit:2.6,walkLeft:1.4,walkRight:1.4,climbDown:2.2,climbUp:2.2,ledge:1,punch:.9,kick:.9,waveLeft:2.6,waveRight:2.6,bored:5.6,buttonPunch:4.8,knock:1.8,hello:1.85,celebrate:2.65,sad:2.15,win:2.8,lose:2.4,draw:1.8,angry:1.8,surprise:1.5,impact:HERO_TIMING.duration/1000,...ANIMATION_DURATIONS});
const rests=new WeakMap();
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=x=>{x=clamp(x);return x*x*x*(x*(x*6-15)+10)};
const rise=(t,a,b)=>smooth((t-a)/(b-a));
const envelope=(t,a,b,c,d)=>rise(t,a,b)*(1-rise(t,c,d));
const vec=n=>[n?.x||0,n?.y||0,n?.z||0];
const values=(a,v)=>{if(a?.set)a.set(...v);else if(a){a.x=v[0];a.y=v[1];a.z=v[2]}};
const nodes=rig=>[rig.facial?.mesh,...(rig.facial?.details||[]),...(rig.facial?.brows||[]).map(b=>b.children[0]),rig.head,rig.body,...(rig.eyes||[]),...(rig.pupils||[]),...(rig.lids||[]),...(rig.arms||[]),...(rig.forearms||[]),...(rig.hands||[]),...(rig.ears||[]),...(rig.legs||[]),...(rig.knees||[]),...(rig.brows||[]),rig.tail,rig.accent,rig.hips,...Object.values(rig.mouth||{})].filter(Boolean);
function remember(n){return {position:vec(n.position),rotation:vec(n.rotation),scale:n.scale?vec(n.scale):[1,1,1],visible:n.visible!==false}}
export function captureRest(root){
 const rig=root?.userData?.rig;if(!rig)return null;
 const state={rig,root:remember(root),nodes:new Map(nodes(rig).map(n=>[n,remember(n)]))};rests.set(root,state);return state;
}
function stateFor(root){const saved=rests.get(root);return saved?.rig===root?.userData?.rig?saved:captureRest(root)}
export function captureCharacterPose(root,reuse=null){
 const state=stateFor(root);if(state&&reuse?.length===state.nodes.size+1&&reuse[0].node===root){for(const p of reuse){p.position.copy(p.node.position);p.quaternion.copy(p.node.quaternion);p.scale.copy(p.node.scale);if(p.morph)for(let i=0;i<p.morph.length;i++)p.morph[i]=p.node.morphTargetInfluences[i]}return reuse}return state?[root,...state.nodes.keys()].map(n=>({node:n,position:n.position.clone(),quaternion:n.quaternion.clone(),scale:n.scale.clone(),morph:n.morphTargetInfluences?.slice()})):[];
}
export function blendCharacterPose(previous,amount){
 const weight=smooth(amount);for(const {node,position,quaternion,scale,morph}of previous){node.position.lerpVectors(position,node.position,weight);const target=node.quaternion.clone();node.quaternion.slerpQuaternions(quaternion,target,weight);node.scale.lerpVectors(scale,node.scale,weight);if(morph)for(let i=0;i<morph.length;i++)node.morphTargetInfluences[i]=morph[i]+(node.morphTargetInfluences[i]-morph[i])*weight}
}
export function resetCharacter(root){
 stopEmoteClip(root);const state=stateFor(root);if(!state)return;
 const restore=(n,r)=>{values(n.position,r.position);values(n.rotation,r.rotation);values(n.scale,r.scale);n.visible=r.visible};
 restore(root,state.root);for(const [n,rest]of state.nodes)restore(n,rest);
 state.rig.facial?.reset();setMouth(state.rig,'neutral');for(const lid of state.rig.lids||[])lid.visible=false;
}
// Painted (glb) faces have their own mouth for every feeling.
function glbMouth(mood,emotion){if(mood==='surprise'||mood==='appleHit')return 'surprise';if(mood==='angry'||mood==='lossAngry'||mood==='lossStomp')return 'angry';return emotion}
function setMouth(rig,expression){
 rig.facial?.expression(expression);const mouth=rig.mouth||rig.mouths;if(!mouth)return;
 for(const key of ['neutral','happy','sad'])if(mouth[key])mouth[key].visible=key===expression;
}
function rotate(n,x=0,y=0,z=0){if(!n?.rotation)return;n.rotation.x+=x;n.rotation.y+=y;n.rotation.z+=z}
function move(n,x=0,y=0,z=0){if(!n?.position)return;n.position.x+=x;n.position.y+=y;n.position.z+=z}
function stretch(n,x=1,y=1,z=1){if(!n?.scale)return;n.scale.x*=x;n.scale.y*=y;n.scale.z*=z}
function brow(rig,emotion,strength=1){
 if(rig.facial){rig.facial.brow(emotion,strength);return}
 (rig.brows||[]).forEach((n,i)=>{
  const side=i%2===0?-1:1;
  if(emotion==='sad'){rotate(n,0,0,-side*.18*strength);move(n,0,.008*strength,0)}
  else if(emotion==='angry'){rotate(n,0,0,side*.30*strength);move(n,0,-.014*strength,0)}
  else if(emotion==='happy'){rotate(n,0,0,side*.035*strength);move(n,0,.025*strength,0)}
 });
}
function blink(rig,amount,eyeIndex=null){
 const close=clamp(amount);(rig.eyes||[]).forEach((eye,i)=>{
  if(eyeIndex!==null&&i!==eyeIndex)return;
  const lid=rig.lids?.[i];
  if(lid){eye.visible=close<.82;lid.visible=close>=.82;stretch(eye,1,Math.max(.045,1-close*.955),1)}
  else stretch(eye,1+close*.025,Math.max(.07,1-close*.93),1);
 });
}
function blinkAt(t,start,hold=.026,close=.062,open=.11){
 return rise(t,start,start+close)*(1-rise(t,start+close+hold,start+close+hold+open));
}
function key(t,points){
 if(t<=points[0][0])return points[0][1];
 for(let i=1;i<points.length;i++){const [end,v]=points[i],[start,p]=points[i-1];if(t<=end)return p+(v-p)*smooth((t-start)/(end-start))}
 return points.at(-1)[1];
}
function jump(t,start,duration,height){const p=(t-start)/duration;return p>0&&p<1?4*height*p*(1-p):0}
function arm(rig,index,lift,forward=0){const n=rig.arms?.[index];if(!n)return;const sign=index%2===0?-1:1,g=rig.armGain??1;rotate(n,forward*g,0,sign*lift*g)}
function bend(rig,index,elbow=0,wrist=0){
 const fore=rig.forearms?.[index],hand=rig.hands?.[index];
 rotate(fore,-elbow,0,0);rotate(hand,0,wrist*.3,(index?1:-1)*wrist);
}
// Shared life layer. Soft, volume-preserving breathing, a slow weight shift,
// follow-through on ears, tails and antennae, livelier eyes and an occasional
// cute beat (tilt + smile, or a tiny hop). Everything is a pure function of time,
// so portraits, seated players and seeked previews stay deterministic.
const hash=n=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x)};
function alive(rig,root,time,face,phase,period){
 const rigid=face===1,seated=rig.pose==='seated';
 const breath=Math.sin(time*1.9+face*.6),sway=Math.sin(time*.82+face*1.3),swayLag=Math.sin(time*.82+face*1.3-.75);
 // breathing: chest rises while the body narrows a touch (volume preserved)
 const sq=rigid?.35:1;stretch(rig.body,1-breath*.0075*sq,1+breath*.017*sq,1-breath*.006*sq);
 if(rig.hips&&!rigid)stretch(rig.hips,1+breath*.004,1-breath*.003,1+breath*.004);
 move(rig.head,0,breath*.0045,0);
 // weight shift: the actor leans, the head counter-balances, appendages follow late
 if(!seated)rotate(root,0,0,sway*.014);
 rotate(rig.head,0,0,-sway*.022);
 (rig.ears||[]).forEach((n,i)=>rotate(n,0,0,(i?1:-1)*(.025+swayLag*.035)+breath*.012));
 rotate(rig.tail,0,swayLag*.12,Math.sin(time*1.7)*.035);
 rotate(rig.accent,0,0,swayLag*.05+breath*.015);
 if(face!==5)(rig.arms||[]).forEach((n,i)=>rotate(n,0,0,(i%2?1:-1)*(.02+breath*.018)));
 // cute beat: a head tilt with a little smile, once per cycle
 const tiltSide=hash(Math.floor((time+face*.73)/period)+face)>.5?1:-1;
 const tilt=envelope(phase,period*.70,period*.70+.45,period*.70+1.45,period*.70+2.0);
 if(tilt>0){rotate(rig.head,-tilt*.03,tiltSide*tilt*.05,tiltSide*tilt*.11);brow(rig,'happy',tilt*.7);if(tilt>.35)setMouth(rig,'happy')}
 // second, natural blink; every other cycle it is a quick double blink
 const cycle=Math.floor((time+face*.73)/period),b2=period*.55;
 let close=blinkAt(phase,b2);if(cycle%2)close=Math.max(close,blinkAt(phase,b2+.32));
 if(close>0)blink(rig,close);
 // eyes dart between a few resting points instead of staring
 const dart=Math.floor(time*.9+face),dx=(hash(dart)-.5)*.012,dy=(hash(dart+7)-.5)*.006,settle=smooth((time*.9+face)%1/.12);
 for(const eye of rig.eyes||[])for(const pupil of eye.children.filter(n=>n.name==='Pupil')){pupil.position.x+=dx*settle;pupil.position.y+=dy*settle}
 // tiny happy hop on alternate cycles (standing only, always above the floor)
 if(!seated&&cycle%2===1){
  const at=period*.18,squat=envelope(phase,at,at+.12,at+.16,at+.26),land=envelope(phase,at+.5,at+.56,at+.62,at+.78),up=jump(phase,at+.2,.34,.022);
  move(root,0,up,0);
  if(!rigid){stretch(rig.body,1+(squat+land)*.03,1-(squat+land)*.05+up*1.4,1+(squat+land)*.03)}
 }
}
function idle(rig,time,face,root=null){
 const period=[7.1,8.7,7.8,6.9,8.1,8.4,7.4][face],phase=((time+face*.73)%period+period)%period;
 let close=blinkAt(phase,1.27,face===2?.075:.026,face===2?.095:.062,face===2?.16:.11);
 if(face===3)close=Math.max(close,blinkAt(phase,1.58));
 blink(rig,close);
 const look=envelope(phase,2.7,3.25,4.25,4.9),breath=(Math.sin(time*1.45+face*.6)+1)*.5;
 rotate(rig.head,-look*.018,(face%2?1:-1)*look*.065,0);
 for(const eye of rig.eyes||[])for(const pupil of eye.children.filter(n=>n.name==='Pupil')){pupil.position.x=look*(face%2?-.01:.01);pupil.position.y=0}
 if(face===0){
  stretch(rig.body,1+breath*.004,1+breath*.009,1+breath*.003);
  rotate(rig.accent,0,0,Math.sin(time*1.1)*.018);arm(rig,0,breath*.012);arm(rig,1,breath*.012);
 }else if(face===1){
  const scan=envelope(phase,3.0,3.45,4.2,4.8);rotate(rig.head,-scan*.025,scan*.10,0);
  rotate(rig.accent,0,0,scan*.045);bend(rig,0,.025+breath*.012);bend(rig,1,.025+breath*.012);
 }else if(face===2){
  const flick=envelope(phase,4.8,4.95,5.0,5.25);rotate(rig.ears?.[0],0,0,-flick*.12);rotate(rig.ears?.[1],0,0,flick*.06);
  rotate(rig.tail,0,Math.sin(time*.8)*.13,0);stretch(rig.body,1,1+breath*.008,1);
 }else if(face===3){
  const curious=envelope(phase,3,3.55,4.4,5.1);rotate(rig.head,-curious*.025,curious*.06,-curious*.035);
  stretch(rig.body,1+breath*.003,1+breath*.008,1);rotate(rig.accent,0,0,Math.sin(time*1.2)*.025);
 }else if(face===4){
  const proud=envelope(phase,3,3.7,4.2,5);rotate(rig.head,-proud*.035,proud*.05,proud*.035);
  bend(rig,0,proud*.18);bend(rig,1,proud*.18);stretch(rig.body,1,1+breath*.007,1);
 }else{
  // The bell stays attached to the tentacles. Only their tips breathe in sequence.
  stretch(rig.head,1+breath*.003,1+breath*.006,1);
  (rig.arms||[]).forEach((n,i)=>{rotate(n,Math.sin(time*.85-i*.55)*.018,0,Math.sin(time*.9-i*.7)*.022);rotate(rig.forearms?.[i],0,0,Math.sin(time*1.1-i*.6)*.06)});
 }
 {const period=[7.1,8.7,7.8,6.9,8.1,8.4,7.4][face],phase=((time+face*.73)%period+period)%period;if(root)alive(rig,root,time,face,phase,period)}
}
function greet(rig,t,face,root=null){
 {const squat=envelope(t,.02,.10,.12,.20),land=envelope(t,.46,.52,.56,.70),hop=jump(t,.16,.32,.03);
  if(rig.pose!=='seated'&&root)move(root,0,hop,0);
  if(face!==1)stretch(rig.body,1+(squat+land)*.025,1-(squat+land)*.045+hop*1.2,1+(squat+land)*.025)}
 const engaged=envelope(t,.02,.30,1.30,1.85),lift=key(t,[[0,0],[.14,-.07],[.49,1.24],[1.18,1.24],[1.80,0],[1.85,0]]);
 const wave=key(t,[[0,0],[.42,0],[.64,-.22],[.85,.21],[1.06,-.17],[1.25,.10],[1.60,0],[1.85,0]]);
 blink(rig,blinkAt(t,.16));brow(rig,'happy',engaged*.65);
 rotate(rig.head,key(t,[[0,0],[.22,.035],[.57,-.055],[1.22,-.025],[1.85,0]]),engaged*.04,0);
 if(face===0){
  arm(rig,1,lift,-engaged*.12);bend(rig,1,engaged*.65,wave);arm(rig,0,engaged*.10);rotate(rig.head,0,0,-engaged*.06);
  rotate(rig.accent,0,0,-wave*.13);
 }else if(face===1){
  arm(rig,1,lift*.88,-engaged*.15);bend(rig,1,engaged*.85,wave*.72);
  rotate(rig.head,-engaged*.055,engaged*.055,-engaged*.045);rotate(rig.accent,0,0,wave*.22);
 }else if(face===2){
  // A raised paw and a deliberate wink; the paw has an elbow instead of stretching.
  arm(rig,1,lift*.75,-engaged*.25);bend(rig,1,engaged*1.10,wave*.55);
  rotate(rig.head,-engaged*.035,engaged*.035,engaged*.08);blink(rig,blinkAt(t,.83,.09,.06,.16),0);
  rotate(rig.tail,0,Math.sin(t*4)*engaged*.23,0);rotate(rig.ears?.[1],0,0,-engaged*.08);
 }else if(face===3){
  arm(rig,1,lift*.88,-engaged*.18);bend(rig,1,engaged*.75,wave*.5);
  rotate(rig.head,-engaged*.055,-engaged*.05,-engaged*.045);arm(rig,0,engaged*.12);
  rotate(rig.accent,0,0,wave*.10);
 }else if(face===4){
  arm(rig,0,lift*.82,-engaged*.14);arm(rig,1,lift,-engaged*.14);
  bend(rig,0,engaged*.6,-wave*.8);bend(rig,1,engaged*.6,wave);
  rotate(rig.head,-engaged*.03,0,engaged*.055);
 }else{
  (rig.arms||[]).forEach((n,i)=>{const cue=envelope(t,.04+i*.045,.36+i*.045,1.06+i*.035,1.62+i*.035);rotate(n,-cue*.24,0,(i<rig.arms.length/2?-1:1)*cue*(.29+Math.sin(t*5-i*.75)*.055));rotate(rig.forearms?.[i],0,0,(i<rig.arms.length/2?-1:1)*cue*.26)});
  rotate(rig.head,-engaged*.035,engaged*.06,-engaged*.035);
 }
}
function celebrate(rig,root,t,face,duration){
 const anticipate=envelope(t,.01,.15,.20,.40),raise=envelope(t,.17,.58,duration-.68,duration-.03);
 const pulse=jump(t,.71,.38,.10)+jump(t,1.3,.38,.08);
 rotate(rig.head,anticipate*.055-raise*.09,Math.sin(t*3)*raise*.02,Math.sin(t*4)*raise*.025);
 brow(rig,'happy',raise);blink(rig,Math.max(blinkAt(t,.18),blinkAt(t,.83,.15,.08,.15)));
 if(face!==1)stretch(rig.body,1+anticipate*.012,1-anticipate*.022+raise*.01,1+anticipate*.007);
 if(rig.pose!=='seated'){move(root,0,jump(t,.43,.42,.075)+jump(t,1.08,.37,.045),0);const landing=envelope(t,.83,.88,.92,1.05)+envelope(t,1.43,1.48,1.52,1.64)*.7;if(face!==1)stretch(rig.body,1+landing*.035,1-landing*.06,1+landing*.035)}
 if(face!==5){
  const strength=[1,.92,.88,.96,1,1,1][face];
  arm(rig,0,(raise*1.52+pulse)*strength,-raise*.12);arm(rig,1,(raise*1.65+pulse*.8)*strength,-raise*.15);
  bend(rig,0,raise*.47,raise*.08);bend(rig,1,raise*.60,-raise*.08);
 }else (rig.arms||[]).forEach((n,i)=>{rotate(n,-raise*.20,0,(i<rig.arms.length/2?-1:1)*raise*(.38+Math.sin(t*6-i*.65)*.045));rotate(rig.forearms?.[i],0,0,(i<rig.arms.length/2?-1:1)*raise*.25)});
 rotate(rig.tail,0,Math.sin(t*5)*raise*.23,0);rotate(rig.accent,0,0,Math.sin(t*6)*raise*.045);
 (rig.ears||[]).forEach((n,i)=>rotate(n,0,0,(i?1:-1)*raise*.035));
}
function disappointment(rig,t,face,duration){
 const settle=envelope(t,.03,.50,duration-.58,duration-.02);
 rotate(rig.head,settle*.105,-settle*.045,settle*.035);brow(rig,'sad',settle);
 blink(rig,blinkAt(t,.56,.10,.09,.17));
 if(face!==1)stretch(rig.body,1+settle*.004,1-settle*.009,1);
 arm(rig,0,-settle*.035,settle*.025);arm(rig,1,-settle*.035,settle*.025);
 bend(rig,0,settle*.09);bend(rig,1,settle*.09);
 rotate(rig.tail,0,-settle*.15,-settle*.04);rotate(rig.accent,0,0,settle*.06);
 (rig.ears||[]).forEach((n,i)=>rotate(n,0,0,(i?-1:1)*settle*.10));
 if(face===5)(rig.arms||[]).forEach((n,i)=>rotate(n,settle*.02,0,(i<3?1:-1)*settle*.045));
}

function handIndex(rig,side){return rig.face===5?(side<0?0:rig.arms.length-1):(side<0?0:1)}
function handPose(rig,side,lift=0,forward=0,elbow=0,wrist=0){
 const i=handIndex(rig,side),jelly=rig.face===5;
 // The six tentacles are ordered left-to-right, not alternating like arms.
 rotate(rig.arms?.[i],forward,0,side*lift*(jelly?.58:1));
 rotate(rig.forearms?.[i],-elbow*(jelly?.42:1),0,side*wrist);
 rotate(rig.hands?.[i],0,side*wrist*.22,side*wrist);
}
function balanceLegs(rig,a){
 (rig.legs||[]).forEach((n,i)=>rotate(n,-a*.14,0,(i?1:-1)*a*.045));
 (rig.knees||[]).forEach(n=>rotate(n,a*.22,0,0));
}
function happyFace(rig,t,a){brow(rig,'happy',a*.75);blink(rig,blinkAt(t,.16));}
function selectedGreeting(root,rig,mood,t,face,duration){
 const a=envelope(t,.02,.35,duration-.48,duration),w=key(t,[[0,0],[.50,0],[.72,-.31],[.94,.30],[1.16,-.28],[1.38,.24],[1.64,0],[duration,0]]);
 happyFace(rig,t,a);
 if(mood==='greetWave'){
  const lift=key(t,[[0,0],[.15,-.06],[.55,1.82],[1.58,1.82],[2.05,.35],[duration,0]]);
  handPose(rig,1,lift,-a*.20,a*.63,w);handPose(rig,-1,a*.12,0,a*.16);
  rotate(rig.head,-a*.06,a*.05,-a*.075);rotate(rig.accent,0,0,w*.11);
 }else if(mood==='greetBoth'){
  const lift=key(t,[[0,0],[.16,-.045],[.57,1.9],[1.65,1.9],[2.10,.30],[duration,0]]);
  for(const side of [-1,1])handPose(rig,side,lift,-a*.18,a*.53,w*(side<0?-.85:1));
  rotate(rig.head,-a*.08,Math.sin(t*3)*a*.035,0);
  if(face===5)rig.arms.forEach((n,i)=>{if(i===0||i===rig.arms.length-1)return;rotate(n,-a*.13,0,(i<rig.arms.length/2?-1:1)*a*.28)});
 }else if(mood==='greetNod'){
  const nod=envelope(t,.18,.45,.60,.82)+envelope(t,.83,1.10,1.23,1.55)*.70;
  rotate(rig.head,nod*.24,-a*.035,0);blink(rig,Math.max(blinkAt(t,.40,.06),blinkAt(t,1.05,.04)));
  handPose(rig,-1,a*.16,0,a*.25);handPose(rig,1,a*.16,0,a*.25);rotate(rig.accent,nod*.08,0,0);
 }else if(mood==='greetBow'){
  const bow=envelope(t,.18,.68,1.25,2.12);
  rotate(rig.head,bow*.21,0,0);rotate(rig.body,bow*.18,0,0);balanceLegs(rig,bow*.45);
  for(const side of [-1,1])handPose(rig,side,bow*.34,-bow*.20,bow*.18);
  blink(rig,blinkAt(t,.68,.16,.10,.20));rotate(rig.tail,-bow*.12,0,0);
 }else{
  const salute=envelope(t,.22,.59,1.75,2.36),pump=envelope(t,.72,.90,1.0,1.18)+envelope(t,1.22,1.40,1.5,1.68);
  for(const side of [-1,1])handPose(rig,side,salute*(1.15+pump*.50),-salute*.22,salute*.55-pump*.12);
  rotate(rig.head,-salute*.09,0,Math.sin(t*4)*salute*.09);rotate(rig.body,0,0,Math.sin(t*4)*salute*.035);
  (rig.ears||[]).forEach((n,i)=>rotate(n,0,0,(i?1:-1)*salute*.07));
 }
}
function selectedWin(root,rig,mood,t,face,duration){
 const a=envelope(t,.12,.48,duration-.53,duration),anticip=envelope(t,.02,.18,.24,.43);
 happyFace(rig,t,a);rotate(rig.head,anticip*.045-a*.10,0,0);
 if(mood==='winVictory'){
  const hold=envelope(t,.27,.72,2.12,2.80),fist=envelope(t,.94,1.13,1.29,1.55);
  handPose(rig,-1,hold*1.72,-hold*.16,hold*.50);
  handPose(rig,1,hold*(1.85+fist*.30),-hold*.19,hold*.58-fist*.12);
  rotate(rig.body,0,-hold*.08,0);rotate(rig.head,0,hold*.06,-hold*.035);
  balanceLegs(rig,anticip*.45);blink(rig,Math.max(blinkAt(t,.16),blinkAt(t,1.13,.10)));
 }else if(mood==='winDance'){
  const beat=Math.sin((t-.3)*Math.PI*3),sway=beat*a;
  rotate(rig.body,0,sway*.13,sway*.09);rotate(rig.head,0,-sway*.06,-sway*.085);
  for(const side of [-1,1])handPose(rig,side,a*(.86+side*beat*.25),-a*.15,a*(.60-side*beat*.12),sway*.12);
  if(rig.pose!=='seated')for(let i=0;i<(rig.legs||[]).length;i++){const lift=Math.max(0,beat*(i?1:-1))*a;rotate(rig.legs[i],-lift*.27,0,(i?1:-1)*a*.035);rotate(rig.knees?.[i],lift*.48,0,0)}
  rotate(rig.tail,0,-sway*.30,0);rotate(rig.accent,0,0,-sway*.07);
  if(face===5)rig.arms.forEach((n,i)=>rotate(n,-a*.13,0,Math.sin(t*5-i*.65)*a*.15));
 }else{
  const first=jump(t,.43,.58,.06),second=jump(t,1.27,.51,.045),lift=first+second;
  if(rig.pose!=='seated')move(root,0,lift,0);
  balanceLegs(rig,anticip*.7+envelope(t,1.05,1.19,1.26,1.44)*.45);
  for(const side of [-1,1])handPose(rig,side,a*(1.62+lift*2),-a*.20,a*.45);
  rotate(rig.head,0,0,Math.sin(t*5)*a*.04);blink(rig,Math.max(blinkAt(t,.17),blinkAt(t,.77,.08),blinkAt(t,1.55,.06)));
 }
}
function selectedLoss(root,rig,mood,t,face,duration){
 const a=envelope(t,.05,.52,duration-.62,duration),angry=mood==='lossAngry'||mood==='lossStomp';
 brow(rig,angry?'angry':'sad',a);setMouth(rig,rig.glb&&angry?'angry':'sad');
 if(mood==='lossSad'){
  rotate(rig.head,a*.19,-a*.05,-a*.06);rotate(rig.body,a*.035,0,0);
  for(const side of [-1,1])handPose(rig,side,a*.10,a*.06,a*.16,Math.sin(t*3)*a*.045);
  blink(rig,Math.max(blinkAt(t,.71,.12,.12,.22),blinkAt(t,1.75,.06,.1,.2)));
 }else if(mood==='lossSlump'){
  rotate(rig.head,a*.28,a*.13,a*.09);rotate(rig.body,a*.095,-a*.04,0);
  for(const side of [-1,1]){handPose(rig,side,a*.08,a*.03,a*.22);move(rig.arms?.[handIndex(rig,side)],0,-a*.018,0)}
  blink(rig,envelope(t,.64,.78,1.68,1.94));rotate(rig.accent,a*.10,0,a*.08);
  (rig.ears||[]).forEach((n,i)=>rotate(n,0,0,(i?-1:1)*a*.13));
 }else if(mood==='lossAngry'){
  const shake=envelope(t,.65,.82,1.48,1.75)*Math.sin((t-.65)*Math.PI*5);
  rotate(rig.head,a*.045,shake*.09,0);rotate(rig.body,-a*.025,0,0);
  for(const side of [-1,1])handPose(rig,side,a*.42,-a*.13,a*.95,side*a*.10);
  blink(rig,blinkAt(t,1.92,.02,.07,.12));
 }else{
  const wind=envelope(t,.30,.54,.70,.86),impact=envelope(t,.77,.84,.90,1.10),settle=envelope(t,1.20,1.38,1.58,1.87);
  rotate(rig.head,a*.055,-impact*.09,impact*.035);for(const side of [-1,1])handPose(rig,side,a*(.46+impact*.20),-a*.11,a*.80);
  if(rig.pose!=='seated'&&face!==5){rotate(rig.legs?.[1],-wind*.48+settle*.08,0,0);rotate(rig.knees?.[1],wind*.85,0,0)}
  if(face===5)rig.arms.forEach((n,i)=>rotate(n,-wind*.22+impact*.10,0,(i<rig.arms.length/2?-1:1)*impact*.12));
  rotate(rig.body,impact*.04,0,0);blink(rig,blinkAt(t,.84,.04,.05,.12));
 }
 if(face===5&&mood!=='lossStomp')rig.arms.forEach((n,i)=>rotate(n,a*.025,0,(i<3?1:-1)*a*.06));
}
function visitorGesture(root,rig,mood,t,face,duration){
 const a=envelope(t,0,.10,duration-.10,duration);brow(rig,'happy',a*.6);
 if(mood==='visitorTakeoff'){
  const crouch=envelope(t,.01,.15,.23,.40),release=rise(t,.27,.50);
  balanceLegs(rig,crouch*1.4);rotate(rig.body,crouch*.10,0,0);rotate(rig.head,crouch*.07-release*.09,0,0);
  for(const side of [-1,1])handPose(rig,side,crouch*.12+release*.70,-release*.55,crouch*.8+release*.25);
 }else if(mood==='visitorFly'){
  // A held flight silhouette, never a walk cycle on a translated canvas.
  root.rotation.y=1.0;rotate(root,0,0,-.16);rotate(rig.head,-.08,-.13,0);
  handPose(rig,1,.78,-1.05,.12);handPose(rig,-1,.20,.42,.72);
  (rig.legs||[]).forEach((leg,i)=>{rotate(leg,-.34-i*.10,0,0);rotate(rig.knees?.[i],.78+i*.12,0,0)});
  if(face===5)rig.arms.forEach((n,i)=>rotate(n,-.25,0,(i<rig.arms.length/2?-1:1)*.16));
 }else if(mood==='visitorStrike'){
  const wind=envelope(t,0,.13,.17,.27),hit=envelope(t,.17,.28,.33,.54);
  root.rotation.y=.95;rotate(rig.body,0,-wind*.15+hit*.19,0);rotate(rig.head,-.035,-.12,0);
  handPose(rig,1,.70+hit*.65,-wind*.64+hit*.25,1.12-hit*1.05);handPose(rig,-1,.24,.25,.60);
  if(face!==5){rotate(rig.legs?.[0],-.23,0,0);rotate(rig.knees?.[0],.42,0,0)}
 }else{
  const fold=envelope(t,0,.11,.24,.43);for(const side of [-1,1])handPose(rig,side,fold*.65,-fold*.24,fold*.95);
  blink(rig,envelope(t,.04,.12,.27,.43));rotate(rig.head,fold*.08,0,0);
 }
}
function socialGesture(root,rig,mood,t,face,duration){
 const side=mood==='highFiveRight'||mood==='playfulReply'?-1:1,a=envelope(t,.02,.34,duration-.45,duration);
 brow(rig,'happy',a*.75);rotate(rig.head,-a*.025,side*a*.28,side*a*.045);
 if(mood.startsWith('highFive')){
  const reach=key(t,[[0,0],[.23,.14],[.72,.92],[.96,1],[1.18,1],[1.42,.70],[1.84,.16],[duration,0]]);
  // Palm remains planted through the contact window. Root aligns this exact
  // articulated point with the other actor, not the centre of the portraits.
  handPose(rig,side,reach*1.52,-reach*.10,reach*.17);
  handPose(rig,-side,a*.20,0,a*.32);
  rotate(rig.body,0,side*a*.07,0);blink(rig,blinkAt(t,1.36,.05));
 }else{
  const poke=envelope(t,.55,.90,1.10,1.42),reply=envelope(t,1.45,1.80,2.12,2.67),isReply=mood==='playfulReply';
  const act=isReply?reply:poke;
  handPose(rig,side,a*.30+act*.85,-act*.40,a*.40+act*.22,Math.sin(t*7)*act*.12);
  handPose(rig,-side,a*.15,0,a*.25);rotate(rig.head,-reply*.10,side*a*.24,-side*reply*.13);
  blink(rig,Math.max(blinkAt(t,.35),blinkAt(t,isReply?2.0:1.12,.08)));
  if(isReply){rig.facial?.expression(reply>.25?'happy':'surprise');rotate(rig.body,0,0,-side*reply*.04)}
 }
 if(face===5)rig.arms.forEach((n,i)=>{if(i!==handIndex(rig,side))rotate(n,-a*.04,0,Math.sin(i)*a*.025)});
}
export function characterSocialContactPoint(root,mood,camera=null,handSide=null){
 const rig=root?.userData?.rig;if(!rig)return null;const side=handSide??(mood==='highFiveRight'||mood==='playfulReply'?-1:1),i=handIndex(rig,side);
 const hand=rig.hands?.[i],tip=rig.forearms?.[i],armNode=rig.arms?.[i];if(!armNode)return null;
 root.updateMatrixWorld(true);let point;
 if(hand)point=hand.localToWorld(new Vector3(0,-.024,.02));
 else if(tip)point=tip.localToWorld(new Vector3(side*.035,.012,.01));
 else point=armNode.localToWorld(new Vector3(...(armNode.userData.grip||[0,-.25,.03])));
 return camera?point.project(camera):point;
}

/** Returns true while the supplied gesture needs another sample. Units are seconds. */
function sampleCharacter(root,{time=0,face=root?.userData?.rig?.face??root?.userData?.face??0,mood='idle',elapsed=0,reduced=false,aimPower=0,aimDirection=1}={}){
 const state=stateFor(root);if(!state)return false;resetCharacter(root);const rig=state.rig;
 face=Number.isInteger(face)&&face>=0&&face<6?face:0;time=Number.isFinite(time)?Math.max(0,time):0;elapsed=Number.isFinite(elapsed)?Math.max(0,elapsed):0;
 if(mood==='idle'||typeof mood!=='string'||!Object.hasOwn(CHARACTER_DURATIONS,mood)){if(!reduced)idle(rig,time,face,root);return !reduced}
 const emotion=animationEmotion(mood),duration=CHARACTER_DURATIONS[mood];
 setMouth(rig,rig.glb?glbMouth(mood,emotion):emotion);
 const browEmotion=mood==='appleHit'||mood==='lossAngry'||mood==='lossStomp'?'angry':emotion;
 if(reduced){brow(rig,browEmotion,.5);return false}
 if(elapsed>=duration){if(hasEmoteClip(mood))rig.facial?.reset();else brow(rig,browEmotion,.45);return false}

 if(sampleEmoteClip(root,mood,elapsed,duration))return true;

 if(mood==='appleAim'||mood==='appleThrow'){const a=mood==='appleAim'?clamp(aimPower):1-rise(elapsed,.12,.54),side=aimDirection<0?-1:1,lift=mood==='appleAim'?2.5+a*.3:key(elapsed,[[0,2.8],[.12,2.8],[.25,1.9],[.44,.45],[.65,0]]);handPose(rig,-side,lift*(face===5?1.4:1),-a*.5,a*.65);handPose(rig,side,a*.4,-a*.15,a*.25);rotate(rig.head,-a*.08,side*a*.18,0);rotate(root,0,0,-side*a*.075);brow(rig,'happy',a*.7)}
 else if(mood==='appleHit'){const recoil=envelope(elapsed,0,.09,.19,.38),dizzy=envelope(elapsed,.1,.35,1.45,1.85),anger=envelope(elapsed,1.35,1.75,2.12,2.6);rotate(rig.head,-recoil*.16,Math.sin(elapsed*12)*dizzy*.13,Math.sin(elapsed*10)*dizzy*.12);for(const side of [-1,1])handPose(rig,side,recoil*.85+anger*.4,-anger*.15,anger*.95);blink(rig,Math.max(recoil*.95,blinkAt(elapsed,1.15,.08)));setMouth(rig,anger>.2?'sad':'neutral');brow(rig,anger>.2?'angry':'happy',Math.max(dizzy*.5,anger))}
 else if(mood.startsWith('greet'))selectedGreeting(root,rig,mood,elapsed,face,duration);
 else if(mood.startsWith('win')&&mood!=='win')selectedWin(root,rig,mood,elapsed,face,duration);
 else if(mood.startsWith('loss'))selectedLoss(root,rig,mood,elapsed,face,duration);
 else if(mood.startsWith('visitor'))visitorGesture(root,rig,mood,elapsed,face,duration);
 else if(mood.startsWith('highFive')||mood.startsWith('playful'))socialGesture(root,rig,mood,elapsed,face,duration);
 else if(['walkLeft','walkRight','climbDown','climbUp','ledge','punch','kick','waveLeft','waveRight'].includes(mood)){
  const walking=mood.startsWith('walk'),climbing=mood.startsWith('climb'),wave=mood.startsWith('wave'),side=mood.endsWith('Left')?-1:1;
  const ease=envelope(elapsed,0,.18,duration-.22,duration),step=Math.sin(elapsed*(walking?13:8));
  if(walking){root.rotation.y=side*1.12;root.position.y+=Math.abs(step)*.014;for(const [i,leg]of (rig.legs||[]).entries()){rotate(leg,step*(i?-1:1)*.52,0,0);rotate(rig.knees?.[i],Math.max(0,step*(i?1:-1))*.60,0,0)}arm(rig,0,.08,-step*.34);arm(rig,1,.08,step*.34);bend(rig,0,.35);bend(rig,1,.35);rotate(rig.head,-.04,-side*.12,0)}
  if(climbing||mood==='ledge'){root.rotation.y=1.4;for(let i=0;i<Math.min(2,rig.arms.length);i++){const reach=climbing?(.5+.5*step*(i?-1:1)):1;arm(rig,i,.75+reach*.9,-.55);bend(rig,i,.65+reach*.4);rotate(rig.legs?.[i],-.35+step*(i?-1:1)*.35,0,0);rotate(rig.knees?.[i],.65+step*(i?1:-1)*.3,0,0)}rotate(rig.head,-.12,0,.03)}
  if(mood==='punch'){const wind=envelope(elapsed,0,.18,.26,.36),hit=envelope(elapsed,.24,.38,.48,.75);root.rotation.y=.8;arm(rig,0,.12,-.15);bend(rig,0,.5);arm(rig,1,.55+hit*.9,-.35-wind*.4+hit*.4);bend(rig,1,1.25-hit*1.15);rotate(rig.body,0,wind*-.16+hit*.20,0);rotate(rig.head,0,.25,0);brow(rig,'happy',hit)}
  if(mood==='kick'){const wind=envelope(elapsed,0,.18,.27,.38),hit=envelope(elapsed,.25,.39,.48,.78);root.rotation.y=1.05;rotate(rig.legs?.[1],-wind*.65-hit*.95,0,0);rotate(rig.knees?.[1],wind*1.15-hit*.08,0,0);rotate(rig.knees?.[0],hit*.12,0,0);arm(rig,0,.45*ease,-.2);arm(rig,1,.35*ease,.15);rotate(rig.head,-.03,-.2,0);brow(rig,'happy',hit)}
  if(wave){rotate(rig.head,0,side*.28*ease,side*.08*ease);arm(rig,side<0?0:1,1.3*ease,-.25*ease);bend(rig,side<0?0:1,.65*ease,Math.sin(elapsed*12)*.35*ease);brow(rig,'happy',ease*.6);blink(rig,blinkAt(elapsed,1.4))}
 }else if(mood==='bored'){
  const a=envelope(elapsed,.1,.8,3.7,5.5),yawn=envelope(elapsed,1.1,1.7,2.4,3.2);
  setMouth(rig,'neutral');if(yawn>.1)rig.facial?.expression('surprise');brow(rig,'sad',a*.45);
  rotate(rig.head,a*.10,Math.sin(elapsed*1.4)*a*.15,a*(face%2?-.075:.075));
  arm(rig,face%2,a*.7,-a*.40);bend(rig,face%2,a*1.25,a*.35);
  blink(rig,Math.max(blinkAt(elapsed,.7,.14),yawn*.8));
  (rig.legs||[]).forEach((leg,i)=>rotate(leg,0,0,i===face%2?Math.sin(elapsed*7)*a*.055:0));
  if(face===5)(rig.arms||[]).forEach((n,i)=>rotate(n,0,0,Math.sin(elapsed*1.8+i*.8)*a*.07));
 }else if(mood==='buttonPunch'){
  const walking=elapsed<1.65||elapsed>3.35,step=walking?Math.sin(elapsed*13):0,hit=envelope(elapsed,1.75,2.1,2.2,2.65);
  (rig.legs||[]).forEach((leg,i)=>rotate(leg,step*(i?1:-1)*.24,0,0));
  arm(rig,0,.12,-step*.18);arm(rig,1,.15+hit*1.6,step*.18-hit*.55);bend(rig,1,.2+hit*.65);
  rotate(rig.head,hit*.06,hit*.15,0);brow(rig,'happy',hit);setMouth(rig,'happy');
 }else if(mood==='angry'){
const a=envelope(elapsed,0,.25,1.1,1.8);setMouth(rig,rig.glb?'angry':'sad');brow(rig,'angry',a);rotate(rig.head,.08*a,Math.sin(elapsed*15)*.035*a,0);arm(rig,0,.25*a);arm(rig,1,.25*a);bend(rig,0,a*.75);bend(rig,1,a*.75);if(rig.pose!=='seated')move(root,0,jump(elapsed,.3,.25,.025),0)}
 else if(mood==='draw'){const a=envelope(elapsed,.03,.35,1.15,1.78);brow(rig,'happy',a*.6);rotate(rig.head,-a*.035,a*.04,0);arm(rig,0,a*.25);arm(rig,1,a*.25);bend(rig,0,a*.25);bend(rig,1,a*.25)}
 else if(mood==='surprise'){const a=envelope(elapsed,0,.18,.8,1.5),startle=envelope(elapsed,0,.08,.16,.34);if(rig.pose!=='seated')move(root,0,jump(elapsed,.02,.3,.035),0);if(face!==1)stretch(rig.body,1-startle*.03,1+startle*.06,1-startle*.03);brow(rig,'happy',a);rotate(rig.head,-.1*a,0,0);rig.facial?.expression('surprise');arm(rig,0,.65*a);arm(rig,1,.65*a);bend(rig,0,a*.35);bend(rig,1,a*.35)}
 else if(mood==='impact'){
  const t=elapsed,turn=key(t,[[0,0],[.65,0],[1.30,Math.PI],[2.35,Math.PI],[3.1,0],[4.8,0]]),contact=envelope(t,1.42,1.78,1.93,2.30),cheer=envelope(t,2.45,2.95,3.95,4.50),anticip=envelope(t,.8,1.10,1.30,1.58);
  brow(rig,'happy',.75);blink(rig,Math.max(blinkAt(t,.4),blinkAt(t,3.25,.12)));rotate(rig.head,-cheer*.10,contact*.38,cheer*Math.sin(t*5)*.035);arm(rig,0,cheer*1.60+anticip*.25,-cheer*.20);arm(rig,1,cheer*1.72+anticip*.25,-cheer*.20);bend(rig,0,cheer*.55+anticip*.25,cheer*.08);bend(rig,1,cheer*.60+anticip*.25,-cheer*.08);
  if(rig.pose!=='seated'){rotate(root,-contact*.35,turn,0);move(root,0,-anticip*.045+contact*.025+jump(t,2.65,.65,.09)+jump(t,3.5,.55,.06),contact*.32);if(face!==1)stretch(rig.body,1+contact*.025,1-contact*.025,1+contact*.035);const softness=rig.rear?.softness??.025;stretch(rig.hips,1+contact*softness,1-contact*softness*.5,1+contact*softness);move(rig.hips,0,0,-contact*softness*.25);(rig.legs||[]).forEach((n,i)=>rotate(n,contact*.12,0,(i?1:-1)*contact*.055))}
 }
 else if(mood==='knock'){
  const t=elapsed,reach=envelope(t,.02,.30,1.34,1.78);
  const contact=[.42,.76,1.10].reduce((a,at)=>a+envelope(t,at-.09,at,at+.025,at+.14),0);
  arm(rig,1,reach*2.35,-reach*.38-contact*.34);
  bend(rig,1,reach*.70-contact*.38,-contact*.10);
  rotate(rig.head,-reach*.035,reach*.065,contact*-.016);brow(rig,'happy',reach*.35);blink(rig,blinkAt(t,1.42));
 }
 else if(mood==='hello')greet(rig,elapsed,face,root);
 else if(emotion==='happy')celebrate(rig,root,elapsed,face,duration);
 else disappointment(rig,elapsed,face,duration);
 return true;
}

// The torso is the common motion carrier. Head gestures rotate around the neck,
// keeping its attachment point fixed instead of turning through the chest.
const neckHeights=[.56,.65,.59,.57,.62,.77,.66];
export function animateCharacter(root,options={}){
 const active=sampleCharacter(root,options);limitArms(root);connectCharacterPose(root,options);return active;
}
// Painted vinyl arms are fused to the body: beyond a measured angle the side of the body tears.
// Big gestures ease softly into that limit instead of stretching the skin.
const softLimit=(v,l)=>l*Math.tanh(v/l);
function limitArms(root){
 const rig=root?.userData?.rig;if(!rig?.glb||!rig.armLimit)return;const l=rig.armLimit,e=new Euler();
 for(const a of rig.arms||[]){e.setFromQuaternion(a.quaternion,'XYZ');e.set(softLimit(e.x,l*1.1),softLimit(e.y,l),softLimit(e.z,l),'XYZ');a.quaternion.setFromEuler(e)}
}
export function connectCharacterPose(root,options={}){
 const state=stateFor(root);if(!state)return;
 const rig=state.rig,head=rig.head,body=rig.body,h=state.nodes.get(head),b=state.nodes.get(body);
 const headDelta=new Euler(...head.rotation.toArray().slice(0,3).map((v,i)=>clamp(v-h.rotation[i],-.19,.19)));
 const q=new Quaternion().setFromEuler(headDelta),offset=new Vector3(0,rig.glb?0:h.position[1]-neckHeights[rig.face??options.face??0],0),shift=offset.clone().applyQuaternion(q).sub(offset);
 head.rotation.set(h.rotation[0]+headDelta.x,h.rotation[1]+headDelta.y,h.rotation[2]+headDelta.z);head.position.set(...h.position).add(shift);
 const torso=new Quaternion().setFromEuler(new Euler(...body.rotation.toArray().slice(0,3).map((v,i)=>v-b.rotation[i])));
 const carries=Math.abs(torso.x)+Math.abs(torso.y)+Math.abs(torso.z)>1e-10;body.rotation.set(...b.rotation);if(carries)root.quaternion.multiply(torso);

}

