import {portraitFrame} from './portrait-framing.mjs';
import {resolveAnimationMood,normalizeAnimationPreferences} from '../public/animation-style.mjs';
import {applyCharacterTouch,TOUCH_DURATIONS} from './character-touch.mjs';
import * as T from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {createCharacter,disposePerson,characterContactPoint,CHARACTER_MODEL_VERSION} from './characters.mjs';
import {animateCharacter,resetCharacter,captureCharacterPose,blendCharacterPose,connectCharacterPose,characterSocialContactPoint,CHARACTER_DURATIONS} from './character-motion.mjs';
import {acceptsCharacterGesture,accessoryColourKey} from '../public/character-style.mjs';

const copyPose=pose=>pose?.map(p=>({...p,position:p.position.clone(),quaternion:p.quaternion.clone(),scale:p.scale.clone(),morph:p.morph?.slice()}));

// One GPU context paints all DOM portraits. Their small 2D canvases follow normal
// stacking, clipping and dialog rules, and never create another WebGL context.
export class CharacterPortraits{
 constructor({reduced=()=>false}={}){
  this.reduced=reduced;this.records=new Map();this.models=new Map();this.frame=null;this.lastFrame=0;this.dirty=true;this.lost=false;
  this.renderer=new T.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});this.renderer.setPixelRatio(1);this.renderer.setSize(384,384,false);this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=.94;this.renderer.setClearColor(0,0);
  this.scene=new T.Scene();const room=new RoomEnvironment(),pmrem=new T.PMREMGenerator(this.renderer);this.environment=pmrem.fromScene(room,.04);this.scene.environment=this.environment.texture;this.scene.environmentIntensity=.45;room.dispose();pmrem.dispose();
  this.scene.add(new T.HemisphereLight('#fff3ff','#64506d',.65));const key=new T.DirectionalLight('#fff1df',2.1);key.position.set(-3,5,6);this.scene.add(key);const rim=new T.DirectionalLight('#c9b4ff',1.15);rim.position.set(4,3,-3);this.scene.add(rim);
  this.camera=new T.PerspectiveCamera(31,1,.1,30);
  this.observer=new IntersectionObserver(entries=>{for(const e of entries){const r=this.records.get(e.target);if(r){r.visible=e.isIntersecting;r.dirty=true}}this.request()},{threshold:.01});
  this.resizeObserver=new ResizeObserver(()=>this.invalidate());
  this.renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();this.lost=true;this.pause()});this.renderer.domElement.addEventListener('webglcontextrestored',()=>{this.lost=false;this.invalidate()});
 }
 add(art){
  if(this.records.has(art)){const record=this.records.get(art),face=Number(art.dataset.character)||0,colour=Number(art.dataset.colour)||0;if(record.face!==face||record.colour!==colour||record.accessory!==(art.dataset.accessory||'none')||record.colours!==(art.dataset.accessoryColours||'')){record.face=face;record.colour=colour;record.accessory=art.dataset.accessory||'none';record.colours=art.dataset.accessoryColours||'';record.mood='idle';record.until=0;record.transition=null;record.lastPose=null;clearTimeout(record.timer);delete art.dataset.emotion;record.dirty=true;this.request()}return}const canvas=document.createElement('canvas');canvas.className='character-canvas';canvas.setAttribute('aria-hidden','true');art.replaceChildren(canvas);const ctx=canvas.getContext('2d',{alpha:true});if(!ctx)return;
  const r={art,canvas,ctx,face:Number(art.dataset.character)||0,colour:Number(art.dataset.colour)||0,accessory:art.dataset.accessory||'none',colours:art.dataset.accessoryColours||'',visible:false,dirty:true,mood:'idle',start:0,until:0,phase:Math.random()*15,last:0};this.records.set(art,r);this.installTouch(r);this.observer.observe(art);this.resizeObserver.observe(art);this.request();
 }
 installTouch(r){
  if(!r.art.closest('.avatar-preview'))return;
  const host=r.art.closest('.avatar-preview');let press=null;
  r.touch={x:0,y:0,sx:0,sy:0,until:0,kind:'',start:0,yaw:0,syaw:0};
  const point=e=>{const b=host.getBoundingClientRect();return {x:Math.max(-1,Math.min(1,(e.clientX-b.left)/b.width*2-1)),y:Math.max(-1,Math.min(1,1-(e.clientY-b.top)/b.height*2))}};
  const react=kind=>{if(!['idle','hello'].includes(r.mood))return;if(r.mood==='hello'){r.transition={mood:r.mood,start:r.start,at:performance.now(),pose:copyPose(r.lastPose),duration:360};r.mood='idle';r.until=0;clearTimeout(r.timer);delete r.art.dataset.emotion}r.touch.kind=kind;r.touch.start=performance.now();r.art.dataset.touchReaction=kind;this.request()};
  host.addEventListener('pointermove',e=>{Object.assign(r.touch,point(e),{until:performance.now()+1300});if(press&&Math.hypot(e.clientX-press.x,e.clientY-press.y)>12){clearTimeout(r.holdTimer);press.moved=true;if(Math.abs(e.clientX-press.x)>Math.abs(e.clientY-press.y)){r.touch.yaw=press.yaw+(e.clientX-press.x)*.016}}this.request()},{passive:true});
  host.addEventListener('pointerdown',e=>{if(e.isPrimary===false||e.button>0)return;Object.assign(r.touch,point(e),{until:performance.now()+1800});press={x:e.clientX,y:e.clientY,moved:false,held:false,yaw:r.touch.yaw};clearTimeout(r.holdTimer);r.holdTimer=setTimeout(()=>{if(press&&!press.moved){press.held=true;react('curious')}},550);this.request()},{passive:true});
  host.addEventListener('pointerup',e=>{clearTimeout(r.holdTimer);if(press&&!press.moved&&!press.held)this.play(r.art,'hello',null,{force:true});press=null;r.touch.until=performance.now()+1000},{passive:true});
  const cancel=()=>{clearTimeout(r.holdTimer);press=null;r.touch.until=0};host.addEventListener('pointercancel',cancel);host.addEventListener('pointerleave',cancel);
  host.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){react('pat')}});
 }
 model(face,colour,accessory='none',colours=''){
  const key=face+':'+colour+':'+accessory+':'+accessoryColourKey(colours);let entry=this.models.get(key);if(entry){this.models.delete(key);this.models.set(key,entry);return entry}
  const root=createCharacter(face,colour,'standing',accessory,colours);root.updateMatrixWorld(true);const frame=portraitFrame(root),{center,headCenter}=frame;entry={root,...frame,accessories:new Map()};
  root.traverse(node=>{if(!node.userData.attachment)return;const box=new T.Box3().setFromObject(node),extent=box.getSize(new T.Vector3());entry.accessories.set(node.userData.attachment,{center:box.getCenter(new T.Vector3()),radius:Math.max(extent.x,extent.y,extent.z)*.5})});
  const camera=new T.PerspectiveCamera(31,1,.1,30);camera.position.copy(center).add(new T.Vector3(.18,.12,1).normalize().multiplyScalar(entry.radius/Math.sin(camera.fov*Math.PI/360)*1.14));camera.lookAt(center);camera.updateMatrixWorld(true);entry.fullHead=headCenter.clone().project(camera);this.models.set(key,entry);
  while(this.models.size>12){const oldest=this.models.keys().next().value,old=this.models.get(oldest);this.models.delete(oldest);disposePerson(old.root)}return entry;
 }
 play(art,mood='hello',remaining=null,{force=false}={}){
  this.add(art);const r=this.records.get(art);if(!r)return false;const baseMood=mood,baseDuration=(CHARACTER_DURATIONS[mood]||1.85)*1000;const prefs=normalizeAnimationPreferences({greeting:art.dataset.animationGreeting,win:art.dataset.animationWin,loss:art.dataset.animationLoss});mood=resolveAnimationMood(mood,prefs);const duration=(CHARACTER_DURATIONS[mood]||1.85)*1000,now=performance.now();if(!force&&!acceptsCharacterGesture(r.mood,mood,r.until-now))return false;r.transition={mood:r.mood,start:r.start,at:now,pose:copyPose(r.lastPose),duration:240};r.mood=mood;const elapsed=remaining===null?0:Math.max(0,baseDuration-remaining);r.start=now-elapsed;r.until=now+Math.max(0,duration-elapsed);r.dirty=true;art.dataset.emotion=mood;art.dataset.baseEmotion=baseMood;
  clearTimeout(r.timer);r.timer=setTimeout(()=>{if(this.records.get(art)!==r)return;r.transition={mood:r.mood,start:r.start,at:performance.now(),pose:copyPose(r.lastPose),duration:360};r.mood='idle';delete art.dataset.emotion;delete art.dataset.baseEmotion;r.dirty=true;this.request()},Math.max(0,r.until-now));this.request();return true;
 }
 invalidate(){this.dirty=true;for(const r of this.records.values())r.dirty=true;this.request()}
 prune(){for(const [art,r]of this.records)if(!art.isConnected){clearTimeout(r.timer);clearTimeout(r.holdTimer);this.observer.unobserve(art);this.resizeObserver.unobserve(art);this.records.delete(art)}}
 request(){if(!this.frame&&!document.hidden&&!this.lost)this.frame=requestAnimationFrame(t=>this.tick(t))}
 pause(){if(this.frame)cancelAnimationFrame(this.frame);this.frame=null}
 tick(now){
  this.frame=null;if(document.hidden||this.lost)return;this.prune();const reduced=this.reduced(),modal=document.querySelector('dialog[open]:modal');let alive=false;
  for(const r of this.records.values()){
   const {art}=r;if(!r.visible||!art.getClientRects().length||modal&&!modal.contains(art)&&!art.closest('.character-hero'))continue;
   const rect=art.getBoundingClientRect();if(rect.bottom<=0||rect.top>=innerHeight||rect.width<1||rect.height<1)continue;
   const touching=r.touch&&(now<r.touch.until||now-r.touch.start<(TOUCH_DURATIONS[r.touch.kind]||0)||Math.abs(r.touch.sx)+Math.abs(r.touch.sy)+Math.abs(r.touch.yaw-r.touch.syaw)>.002);
   const idle=!!art.closest('#scores,.home-portrait,.avatar-preview,#winnerPortrait'),active=r.mood!=='idle',animate=!!touching||!reduced&&(idle||active);alive||=animate;
   if(!r.dirty&&!this.dirty&&(!animate||now-r.last<(active?15:32)))continue;
   const overscan=art.closest('#scores')?1.35:1,basePixels=Math.max(48,Math.min(Math.floor(384/overscan),Math.ceil(Math.max(rect.width,rect.height)*Math.min(devicePixelRatio||1,1.5)))),pixels=Math.round(basePixels*overscan);r.canvas.classList.toggle('portrait-overscan',overscan>1);
   if(r.canvas.width!==pixels||r.canvas.height!==pixels){r.canvas.width=r.canvas.height=pixels}
   const entry=this.model(r.face,r.colour,r.accessory,r.colours),root=entry.root,preview=entry.accessories.get(art.dataset.accessoryPreview),bust=!preview&&!!art.closest('#scores,.home-portrait,.friend-entry,.leader-row,.mini-player'),center=preview?.center||(bust?entry.headCenter:entry.center),radius=preview?.radius||(bust?entry.headRadius:entry.radius);
   let previous=null;if(r.transition&&!reduced&&now-r.transition.at<(r.transition.duration||240)){if(r.transition.pose)previous=r.transition.pose;else{animateCharacter(root,{time:now/1000+r.phase,face:r.face,mood:r.transition.mood,elapsed:Math.max(0,(now-r.transition.start)/1000)});previous=captureCharacterPose(root)}}else r.transition=null;
   resetCharacter(root);animateCharacter(root,{time:now/1000+r.phase,face:r.face,mood:r.mood,elapsed:Math.max(0,(now-r.start)/1000),reduced,aimPower:Number(art.dataset.applePower)||0,aimDirection:Number(art.dataset.appleDirection)||1});if(previous)blendCharacterPose(previous,(now-r.transition.at)/(r.transition.duration||240));
   if(r.touch&&['idle','hello'].includes(r.mood)){
    const touch=r.touch,tracking=now<touch.until,step=1-Math.exp(-Math.min(64,Math.max(1,now-r.last))/110);
    touch.sx+=((tracking?touch.x:0)-touch.sx)*step;touch.sy+=((tracking?touch.y:0)-touch.sy)*step;
    const elapsed=(now-touch.start)/1000,kind=elapsed*1000<(TOUCH_DURATIONS[touch.kind]||0)?touch.kind:'';
    applyCharacterTouch(root,{x:touch.sx,y:touch.sy,strength:1,kind,elapsed,reduced});
    if(!kind)delete art.dataset.touchReaction;
   }
   connectCharacterPose(root);
   if(r.touch){r.touch.syaw+=(r.touch.yaw-r.touch.syaw)*(1-Math.exp(-Math.min(64,Math.max(1,now-r.last))/110));root.rotation.y+=r.touch.syaw}
   art.dataset.fullFrameRatio=String(entry.radius/entry.headRadius);art.dataset.fullHeadX=String((entry.fullHead.x+1)/2);art.dataset.fullHeadY=String((1-entry.fullHead.y)/2);const camera=this.camera,hidden=[];
   if(preview)root.traverse(node=>{if(!node.isMesh||!node.visible)return;let part=false;for(let n=node;n;n=n.parent)if(n.userData.attachment===art.dataset.accessoryPreview){part=true;break}if(!part){node.visible=false;hidden.push(node)}});
   this.scene.add(root);const distance=radius/Math.sin(this.camera.fov*Math.PI/360)*1.14;this.camera.position.copy(center).add(new T.Vector3(.18,.12,1).normalize().multiplyScalar(distance));this.camera.lookAt(center);this.camera.clearViewOffset();if(overscan>1){const pad=(pixels-basePixels)/2;this.camera.setViewOffset(basePixels,basePixels,-pad,-pad,pixels,pixels)}this.renderer.setScissorTest(true);this.renderer.setScissor(0,0,pixels,pixels);this.renderer.setViewport(0,0,pixels,pixels);this.renderer.render(this.scene,camera);r.ctx.globalCompositeOperation='copy';r.ctx.drawImage(this.renderer.domElement,0,384-pixels,pixels,pixels,0,0,pixels,pixels);this.scene.remove(root);for(const node of hidden)node.visible=true;
   if(r.mood==='knock'){const point=characterContactPoint(root,camera);point.x*=overscan;point.y*=overscan;art.dataset.knockX=((point.x+1)*50).toFixed(1)+'%';art.dataset.knockY=((1-point.y)*50).toFixed(1)+'%'}
   if(r.mood==='appleAim'||r.mood==='appleThrow'){const point=characterSocialContactPoint(root,r.mood,camera,-(Number(art.dataset.appleDirection)||1));if(point){point.x*=overscan;point.y*=overscan;art.dataset.appleHandX=String((point.x+1)/2);art.dataset.appleHandY=String((1-point.y)/2)}}
   if(r.mood==='visitorStrike'||r.mood.startsWith('highFive')||r.mood.startsWith('playful')){const point=characterSocialContactPoint(root,r.mood,camera);if(point){point.x*=overscan;point.y*=overscan;art.dataset.contactX=String((point.x+1)/2);art.dataset.contactY=String((1-point.y)/2)}}
   r.lastPose=captureCharacterPose(root,r.lastPose);r.last=now;r.dirty=false;if(!art.dataset.modelReady){art.dataset.modelReady='true';art.dataset.modelVersion=CHARACTER_MODEL_VERSION}
  }
  this.dirty=false;this.lastFrame=now;if(alive)this.request();
 }
 dispose(){this.pause();this.observer.disconnect();this.resizeObserver.disconnect();for(const r of this.records.values()){clearTimeout(r.timer);clearTimeout(r.holdTimer)}this.records.clear();for(const {root}of this.models.values())disposePerson(root);this.models.clear();this.environment.dispose();this.renderer.dispose()}
}
