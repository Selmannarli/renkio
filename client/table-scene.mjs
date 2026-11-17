import {resolveAnimationMood} from '../public/animation-style.mjs';
import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {SVGLoader} from 'three/addons/loaders/SVGLoader.js';
import {TABLE_SEATS,SEAT_HEIGHT,TABLE_TOP} from '../public/table-layout.mjs';
import {createSeatedCharacter,disposePerson} from './characters.mjs';
import {animateCharacter,resetCharacter,captureCharacterPose,blendCharacterPose,CHARACTER_DURATIONS} from './character-motion.mjs';
import {acceptsCharacterGesture,accessoryColourKey} from '../public/character-style.mjs';
export {createSeatedCharacter} from './characters.mjs';
export {CharacterPortraits} from './portrait-scene.mjs';

const geo=new Map(),mats=new Map();
const sphere=()=>geometry('orb',()=>new T.SphereGeometry(1,24,18));
function geometry(key,make){if(!geo.has(key))geo.set(key,make());return geo.get(key)}
function material(colour,roughness=.48,metalness=0){const key=colour+':'+roughness+':'+metalness;if(!mats.has(key))mats.set(key,new T.MeshPhysicalMaterial({color:colour,roughness,metalness,clearcoat:.18,clearcoatRoughness:.3}));return mats.get(key)}
function group(parent,name,at=[0,0,0]){const n=new T.Group();n.name=name;n.position.set(...at);parent.add(n);return n}
function mesh(parent,g,m,at=[0,0,0],scale=[1,1,1]){const n=new T.Mesh(g,m);n.position.set(...at);n.scale.set(...scale);n.castShadow=true;n.receiveShadow=true;parent.add(n);return n}
function orb(parent,m,at,scale){return mesh(parent,sphere(),m,at,scale)}
function box(parent,m,at,size,r=.08){return mesh(parent,geometry('box:'+size.join(':')+':'+r,()=>new RoundedBoxGeometry(...size,4,r)),m,at)}
function tube(parent,m,points,r=.025){const key='tube:'+points.flat().join(':')+':'+r;return mesh(parent,geometry(key,()=>new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),24,r,8,false)),m)}
function cone(parent,m,at,r=.14,h=.4){return mesh(parent,geometry('cone:'+r+':'+h,()=>new T.ConeGeometry(r,h,24)),m,at)}
function eye(parent,at,size=1,irisColour='#6751ad'){
 const n=group(parent,'Eye',at);n.scale.setScalar(size);n.userData.eyeScale=size;const ink=material('#1b1831',.25),white=material('#fffdf9',.3),iris=material(irisColour,.3);
 orb(n,ink,[0,0,0],[.151,.177,.08]);orb(n,white,[0,0,.025],[.14,.166,.08]);orb(n,iris,[.008,-.008,.093],[.086,.108,.035]);orb(n,ink,[.009,-.01,.117],[.052,.078,.024]);orb(n,white,[-.023,.034,.139],[.024,.028,.01]);orb(n,white,[.039,-.038,.139],[.009,.011,.007]);return n;
}
function mouth(parent,at,width=.13){const ink=material('#302039',.65);tube(parent,ink,[[at[0]-width,at[1],at[2]],[at[0],at[1]-.055,at[2]+.02],[at[0]+width,at[1],at[2]]],.016)}
function mitten(parent,m,side,at){const arm=group(parent,side<0?'ArmL':'ArmR',at);orb(arm,m,[side*.02,-.15,.09],[.105,.19,.105]);orb(arm,m,[side*.03,-.29,.17],[.13,.115,.12]);orb(arm,m,[side*.12,-.26,.18],[.05,.065,.06]);return arm}
function seatedLegs(parent,body,boots=body){for(const side of [-1,1]){orb(parent,body,[side*.22,-.055,.18],[.15,.145,.26]);orb(parent,body,[side*.22,-.25,.36],[.11,.24,.115]);orb(parent,boots,[side*.22,-.46,.43],[.16,.13,.22])}}
function ear(parent,outer,inner,side){const shape=new T.Shape();shape.moveTo(-.21,0);shape.quadraticCurveTo(-.16,.18,0,.43);shape.quadraticCurveTo(.1,.24,.2,0);shape.closePath();const g=geometry('cat-ear',()=>new T.ExtrudeGeometry(shape,{depth:.13,bevelEnabled:true,bevelSize:.035,bevelThickness:.035,bevelSegments:3,steps:1}));const n=mesh(parent,g,outer,[side*.37,1.22,-.05]);n.rotation.z=-side*.14;const inside=mesh(parent,g,inner,[side*.37,1.25,.05],[.58,.68,.18]);inside.rotation.z=-side*.14}
function puffyStar(){return geometry('puffy-star',()=>{
 const points=Array.from({length:10},(_,i)=>{const a=Math.PI/2+i*Math.PI/5,r=i%2?.35:.64;return new T.Vector3(Math.cos(a)*r,Math.sin(a)*r,0)}),curve=new T.CatmullRomCurve3(points,true,'catmullrom',.5),outline=curve.getPoints(100).slice(0,-1),positions=[],indices=[],rings=16,count=outline.length;
 for(const side of [1,-1])for(let ring=0;ring<=rings;ring++){const a=ring/rings*Math.PI/2;for(const p of outline)positions.push(p.x*Math.sin(a),p.y*Math.sin(a),side*.24*Math.cos(a))}
 for(let side=0;side<2;side++)for(let ring=0;ring<rings;ring++)for(let j=0;j<count;j++){const start=side*(rings+1)*count,a=start+ring*count+j,b=start+(ring+1)*count+j,c=start+(ring+1)*count+(j+1)%count,d=start+ring*count+(j+1)%count;if(side)indices.push(a,c,b,a,d,c);else indices.push(a,b,c,a,c,d)}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return g;
})}
function skin(face,colour){const bases=['#a17ae0','#9067c0','#ed9a66','#48b7a9','#f2c75e','#75c8e8','#ffc22a'],shift=[0,255/360,95/360,155/360,315/360,40/360,220/360,0][colour]||0;const c=new T.Color(bases[face]);if(colour===7)c.lerp(new T.Color('#b7b4c4'),.72);else c.offsetHSL(shift,0,0);return material('#'+c.getHexString(),face===1?.31:.56,face===1?.17:0)}

function bakeRigid(parent){
 for(const child of [...parent.children])if(!child.isMesh)bakeRigid(child);
 const groups=new Map();for(const child of [...parent.children])if(child.isMesh){child.updateMatrix();const list=groups.get(child.material)||[];list.push(child);groups.set(child.material,list)}
 for(const [m,parts]of groups){if(parts.length<2)continue;const pieces=parts.map(n=>(n.geometry.index?n.geometry.toNonIndexed():n.geometry.clone()).applyMatrix4(n.matrix));const merged=mergeGeometries(pieces);pieces.forEach(n=>n.dispose());merged.userData.owned=true;parts.forEach(n=>parent.remove(n));mesh(parent,merged,m)}
}

function weave(){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const c=canvas.getContext('2d'),image=c.createImageData(128,128);let seed=47;
 for(let y=0;y<128;y++)for(let x=0;x<128;x++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const v=155+(seed%17)+(x%3===0?15:0)+(y%3===0?11:0),i=(y*128+x)*4;image.data.set([v,v,v,255],i)}c.putImageData(image,0,0);const texture=new T.CanvasTexture(canvas);texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.repeat.set(8,6);return texture;
}
function furniture(){
 const root=new T.Group(),wood=material('#59404b',.48),gold=material('#c9a57b',.32,.5),felt=material('#73598d',.92),cushion=material('#9672b0',.76);if(!felt.bumpMap){felt.bumpMap=weave();felt.bumpScale=.009;cushion.bumpMap=felt.bumpMap;cushion.bumpScale=.006}
 box(root,wood,[0,TABLE_TOP-.12,0],[3.7,.26,2.62],.2);box(root,gold,[0,TABLE_TOP+.02,0],[3.57,.06,2.49],.16);box(root,felt,[0,TABLE_TOP+.055,0],[3.42,.065,2.34],.15);
 for(const x of [-1.32,1.32])for(const z of [-.82,.82]){box(root,wood,[x,.65,z],[.19,1.3,.19],.06);box(root,gold,[x,.13,z],[.2,.16,.2],.035)}
 for(const seat of TABLE_SEATS){const chair=group(root,'Chair',[seat.x,0,seat.z]);chair.rotation.y=seat.yaw;box(chair,wood,[0,.8,0],[1.07,.17,1.0],.12);box(chair,cushion,[0,.9,0],[.97,.16,.9],.14);box(chair,wood,[0,1.36,-.44],[1.08,1.08,.18],.16);box(chair,cushion,[0,1.4,-.32],[.89,.83,.11],.12);for(const x of [-.36,.36])for(const z of [-.32,.32])box(chair,wood,[x,.39,z],[.12,.78,.12],.035);for(const side of [-1,1]){orb(chair,gold,[side*.41,1.77,-.4],[.044,.045,.035]);box(chair,wood,[side*.5,1.1,0],[.1,.12,.75],.04)}}
 // Bake only static furniture together; people retain real articulated joints.
 root.updateMatrixWorld(true);const byMaterial=new Map();root.traverse(n=>{if(!n.isMesh)return;const list=byMaterial.get(n.material)||[];list.push((n.geometry.index?n.geometry.toNonIndexed():n.geometry.clone()).applyMatrix4(n.matrixWorld));byMaterial.set(n.material,list)});const merged=new T.Group();for(const [m,list]of byMaterial){const g=mergeGeometries(list);list.forEach(n=>n.dispose());mesh(merged,g,m)}return merged;
}

export class TableScene{
 constructor({onProject,onGreet,onError,onRestore,paths,colours}){
  this.onProject=onProject;this.onGreet=onGreet;this.onError=onError;this.onRestore=onRestore;this.scene=new T.Scene();this.people=Array(4).fill(null);this.poses=new Map();this.visible=false;this.angle=.55;this.angleTarget=.55;this.angularVelocity=0;this.lastTick=0;this.lastDraw=0;this.camera=new T.PerspectiveCamera(36,1.4,.1,50);this.target=new T.Vector3(0,1.0,0);
  this.renderer=new T.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.0;this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.VSMShadowMap;this.canvas=this.renderer.domElement;this.canvas.className='table-scene-canvas';this.canvas.setAttribute('aria-hidden','true');
  const environment=new RoomEnvironment(),pmrem=new T.PMREMGenerator(this.renderer);this.environment=pmrem.fromScene(environment,.04);this.scene.environment=this.environment.texture;this.scene.environmentIntensity=.55;environment.dispose();pmrem.dispose();
  const ambient=new T.HemisphereLight('#f6e8ff','#554568',.7);this.scene.add(ambient);const key=new T.DirectionalLight('#fff0db',2.3);key.position.set(-3.5,7,5);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-4;key.shadow.camera.right=4;key.shadow.camera.top=4;key.shadow.camera.bottom=-4;key.shadow.normalBias=.025;key.shadow.bias=-.00015;key.shadow.radius=10;key.shadow.blurSamples=8;key.shadow.camera.near=.5;key.shadow.camera.far=20;this.scene.add(key);const rim=new T.DirectionalLight('#bfa5ff',1.0);rim.position.set(3,4,-4);this.scene.add(rim);
  this.scene.add(furniture());const floor=mesh(this.scene,new T.PlaneGeometry(20,20),new T.ShadowMaterial({color:'#10081b',opacity:.08}),[0,-.012,0]);floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;floor.castShadow=false;
  this.tiles(paths,colours);this.raycaster=new T.Raycaster();this.bind();this.idle=null;
 }
 tiles(paths,colours){
  const white=material('#fff9ee',.45),g=new T.Group();g.position.set(0,TABLE_TOP+.14,0);for(let i=0;i<4;i++){const tile=group(g,'Tile',[(i%2-.5)*.46,.005,Math.floor(i/2)*.46-.23]);tile.rotation.y=(i-1.5)*.08;box(tile,white,[0,0,0],[.4,.1,.4],.055);const svg=new SVGLoader().parse('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><path d="'+paths[[0,2,4,5][i]]+'"/></svg>');for(const path of svg.paths)for(const shape of path.toShapes()){const geo_=new T.ExtrudeGeometry(shape,{depth:.12,bevelEnabled:false,curveSegments:12});const symbol=mesh(tile,geo_,material(colours[[0,2,3,5][i]],.52));symbol.rotation.x=-Math.PI/2;symbol.scale.setScalar(.007);symbol.position.set(-.14,.052,.14)}}this.scene.add(g);
 }
 bind(){
  this.canvas.style.touchAction='pan-y';this.canvas.addEventListener('pointerdown',e=>{this.angularVelocity=0;this.angleTarget=this.angle;this.pointer={id:e.pointerId,x:e.clientX,y:e.clientY,angle:this.angle,drag:false,time:performance.now(),lastAngle:this.angle,velocity:0}});this.canvas.addEventListener('pointermove',e=>{const p=this.pointer;if(!p||p.id!==e.pointerId)return;const dx=e.clientX-p.x,dy=e.clientY-p.y;if(!p.drag&&Math.abs(dx)>8&&Math.abs(dx)>Math.abs(dy)*1.2){p.drag=true;this.canvas.setPointerCapture(e.pointerId)}if(p.drag){e.preventDefault();const now=performance.now(),next=p.angle-dx*.008;p.velocity=p.velocity*.45+(next-p.lastAngle)/Math.max(.008,(now-p.time)/1000)*.55;p.lastAngle=next;p.time=now;this.angle=next;this.angleTarget=next;this.render()}});this.canvas.addEventListener('pointerup',e=>{const p=this.pointer;this.pointer=null;if(!p)return;if(p.drag){if(!this.reduced){this.angularVelocity=Math.max(-3,Math.min(3,performance.now()-p.time>90?0:p.velocity));this.angleTarget=this.angle+this.angularVelocity*.18;this.startMotion()}return;}const r=this.canvas.getBoundingClientRect();this.raycaster.setFromCamera(new T.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),this.camera);const hit=this.raycaster.intersectObjects(this.people.filter(Boolean).map(p=>p.root),true)[0];if(hit){let n=hit.object;while(n&&n.userData.seat===undefined)n=n.parent;if(n)this.greet(n.userData.seat)}});this.canvas.addEventListener('pointercancel',()=>this.pointer=null);this.canvas.addEventListener('webglcontextrestored',()=>{this.lost=false;this.onRestore?.()});this.canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.lost=true;this.pause();this.onError?.()});
 }
 attach(host,seats,reduced){this.host=host;this.reduced=reduced;host.prepend(this.canvas);this.visible=true;this.setSeats(seats);this.resize();this.render();if(!reduced)this.startMotion()}
 setSeats(seats){seats.forEach((seat,i)=>{const signature=seat?seat.face+':'+seat.colour+':'+(seat.accessory||'none')+':'+accessoryColourKey(seat.accessoryColours):'';if(this.people[i]?.signature===signature){this.people[i].animations=seat?.animations;return;}if(this.people[i]){this.scene.remove(this.people[i].root);disposePerson(this.people[i].root);this.poses.delete(i)}this.people[i]=null;if(!seat)return;const root=createSeatedCharacter(seat.face,seat.colour,seat.accessory,seat.accessoryColours),at=TABLE_SEATS[i];root.position.set(at.x,SEAT_HEIGHT+(root.userData.seatOffset||0),at.z);root.rotation.y=at.yaw;root.userData.seat=i;this.scene.add(root);this.people[i]={root,signature,animations:seat.animations};});}
 setMotion(reduced){if(this.reduced===reduced)return;this.reduced=reduced;if(reduced){this.pause();this.visible=true;this.render()}else this.startMotion()}
 resize(){if(!this.host)return;const w=this.host.clientWidth,h=this.host.clientHeight;if(!w||!h)return;this.width=w;this.height=h;this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.render()}
 positionCamera(){
  const direction=new T.Vector3(Math.sin(this.angle),.84,Math.cos(this.angle)).normalize(),points=[];
  for(const x of [-1.87,1.87])for(const z of [-1.33,1.33])for(const y of [0,1.55])points.push(new T.Vector3(x,y,z));
  TABLE_SEATS.forEach((seat,i)=>{for(const x of [-.58,.58])for(const [y,z]of [[.02,-.5],[.02,.5],[1.92,-.5],[1.0,.5]])points.push(new T.Vector3(seat.x+Math.cos(seat.yaw)*x+Math.sin(seat.yaw)*z,y,seat.z-Math.sin(seat.yaw)*x+Math.cos(seat.yaw)*z));if(this.people[i])for(const x of [-.62,.62])for(const y of [1.45,2.82])points.push(new T.Vector3(seat.x+Math.cos(seat.yaw)*x,y,seat.z-Math.sin(seat.yaw)*x));});
  const right=new T.Vector3().crossVectors(new T.Vector3(0,1,0),direction).normalize(),up=new T.Vector3().crossVectors(direction,right).normalize(),tan=Math.tan(this.camera.fov*Math.PI/360);let distance=5.4;
  for(const point of points){const p=point.clone().sub(this.target),depth=p.dot(direction);distance=Math.max(distance,depth+Math.abs(p.dot(right))/(tan*this.camera.aspect*.91),depth+Math.abs(p.dot(up))/(tan*.88))}
  this.camera.position.copy(this.target).addScaledVector(direction,distance);this.camera.lookAt(this.target);this.camera.updateMatrixWorld();this.distance=distance;

 }

 render(){if(!this.visible||!this.width||document.hidden||this.lost)return;this.positionCamera();this.renderer.render(this.scene,this.camera);this.lastDraw=performance.now();const labels=TABLE_SEATS.map((s,i)=>{const p=new T.Vector3(s.x,this.people[i]?2.82:1.03,s.z).project(this.camera);return {index:i,x:(p.x+1)*.5*this.width,y:Math.max(7,Math.min(this.height-24,(1-p.y)*.5*this.height)),visible:p.z<1}});this.onProject?.(this.host,labels);this.host.dataset.sceneReady='true';this.host.dataset.sceneDistance=this.distance.toFixed(2);this.host.dataset.sceneTriangles=String(this.renderer.info.render.triangles);this.host.dataset.sceneDraws=String(this.renderer.info.render.calls);}
 rotate(delta){this.angleTarget+=delta;if(this.reduced){this.angle=this.angleTarget;this.angularVelocity=0;this.render();return}this.startMotion()}
 startMotion(){if(!this.frame){this.lastTick=performance.now();this.frame=requestAnimationFrame(now=>this.tick(now))}}
 react(index,mood){if(!this.people[index])return false;mood=resolveAnimationMood(mood,this.people[index].animations);const now=performance.now(),old=this.poses.get(index);if(old&&!acceptsCharacterGesture(old.mood,mood,(CHARACTER_DURATIONS[old.mood]||1.85)*1000-(now-old.start)))return false;this.poses.set(index,{start:now,mood,previous:old||{mood:'idle',start:now}});this.startMotion();return true}
 greet(index,idle=false){if(!this.people[index]||!this.visible||document.hidden||idle)return;if(this.reduced){this.onGreet?.(this.host,index);return}if(this.react(index,'hello'))this.onGreet?.(this.host,index)}
 tick(now){
  this.frame=null;if(!this.visible||document.hidden)return;
  const dt=Math.min(.032,Math.max(.001,(now-this.lastTick)/1000));this.lastTick=now;
  let moving=Math.abs(this.angleTarget-this.angle)>.0003||Math.abs(this.angularVelocity)>.003;
  if(moving&&!this.pointer?.drag){const step=dt/3;for(let j=0;j<3;j++){this.angularVelocity+=(100*(this.angleTarget-this.angle)-20*this.angularVelocity)*step;this.angle+=this.angularVelocity*step}if(Math.abs(this.angleTarget-this.angle)<.0003&&Math.abs(this.angularVelocity)<.003){this.angle=this.angleTarget;this.angularVelocity=0;moving=false}}
  const living=this.people?.some(Boolean)&&!this.reduced;
  const draw=now-this.lastDraw>=(moving||this.poses.size?15:32)||!living;
  if(draw)for(let i=0;i<(this.people?.length||0);i++){const person=this.people[i];if(!person)continue;const pose=this.poses.get(i),base={time:now/1000+i*1.17,face:person.root.userData.rig.face,reduced:this.reduced};let previous=null;if(pose?.previous&&now-pose.start<180&&!this.reduced){animateCharacter(person.root,{...base,mood:pose.previous.mood,elapsed:(now-pose.previous.start)/1000});previous=captureCharacterPose(person.root)}const active=animateCharacter(person.root,{...base,mood:pose?.mood||'idle',elapsed:pose?(now-pose.start)/1000:0});if(previous)blendCharacterPose(previous,(now-pose.start)/180);if(pose&&!active)this.poses.delete(i)}
  if(draw)this.render();if(moving||this.poses.size||living)this.frame=requestAnimationFrame(t=>this.tick(t));

 }
 pause(){this.visible=false;this.pointer=null;this.angleTarget=this.angle;this.angularVelocity=0;if(this.frame)cancelAnimationFrame(this.frame);this.frame=null;for(const p of this.people.filter(Boolean))resetCharacter(p.root);this.poses.clear()}
 dispose(){this.pause();clearInterval(this.idle);for(const p of this.people.filter(Boolean)){this.scene.remove(p.root);disposePerson(p.root)}this.environment.dispose();const geometries=new Set(geo.values()),materials=new Set(mats.values());this.scene.traverse(n=>{if(n.isMesh){geometries.add(n.geometry);materials.add(n.material)}});for(const g of geometries)g.dispose();const textures=new Set();for(const m of materials){if(m.bumpMap)textures.add(m.bumpMap);m.dispose()}for(const texture of textures)texture.dispose();geo.clear();mats.clear();this.renderer.dispose();this.canvas.remove()}
}
