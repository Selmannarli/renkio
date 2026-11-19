import {animationEmotion} from '../public/animation-style.mjs';
import {AnimationMixer,AnimationClip,QuaternionKeyframeTrack,VectorKeyframeTrack,NumberKeyframeTrack,Quaternion,Euler,LoopOnce,BooleanKeyframeTrack} from 'three';

// Authored normalized beat sheets. Poses are compiled lazily for each existing rig;
// sampling is absolute, so shared portrait models can seek without accumulating motion.
const cache=new WeakMap();
const clamp=x=>Math.max(0,Math.min(1,x));
const ease=x=>{x=clamp(x);return x*x*x*(10+x*(-15+x*6))};
const gate=(t,a,b,c,d)=>ease((t-a)/(b-a))*(1-ease((t-c)/(d-c)));
const curve=(t,keys)=>{
 if(t<=keys[0][0])return keys[0][1];
 for(let i=1;i<keys.length;i++)if(t<=keys[i][0]){
  const [a,x]=keys[i-1],[b,y]=keys[i],u=(t-a)/(b-a);
  // Flat holds and ease-in/out at authored extremes; motion never rings across a hold.
  const slope=(j)=>{if(j<=0||j>=keys.length-1)return 0;const l=(keys[j][1]-keys[j-1][1])/(keys[j][0]-keys[j-1][0]),r=(keys[j+1][1]-keys[j][1])/(keys[j+1][0]-keys[j][0]);return l*r<=0?0:Math.sign(l)*Math.min(Math.abs(l),Math.abs(r))};
  return (2*u**3-3*u*u+1)*x+(u**3-2*u*u+u)*(b-a)*slope(i-1)+(-2*u**3+3*u*u)*y+(u**3-u*u)*(b-a)*slope(i);
 }
 return keys.at(-1)[1];
};
const bounce=(t,start,span,height)=>{const u=(t-start)/span;return u>0&&u<1?height*Math.sin(Math.PI*u):0};
const spring=(t,start,frequency=24)=>t>start?Math.sin((t-start)*frequency)*Math.exp(-(t-start)*9):0;
const aliases={hello:'greetWave',win:'winVictory',celebrate:'winHop',sad:'lossSad',lose:'lossSad',angry:'lossAngry'};
export function clipMood(mood){return aliases[mood]||mood}
export function hasEmoteClip(mood){return /^(greet(Wave|Both|Nod|Bow|Cheer)|win(Victory|Dance|Hop)|loss(Sad|Slump|Angry|Stomp)|draw|surprise)$/.test(clipMood(mood))}

function choreography(mood,t,face,seated){
 const p={body:[0,0,0],head:[0,0,0],left:[0,0,0],right:[0,0,0],elbows:[0,0],wrists:[0,0],legs:[0,0],knees:[0,0],lift:0,happy:0,sad:0,surprise:0,angry:0,blink:0,wink:0,look:0,secondary:0};
 const active=gate(t,.015,.16,.78,1),prep=gate(t,.01,.075,.105,.19),release=gate(t,.10,.24,.72,.94),follow=spring(t,.22);
 const K=keys=>curve(t,keys),arm=(side,lift,forward=0,bend=.45,wrist=0)=>{p[side<0?'left':'right']=[forward,0,side*lift];p.elbows[side<0?0:1]=-bend;p.wrists[side<0?0:1]=side*wrist};
 const happy=()=>{p.happy=gate(t,.055,.22,.80,.98);p.blink=gate(t,.075,.09,.105,.14);p.secondary=follow*.07*active};
 if(mood.startsWith('greet')){
  happy();p.body=[prep*.025,0,-active*.035];p.head=[-release*.07,active*.065,active*.045];p.look=active*.008;
  if(mood==='greetWave'||mood==='greetBoth'){
   const lift=K([[0,0],[.08,-.10],[.22,2.55],[.29,2.38],[.65,2.38],[.82,.5],[1,0]]);
   const wrist=K([[0,0],[.23,0],[.31,-.32],[.40,.30],[.49,-.27],[.58,.23],[.68,-.12],[.82,0],[1,0]]);
   arm(1,lift,-release*.22,release*.65,wrist+follow*.10);
   arm(-1,mood==='greetBoth'?lift*.94:active*.18,-release*.10,release*(mood==='greetBoth'?.60:.20),mood==='greetBoth'?-wrist*.8:0);
   p.head[2]=-K([[0,0],[.18,.018],[.33,.085],[.68,.055],[1,0]]);p.body[2]=mood==='greetBoth'?0:-release*.045;
   if(face===2)p.wink=gate(t,.43,.46,.50,.57);
  }else if(mood==='greetNod'){
   p.head=[K([[0,0],[.13,-.065],[.29,.16],[.42,-.055],[.57,.11],[.72,-.025],[1,0]]),-active*.035,0];
   arm(-1,active*.22,0,active*.28);arm(1,active*.26,0,active*.32);p.blink=Math.max(p.blink,gate(t,.26,.28,.31,.36));
  }else if(mood==='greetBow'){
   const bow=K([[0,0],[.10,-.10],[.34,1],[.56,1],[.79,-.06],[1,0]]);
   p.body=[bow*.105,0,0];p.head=[bow*.14,0,0];arm(-1,bow*.31,-bow*.20,bow*.35);arm(1,bow*.40,-bow*.30,bow*.48);p.knees=[bow*.16,bow*.16];p.blink=gate(t,.30,.35,.53,.64);
  }else{
   const pop=K([[0,0],[.09,-.1],[.25,1.65],[.36,1.15],[.48,1.55],[.63,1.12],[.82,.3],[1,0]]);
   arm(-1,pop,-release*.20,release*.70);arm(1,pop*.93,-release*.26,release*.58);p.body[2]=K([[0,0],[.25,-.06],[.47,.07],[.68,-.025],[1,0]]);p.head[2]=-p.body[2]*.8;
  }
 }else if(mood.startsWith('win')){
  happy();p.happy=gate(t,.08,.24,.85,1);p.head[0]=prep*.05-release*.10;
  if(mood==='winVictory'){
   const triumph=K([[0,0],[.09,-.09],[.25,2.35],[.34,2.18],[.50,2.2],[.62,2.55],[.72,2.25],[.86,.55],[1,0]]);
   arm(-1,release*2.15,-release*.16,release*.48);arm(1,triumph,-release*.30,release*.68);p.body=[prep*.04,-release*.11,-release*.055];p.head[1]=release*.08;p.secondary+=spring(t,.62)*.08;
  }else if(mood==='winDance'){
   // Alternating planted weight, shoulder counter-rotation, and delayed wrists.
   const sway=K([[0,0],[.10,-.25],[.23,1],[.39,-1],[.55,1],[.71,-.8],[.86,.25],[1,0]]);
   p.body=[0,sway*.11,sway*.075];p.head=[-release*.06,-sway*.07,-sway*.10];
   arm(-1,release*(.92+sway*.35),-release*.12,release*.65+sway*.12,-sway*.20);arm(1,release*(.92-sway*.35),-release*.12,release*.65-sway*.12,sway*.20);
   p.legs=[Math.max(0,sway)*-.20,Math.max(0,-sway)*-.20];p.knees=[Math.max(0,sway)*.36,Math.max(0,-sway)*.36];p.secondary=-sway*.12;
  }else{
   const up=bounce(t,.17,.22,.058)+bounce(t,.49,.20,.043),squash=gate(t,.02,.08,.12,.20)+gate(t,.37,.41,.45,.53)*.7;
   p.lift=up;const hands=K([[0,0],[.09,-.13],[.24,2.35],[.39,1.65],[.56,2.25],[.72,1.60],[.87,.35],[1,0]]);
   arm(-1,hands,-release*.18,release*.45);arm(1,hands*.94,-release*.24,release*.57);p.knees=[squash*.28,squash*.28];p.legs=[-squash*.15,-squash*.15];p.body[0]=squash*.045;p.secondary+=spring(t,.40)*.11;
  }
  p.blink=Math.max(p.blink,gate(t,.28,.31,.35,.42));
 }else if(mood.startsWith('loss')){
  const a=K([[0,0],[.10,-.12],[.29,1],[.64,1],[.83,.7],[1,0]]);p.sad=gate(t,.08,.27,.86,1);
  if(mood==='lossSad'||mood==='lossSlump'){
   const heavy=mood==='lossSlump';p.body=[a*(heavy?.075:.03),-a*.025,a*(heavy?.035:0)];p.head=[a*(heavy?.16:.12),-a*.065,a*.045];
   arm(-1,a*(heavy?.07:.20),a*.04,a*(heavy?.13:.30));arm(1,a*(heavy?.07:.23),a*.06,a*(heavy?.18:.35));
   p.blink=gate(t,.30,.36,heavy?.62:.42,.75);p.secondary=-a*.08;p.look=-a*.012;
  }else{
   p.sad=0;p.angry=gate(t,.13,.28,.81,1);p.sad=p.angry*.65;
   const clench=gate(t,.11,.29,.70,.95);arm(-1,clench*.43,-clench*.16,clench*1.02);arm(1,clench*.52,-clench*.20,clench*1.10);p.body=[-clench*.025,0,0];
   if(mood==='lossAngry'){p.head=[clench*.07,K([[0,0],[.29,0],[.37,-.105],[.45,.09],[.53,-.07],[.62,.04],[.75,0],[1,0]]),0];p.secondary=spring(t,.35)*.06;}
   else{const wind=gate(t,.20,.32,.39,.48),hit=gate(t,.43,.47,.49,.64);p.legs=[0,-wind*.38];p.knees=[hit*.12,wind*.65];p.body[2]=-wind*.045+hit*.06;p.head=[clench*.06,-hit*.07,-hit*.04];p.secondary=spring(t,.48)*.12;}
   p.blink=gate(t,.70,.73,.75,.81);
  }
 }else{
  const a=gate(t,.02,.19,.65,1);p.happy=mood==='draw'?a*.45:0;p.surprise=mood==='surprise'?a:0;p.head=[-a*.10,a*.04,0];arm(-1,a*.55,-a*.12,a*.64);arm(1,a*.63,-a*.12,a*.70);p.secondary=spring(t,.20)*.07;
 }
 // Robot joints stay crisp; organic silhouettes inherit a delayed, damped follow-through.
 const softness=[1,.35,.85,1,.75,1.1,.9][face];p.secondary*=softness;
 if(seated){p.lift=0;p.legs=[0,0];p.knees=[0,0]}
 return p;
}

const clipMouth=m=>m==='surprise'?'surprise':/Angry|Stomp/.test(m)||m==='angry'?'angry':animationEmotion(m);
function compile(root,mood,duration){
 const rig=root.userData.rig,face=rig.face??0,seated=rig.pose==='seated',steps=Math.ceil(duration*45),times=Array.from({length:steps+1},(_,i)=>i*duration/steps),poses=times.map(t=>choreography(mood,t/duration,face,seated)),tracks=[];
 const delayed=delay=>times.map((t,i)=>i===steps?poses[i]:choreography(mood,Math.max(0,(t-delay)/duration),face,seated)),elbowPoses=delayed(.035),wristPoses=delayed(.065);
 const rotation=(node,sample)=>{if(!node)return;const rest=node.quaternion.clone(),values=[],q=new Quaternion(),e=new Euler();for(const [i,p] of poses.entries()){const v=sample(p,i);q.copy(rest).multiply(new Quaternion().setFromEuler(e.set(...v)));values.push(...q.toArray())}tracks.push(new QuaternionKeyframeTrack(node.uuid+'.quaternion',times,values))};
 const number=(node,path,sample)=>{if(node)tracks.push(new NumberKeyframeTrack(node.uuid+'.'+path,times,poses.map(sample)))};
 rotation(rig.body,p=>p.body);rotation(rig.head,p=>p.head);
 for(let i=0;i<rig.arms.length;i++){
  const side=face===5?(i<rig.arms.length/2?-1:1):(i?1:-1),outer=face!==5||i===0||i===rig.arms.length-1,lag=(face===5?(outer?.24:.18):1)*(rig.armGain??1);
  rotation(rig.arms[i],p=>{const a=side<0?p.left:p.right;return [a[0]*lag,0,a[2]*lag+(outer?0:side*p.secondary)]});
  rotation(rig.forearms?.[i],(_,k)=>{const p=elbowPoses[k];return [p.elbows[side<0?0:1]*lag,0,side*p.secondary*.4]});
  rotation(rig.hands?.[i],(_,k)=>{const p=wristPoses[k];return [0,side*p.secondary*.35,p.wrists[side<0?0:1]*lag+side*p.secondary]});
 }
 for(let i=0;i<(rig.legs||[]).length;i++){rotation(rig.legs[i],p=>[p.legs[i%2],0,0]);rotation(rig.knees?.[i],p=>[p.knees[i%2],0,0])}
 rotation(rig.tail,p=>[0,-p.secondary*2,p.secondary*.25]);rotation(rig.accent,p=>[p.secondary*.20,0,p.secondary*.65]);
 (rig.ears||[]).forEach((n,i)=>rotation(n,p=>[p.secondary*.3,0,(i?1:-1)*p.secondary*.8]));
 if(!seated){const rest=root.position.toArray(),values=poses.flatMap(p=>[rest[0],rest[1]+p.lift,rest[2]]);tracks.push(new VectorKeyframeTrack(root.uuid+'.position',times,values))}
 const f=rig.facial;
 for(const mesh of [f?.mesh,...(f?.details||[])])for(let i=0;i<3;i++)number(mesh,'morphTargetInfluences['+i+']',p=>[p.happy,p.sad,p.surprise][i]);
 for(const b of f?.brows||[])for(let i=0;i<3;i++)number(b.children[0],'morphTargetInfluences['+i+']',p=>[p.happy*.75,p.angry?0:p.sad,p.angry][i]);
 // Painted (glb) faces: blinks show the lid patch, and the mouth patch follows the clip's feeling.
 if(rig.glb){
  for(const [i,lid] of (rig.lids||[]).entries())tracks.push(new BooleanKeyframeTrack(lid.uuid+'.visible',times,poses.map(p=>Math.max(p.blink,i===0?p.wink:0)>.55)));
  const shapes=rig.mouthShapes||{},base=clipMouth(mood);
  const pick=p=>{if(p.angry>.3)return 'angry';const best=[['surprise',p.surprise],['happy',p.happy],['sad',p.sad]].sort((a,b)=>b[1]-a[1])[0];return best[1]>.35?best[0]:base};
  for(const [k,mesh]of Object.entries(shapes))tracks.push(new BooleanKeyframeTrack(mesh.uuid+'.visible',times,poses.map(p=>pick(p)===k)));
 }
 for(const [i,eye] of (rig.eyes||[]).entries()){const rest=eye.scale.toArray();tracks.push(new VectorKeyframeTrack(eye.uuid+'.scale',times,poses.flatMap(p=>[rest[0],rest[1]*(1-Math.max(p.blink,i===0?p.wink:0)*.94),rest[2]])))}
 for(const pupil of rig.pupils||[]){const y=pupil.position.y;number(pupil,'position[y]',p=>y+p.look)}
 const clip=new AnimationClip('renkio:'+mood,duration,tracks);clip.userData={authored:true};return clip;
}

export function stopEmoteClip(root){cache.get(root)?.mixer.stopAllAction()}

export function sampleEmoteClip(root,mood,elapsed,duration){
 if(!hasEmoteClip(mood))return false;mood=clipMood(mood);
 let entry=cache.get(root);if(!entry){const r=root.userData.rig;entry={mixer:new AnimationMixer(root),clips:new Map(),nodes:[root,r.head,r.body,...r.arms,...(r.forearms||[]),...(r.hands||[]),...(r.legs||[]),...(r.knees||[]),...(r.ears||[]),r.tail,r.accent].filter(Boolean)};cache.set(root,entry)}
 // All tracks bind to the untouched rest pose, never to the previous gesture.
 entry.mixer.stopAllAction();let action=entry.clips.get(mood+':'+duration);
 if(!action){const clip=compile(root,mood,duration);action=entry.mixer.clipAction(clip);action.setLoop(LoopOnce,1);action.clampWhenFinished=true;entry.clips.set(mood+':'+duration,action)}
 action.reset().play();entry.mixer.setTime(Math.max(0,Math.min(duration,elapsed)));for(const n of entry.nodes){n.quaternion.normalize();const r=n.rotation;if(Object.is(r.x,-0)||Object.is(r.y,-0)||Object.is(r.z,-0))r.set(r.x===0?0:r.x,r.y===0?0:r.y,r.z===0?0:r.z)}return true;
}
