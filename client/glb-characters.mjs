import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshBVH,acceleratedRaycast} from 'three-mesh-bvh';

// Painted vinyl characters (renkio-3d pipeline: image -> 3D -> Blender rig).
// One skinned mesh per character. Bones are rebuilt here with identity rest
// orientation so the shared procedural motion (character-motion.mjs) can rotate
// Head/Torso/Arm/Elbow/Wrist/Leg/Knee/Tail exactly like the old rigid parts.
export const GLB_FACES=Object.freeze({0:'pof',1:'robot',2:'cat',3:'cyclops',5:'jelly',6:'star'});
const store=new Map();
let pending=null;
const FEET=-.3;

function sanitize(n){return String(n||'').replace(/[^A-Za-z0-9_]/g,'')}
// Skin weights are baked by renkio-3d/scripts/bake-weights.mjs: elbow/wrist folded into the arm and
// smoothed over ~80 rings, so joints spread their bend instead of shearing the fused vinyl skin.
function prepare(face,gltf){
 const scene=gltf.scene;scene.updateMatrixWorld(true);
 let skinned=null;scene.traverse(n=>{if(n.isSkinnedMesh&&!skinned)skinned=n});
 if(!skinned)throw Error('No skinned mesh for face '+face);
 let info={};scene.traverse(n=>{const raw=n.userData?.renkio;if(raw)try{info=JSON.parse(raw)}catch{}});
 const box=new T.Box3().setFromBufferAttribute(skinned.geometry.attributes.position).applyMatrix4(skinned.matrixWorld);
 const height=box.max.y-box.min.y,width=box.max.x-box.min.x,scale=Math.min(1.55,1.25/Math.max(width/height,.01))/height;
 const model=new T.Matrix4().makeTranslation(0,FEET,0).multiply(new T.Matrix4().makeScale(scale,scale,scale)).multiply(new T.Matrix4().makeTranslation(0,-box.min.y,0));
 const geometry=skinned.geometry.clone();geometry.applyMatrix4(new T.Matrix4().multiplyMatrices(model,skinned.matrixWorld));
 geometry.computeBoundingSphere();geometry.computeBoundingBox();
 const bones=skinned.skeleton.bones.map(b=>{const p=b.getWorldPosition(new T.Vector3()).applyMatrix4(model);return {name:sanitize(b.name),at:p,parent:b.parent?.isBone?sanitize(b.parent.name):null}});
 const anchors={};scene.traverse(n=>{const k=sanitize(n.name);if(/^(EyeL|EyeR|Eye|Mouth)$/.test(k)){const p=n.getWorldPosition(new T.Vector3()).applyMatrix4(model),e=n.userData||{},nrm=new T.Vector3(...(e.n||[0,0,-1]));anchors[k]={at:p,normal:new T.Vector3(nrm.x,nrm.z,-nrm.y).normalize(),rx:(e.rx||e.r||.04)*scale,ry:(e.ry||e.r||.04)*scale}}});
 const map=skinned.material.map||null;if(map){map.colorSpace=T.SRGBColorSpace;map.anisotropy=4}
 // Rays (accessory fitting, taps) go to a static BVH copy of the bind pose: skinned raycasts are far too slow.
 const probe=new T.BufferGeometry();probe.setAttribute('position',geometry.attributes.position);probe.setIndex(geometry.index);probe.boundsTree=new MeshBVH(probe);
 store.set(face,{geometry,probe,bones,anchors,map,scale,info,base:dominantColour(map)});
}
function dominantColour(map){
 try{const img=map?.image;if(!img)return new T.Color('#ffffff');const c=document.createElement('canvas');c.width=c.height=48;const g=c.getContext('2d');g.drawImage(img,0,0,48,48);const d=g.getImageData(0,0,48,48).data,bins=new Map();
  for(let i=0;i<d.length;i+=4){const col=new T.Color(d[i]/255,d[i+1]/255,d[i+2]/255),hsl={};col.getHSL(hsl);if(hsl.s<.18||hsl.l<.12||hsl.l>.92)continue;const k=Math.round(hsl.h*24)%24;bins.set(k,(bins.get(k)||0)+1)}
  let best=0,count=-1;for(const [k,v]of bins)if(v>count){best=k;count=v}
  let r=0,gg=0,b=0,n=0;for(let i=0;i<d.length;i+=4){const col=new T.Color(d[i]/255,d[i+1]/255,d[i+2]/255),hsl={};col.getHSL(hsl);if(hsl.s<.18||hsl.l<.12||hsl.l>.92||Math.round(hsl.h*24)%24!==best)continue;r+=d[i];gg+=d[i+1];b+=d[i+2];n++}
  return n?new T.Color(r/n/255,gg/n/255,b/n/255):new T.Color('#ffffff');
 }catch{return new T.Color('#ffffff')}
}
export function preloadCharacterModels(base='/assets/'){
 if(pending)return pending;
 if(typeof window==='undefined'||typeof fetch==='undefined')return pending=Promise.resolve(false);
 // Older Android shells cannot serve .glb files from an update snapshot: keep their built-in models.
 const native=window.RenkioNative;if(native&&typeof native.characterModels!=='function')return pending=Promise.resolve(false);
 const loader=new GLTFLoader();
 // The page CSP allows blob: images but not blob: fetches: decode embedded textures through <img>.
 loader.register(parser=>{parser.textureLoader=new T.TextureLoader(parser.options.manager);parser.textureLoader.setCrossOrigin(parser.options.crossOrigin||'anonymous');return {name:'renkio_img_textures'}});
 pending=Promise.all(Object.entries(GLB_FACES).map(([face,name])=>loader.loadAsync(base+'char-'+name+'.glb').then(g=>prepare(Number(face),g)).catch(e=>console.warn('[renkio] character model',name,e)))).then(()=>{
  const ok=store.size>0;if(ok)window.dispatchEvent(new CustomEvent('renkio:characters-ready'));return ok});
 return pending;
}
export function hasGlbCharacter(face){return store.has(face)}

// Body colour variants: shift only the dominant body hue, keep the painting.
const materials=new Map();
function hueShift(face,targetHex){
 if(!targetHex)return null;const entry=store.get(face),src={},dst={};entry.base.getHSL(src);new T.Color(targetHex).getHSL(dst);
 const sat=src.s>0?Math.min(1.6,dst.s/src.s):1,light=dst.l-src.l;
 // Body pixels move to the target hue; their small hue variations are compressed so highlights never overshoot into another colour.
 return m=>{m.onBeforeCompile=s=>{s.uniforms.hueTarget={value:dst.h};s.uniforms.hueBase={value:src.h};s.uniforms.satScale={value:sat};s.uniforms.lightShift={value:light};
   s.fragmentShader='uniform float hueTarget;uniform float hueBase;uniform float satScale;uniform float lightShift;\nvec3 rk_rgb2hsv(vec3 c){vec4 K=vec4(0.,-1./3.,2./3.,-1.);vec4 p=mix(vec4(c.bg,K.wz),vec4(c.gb,K.xy),step(c.b,c.g));vec4 q=mix(vec4(p.xyw,c.r),vec4(c.r,p.yzx),step(p.x,c.r));float d=q.x-min(q.w,q.y);float e=1.0e-10;return vec3(abs(q.z+(q.w-q.y)/(6.*d+e)),d/(q.x+e),q.x);}\nvec3 rk_hsv2rgb(vec3 c){vec4 K=vec4(1.,2./3.,1./3.,3.);vec3 p=abs(fract(c.xxx+K.xyz)*6.-K.www);return c.z*mix(K.xxx,clamp(p-K.xxx,0.,1.),c.y);}\n'+s.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\n{vec3 hsv=rk_rgb2hsv(diffuseColor.rgb);float dh=fract(hsv.x-hueBase+.5)-.5;float w=smoothstep(.17,.07,abs(dh))*smoothstep(.05,.18,hsv.y);float nh=fract(hueTarget+dh*.3);float delta=fract(nh-hsv.x+.5)-.5;hsv.x=fract(hsv.x+delta*w);hsv.y=clamp(mix(hsv.y,hsv.y*satScale,w),0.,1.);hsv.z=clamp(hsv.z+lightShift*.5*w,0.,1.);diffuseColor.rgb=rk_hsv2rgb(hsv);}')};
  m.customProgramCacheKey=()=>'rk-hue2:'+dst.h.toFixed(3)+':'+sat.toFixed(3)+':'+light.toFixed(3)+':'+(m.transparent?'t':'o')};
}
function bodyMaterial(face,targetHex){
 const key=face+':'+(targetHex||'base');if(materials.has(key))return materials.get(key);
 const entry=store.get(face),m=new T.MeshStandardMaterial({map:entry.map,roughness:.62,metalness:0});hueShift(face,targetHex)?.(m);
 materials.set(key,m);return m;
}

// Painted faces get conforming decals: a patch of the real head surface (lit like the body)
// whose texture erases the painted feature with the surrounding skin and draws a new one.
function pixels(entry){
 if(entry.pixels!==undefined)return entry.pixels;
 try{const img=entry.map?.image;const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const g=c.getContext('2d');g.drawImage(img,0,0);entry.pixels={data:g.getImageData(0,0,img.width,img.height).data,W:img.width,H:img.height}}catch{entry.pixels=null}
 return entry.pixels;
}
function nearestVertex(entry,point){const pos=entry.geometry.attributes.position;let best=0,bd=1e9;const v=new T.Vector3();for(let i=0;i<pos.count;i++){v.fromBufferAttribute(pos,i);const d=v.distanceToSquared(point);if(d<bd){bd=d;best=i}}return best}
function texel(entry,i,radius=2){
 const px=pixels(entry),uv=entry.geometry.attributes.uv;if(!px||!uv)return null;
 const x=Math.round(uv.getX(i)*(px.W-1)),y=Math.round(uv.getY(i)*(px.H-1));let r=0,g=0,b=0,n=0;
 for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){const xx=Math.min(px.W-1,Math.max(0,x+dx)),yy=Math.min(px.H-1,Math.max(0,y+dy)),k=(yy*px.W+xx)*4;r+=px.data[k];g+=px.data[k+1];b+=px.data[k+2];n++}
 return [r/n,g/n,b/n];
}
function frame(anchor){const n=anchor.normal.clone().normalize(),right=new T.Vector3(0,1,0).cross(n).normalize(),up=n.clone().cross(right).normalize();return {n,right,up}}
// Skin around an ellipse (outliers such as lashes, brows and lips rejected).
function ring(entry,anchor,ex,ey,eyUp=ey){
 const {right,up}=frame(anchor),samples=[];
 for(let k=0;k<40;k++){const t=k/40*Math.PI*2,x=Math.cos(t)*ex,y=Math.sin(t)*(Math.sin(t)>0?eyUp:ey),p=anchor.at.clone().addScaledVector(right,x).addScaledVector(up,y),c=texel(entry,nearestVertex(entry,p));if(c)samples.push({x,y,c,l:.3*c[0]+.59*c[1]+.11*c[2]})}
 if(!samples.length)return samples;const ls=samples.map(s=>s.l).sort((a,b)=>a-b),med=ls[ls.length>>1];
 const keep=samples.filter(s=>Math.abs(s.l-med)<34);return keep.length>=8?keep:samples;
}
const RES=160,probeMaterial=new T.MeshBasicMaterial({visible:false});
function patchTexture(entry,anchor,kind,ex,ey,span,ink,robot,eyUp=ey){
 const c=document.createElement('canvas');c.width=c.height=RES;const g=c.getContext('2d'),img=g.createImageData(RES,RES),d=img.data,ringPts=ring(entry,anchor,ex*1.18,ey*1.18,eyUp*1.18);
 const toLocal=(px,py)=>[((px+.5)/RES-.5)*span[0],(.5-(py+.5)/RES)*span[1]];
 for(let py=0;py<RES;py++)for(let px=0;px<RES;px++){const [x,y]=toLocal(px,py),rho=Math.hypot(x/ex,y/(y>0?eyUp:ey)),k=(py*RES+px)*4;
  if(rho>=1.12||!ringPts.length){d[k+3]=0;continue}
  let r=0,gg=0,b=0,w=0;for(const s of ringPts){const q=1/((x-s.x)**2+(y-s.y)**2+1e-6);r+=s.c[0]*q;gg+=s.c[1]*q;b+=s.c[2]*q;w+=q}
  d[k]=r/w;d[k+1]=gg/w;d[k+2]=b/w;d[k+3]=255*Math.min(1,Math.max(0,(1.12-rho)/.22))}
 g.putImageData(img,0,0);
 // feature drawing in pixels: s = pixels per unit, centred
 const sx=RES/span[0],sy=RES/span[1],cx=RES/2,cy=RES/2,W=ex*sx,H=Math.min(ey,eyUp*1.1)*sy;
 g.strokeStyle=ink;g.fillStyle=ink;g.lineCap='round';g.lineJoin='round';if(robot){g.shadowColor=ink;g.shadowBlur=RES*.06}
 const lw=Math.max(3,Math.min(W,H*1.6)*.22);
 if(kind==='lid'){g.lineWidth=lw*.8;g.beginPath();g.moveTo(cx-W*.9,cy-H*.05);g.quadraticCurveTo(cx,cy+H*.55,cx+W*.9,cy-H*.05);g.stroke();
  if(!robot){g.lineWidth=lw*.45;for(const u of [-.55,0,.55]){const bx=cx+u*W*.95,by=cy+H*(.27-.12*u*u);g.beginPath();g.moveTo(bx,by);g.lineTo(bx+u*W*.18,by+H*.32);g.stroke()}}}
 else{const mw=W*.82,mh=H;
  if(kind==='happy'){g.fillStyle=robot?ink:'#5b1f33';g.beginPath();g.moveTo(cx-mw,cy-mh*.25);g.quadraticCurveTo(cx,cy-mh*.05,cx+mw,cy-mh*.25);g.bezierCurveTo(cx+mw*.85,cy+mh*.95,cx-mw*.85,cy+mh*.95,cx-mw,cy-mh*.25);g.fill();
   if(!robot){g.save();g.clip();g.fillStyle='#ff8098';g.beginPath();g.ellipse(cx,cy+mh*.7,mw*.5,mh*.42,0,0,Math.PI*2);g.fill();g.restore();g.lineWidth=lw*.35;g.strokeStyle=ink;g.beginPath();g.moveTo(cx-mw,cy-mh*.25);g.quadraticCurveTo(cx,cy-mh*.05,cx+mw,cy-mh*.25);g.stroke()}}
  else if(kind==='sad'){g.lineWidth=lw;g.beginPath();g.moveTo(cx-mw*.75,cy+mh*.35);g.quadraticCurveTo(cx,cy-mh*.55,cx+mw*.75,cy+mh*.35);g.stroke()}
  else if(kind==='surprise'){g.fillStyle=robot?ink:'#5b1f33';g.beginPath();g.ellipse(cx,cy+mh*.05,mw*.36,mh*.62,0,0,Math.PI*2);g.fill();if(!robot){g.fillStyle='#ff8098';g.beginPath();g.ellipse(cx,cy+mh*.38,mw*.22,mh*.2,0,0,Math.PI*2);g.fill()}}
  else if(kind==='angry'){if(robot){g.lineWidth=lw*.7;g.beginPath();const n=6;for(let i=0;i<=n;i++){const x=cx-mw*.7+mw*1.4*i/n,y=cy+mh*.05+(i%2?-1:1)*mh*.22;i?g.lineTo(x,y):g.moveTo(x,y)}g.stroke()}
   else{const w=mw*.98,h=mh*.68,y0=cy-h*.42,r=h*.4;g.fillStyle='#fffaf2';g.beginPath();g.moveTo(cx-w+r,y0);g.quadraticCurveTo(cx,y0+h*.28,cx+w-r,y0);g.quadraticCurveTo(cx+w,y0,cx+w,y0+r);g.lineTo(cx+w,y0+h-r*.6);g.quadraticCurveTo(cx+w,y0+h,cx+w-r,y0+h);g.quadraticCurveTo(cx,y0+h*1.25,cx-w+r,y0+h);g.quadraticCurveTo(cx-w,y0+h,cx-w,y0+h-r*.6);g.lineTo(cx-w,y0+r);g.quadraticCurveTo(cx-w,y0,cx-w+r,y0);g.closePath();g.fill();
    g.lineWidth=Math.max(2,lw*.38);g.stroke();g.lineWidth=Math.max(1.5,lw*.24);g.beginPath();g.moveTo(cx-w*.92,y0+h*.56);g.quadraticCurveTo(cx,y0+h*.72,cx+w*.92,y0+h*.56);for(const u of [-.45,0,.45]){g.moveTo(cx+u*w,y0+h*.12);g.lineTo(cx+u*w,y0+h*1.02)}g.stroke()}}}
 const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;return t;
}
// The patch is the head surface itself (bind pose), so it follows every curve and bump.
function patchGeometry(entry,anchor,span,depth){
 const {n,right,up}=frame(anchor),pos=entry.geometry.attributes.position,nor=entry.geometry.attributes.normal,index=entry.geometry.index,v=new T.Vector3(),local=[];
 const inside=i=>{v.fromBufferAttribute(pos,i).sub(anchor.at);const x=v.dot(right),y=v.dot(up),z=v.dot(n);local[i]=[x,y,z];return Math.abs(x)<span[0]/2&&Math.abs(y)<span[1]/2},near=i=>Math.abs(local[i][2])<depth&&Math.abs(local[i][0])<span[0]&&Math.abs(local[i][1])<span[1];
 const P=[],N=[],U=[],tri=index?index.count/3:pos.count/3,map=new Map(),idx=[];
 for(let t=0;t<tri;t++){const ids=[0,1,2].map(k=>index?index.getX(t*3+k):t*3+k);const hits=ids.map(inside);if(!hits.some(Boolean)||!ids.every(near))continue;
  if(nor){let f=0;for(const i of ids)f+=nor.getX(i)*n.x+nor.getY(i)*n.y+nor.getZ(i)*n.z;if(f<.6)continue}
  for(const i of ids){if(!map.has(i)){map.set(i,P.length/3);v.fromBufferAttribute(pos,i);const nn=nor?new T.Vector3().fromBufferAttribute(nor,i):n;P.push(v.x+nn.x*.0025,v.y+nn.y*.0025,v.z+nn.z*.0025);N.push(nn.x,nn.y,nn.z);U.push(local[i][0]/span[0]+.5,local[i][1]/span[1]+.5)}idx.push(map.get(i))}}
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(P,3));geo.setAttribute('normal',new T.Float32BufferAttribute(N,3));geo.setAttribute('uv',new T.Float32BufferAttribute(U,2));geo.setIndex(idx);return geo;
}
function patch(entry,root,head,key,anchor,tex,span,shade){
 entry.patches||=new Map();let geo=entry.patches.get(key);
 if(!geo){geo=patchGeometry(entry,anchor,span,Math.max(span[0],span[1])*.45);entry.patches.set(key,geo)}
 const m=new T.MeshStandardMaterial({map:tex,transparent:true,depthWrite:false,roughness:.62,metalness:0,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-4});
 if(shade)shade(m);m.userData.instanceOwned=true;
 const mesh=new T.Mesh(geo,m);mesh.name='FacePatch';mesh.renderOrder=3;mesh.visible=false;mesh.raycast=()=>{};
 // geometry is in model (root) space; express it in the head bone frame
 root.updateMatrixWorld(true);new T.Matrix4().copy(head.matrixWorld).invert().multiply(root.matrixWorld).decompose(mesh.position,mesh.quaternion,mesh.scale);head.add(mesh);return mesh;
}

export function buildGlbCharacter(root,face,pose,bodyHex,baseHex){
 const entry=store.get(face);if(!entry)return null;
 const byName=new Map(),list=[];
 for(const b of entry.bones){const bone=new T.Bone();bone.name=b.name;byName.set(b.name,{bone,at:b.at,parent:b.parent});list.push(bone)}
 for(const [name,{bone,at,parent}]of byName){const p=parent&&byName.get(parent);if(p){p.bone.add(bone);bone.position.copy(at).sub(p.at)}else{root.add(bone);bone.position.copy(at)}}
 const material=bodyMaterial(face,bodyHex&&baseHex&&bodyHex.toLowerCase()!==baseHex.toLowerCase()?bodyHex:null);
 const mesh=new T.SkinnedMesh(entry.geometry,material);mesh.name='Body';mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;
 root.add(mesh);root.updateMatrixWorld(true);mesh.bind(new T.Skeleton(list),mesh.matrixWorld);mesh.raycast=()=>{};
 const hit=new T.Mesh(entry.probe,probeMaterial);hit.name='BodyProbe';hit.raycast=acceleratedRaycast;hit.userData.probe=true;root.add(hit);
 const get=n=>byName.get(n)?.bone||null;
 const head=get('Head'),torso=get('Torso')||root,arms=[get('ArmL'),get('ArmR')].filter(Boolean);
 for(const [i,a]of arms.entries()){const s=i?'R':'L',elbow=get('Elbow'+s),wrist=get('Wrist'+s);a.userData.elbow=elbow;a.userData.wrist=wrist;const tip=wrist?wrist.getWorldPosition(new T.Vector3()):new T.Vector3();a.userData.grip=a.worldToLocal(tip.clone()).toArray()}
 const legs=[get('LegL'),get('LegR')].filter(Boolean),knees=[get('KneeL'),get('KneeR')].filter(Boolean);
 if(pose==='seated'){for(const l of legs)l.rotation.x=-Math.PI/2;for(const k of knees)k.rotation.x=Math.PI/2}
 if(legs.length)root.userData.seatOffset=-(legs[0].getWorldPosition(new T.Vector3()).y-root.getWorldPosition(new T.Vector3()).y-.09);
 // Face: eyes and mouth are painted; blinks and expressions are conforming patches on the head bone.
 const robot=face===1,ink=robot?'#5ff2ff':'#3a1d2c',variant=!!(bodyHex&&baseHex&&bodyHex.toLowerCase()!==baseHex.toLowerCase()),shade=variant?hueShift(face,bodyHex):null;
 head.updateMatrixWorld(true);
 entry.textures||=new Map();const texture=(key,make)=>{if(!entry.textures.has(key))entry.textures.set(key,make());return entry.textures.get(key)};
 const eyes=[],lids=[];
 for(const k of ['EyeL','EyeR','Eye']){const a=entry.anchors[k];if(!a)continue;const eye=new T.Group();eye.name='Eye';head.add(eye);eye.position.copy(head.worldToLocal(a.at.clone()));eye.userData.eyeScale=1;eye.userData.size=[a.rx,a.ry,.03];eyes.push(eye);
  const ex=a.rx*1.26,ey=a.ry*1.2,span=[ex*2.5,ey*2.5];lids.push(patch(entry,root,head,k,a,texture('lid:'+k,()=>patchTexture(entry,a,'lid',ex,ey,span,ink,robot)),span,shade))}
 const mouthAnchor=entry.anchors.Mouth,shapes={};
 if(mouthAnchor){const ex=Math.max(mouthAnchor.rx,.025)*1.2,ey=Math.max(mouthAnchor.ry,.018)*1.35,span=[ex*2.5,ey*2.5],up=frame(mouthAnchor).up;
  // never erase into the eyes: the patch top stops short of the lowest eye
  let gap=9;for(const k of ['EyeL','EyeR','Eye']){const e=entry.anchors[k];if(e)gap=Math.min(gap,e.at.clone().sub(mouthAnchor.at).dot(up)-e.ry*1.08)}
  const eyUp=Math.max(ey*.35,Math.min(ey,gap*.86/1.12));
  for(const k of ['happy','sad','surprise','angry'])shapes[k]=patch(entry,root,head,'Mouth',mouthAnchor,texture('mouth:'+k,()=>patchTexture(entry,mouthAnchor,k,ex,ey,span,ink,robot,eyUp)),span,shade)}
 let current='neutral';
 const facial={mesh:null,details:[],brows:[],mouth:null,
  expression(e){current=e;for(const [k,n]of Object.entries(shapes))n.visible=k===e},
  brow(){},reset(){this.expression('neutral')}};
 return {head,torso,arms,legs,knees,tail:get('Tail'),eyes,lids,facial,mesh,probe:hit,entry,headBox:headBox(entry),shapes};
}

// Bind-pose box of everything above the neck: portrait busts frame this, not the face decals.
function headBox(entry){
 if(entry.headBox)return entry.headBox.clone();
 const pos=entry.geometry.attributes.position,neck=entry.bones.find(b=>b.name==='Head')?.at.y??.4,box=new T.Box3(),v=new T.Vector3();
 for(let i=0;i<pos.count;i++){v.fromBufferAttribute(pos,i);if(v.y>=neck-.02)box.expandByPoint(v)}
 if(box.isEmpty())box.setFromBufferAttribute(pos);entry.headBox=box;return box.clone();
}
// Hat and neck fits measured on the bind pose, on the real skull: thin protrusions (antennas,
// ear tips, star points) are ignored, so hats sit snugly on the head instead of perching on a tip.
export function glbFits(face){
 const entry=store.get(face);if(!entry)return null;if(entry.fits)return entry.fits;
 const pos=entry.geometry.attributes.position,neck=entry.bones.find(b=>b.name==='Head')?.at.y??.6,P=[];
 for(let i=0;i<pos.count;i++){const y=pos.getY(i);if(y>neck)P.push([pos.getX(i),y,pos.getZ(i)])}
 const pct=(arr,q)=>{if(!arr.length)return 0;const a=[...arr].sort((x,y)=>x-y);return a[Math.min(a.length-1,Math.floor(q*(a.length-1)))]};
 let top=-9;for(const p of P)top=Math.max(top,p[1]);
 const headW=2*pct(P.map(p=>Math.abs(p[0])),.97),headH=top-neck;
 const slice=(y,band)=>{let x0=9,x1=-9,z0=9,z1=-9,n=0;for(let i=0;i<pos.count;i++){const py=pos.getY(i);if(Math.abs(py-y)>band)continue;const x=pos.getX(i),z=pos.getZ(i);x0=Math.min(x0,x);x1=Math.max(x1,x);z0=Math.min(z0,z);z1=Math.max(z1,z);n++}return n?{rx:(x1-x0)/2,rz:(z1-z0)/2,cz:(z0+z1)/2,front:z1}:{rx:.2,rz:.15,cz:0,front:.15}};
 const cz=pct(P.filter(p=>p[1]>neck+headH*.5).map(p=>p[2]),.5);
 const surface=(x,z,c=.04)=>{let y=-9;for(const p of P)if(Math.abs(p[0]-x)<c&&Math.abs(p[2]-z)<c)y=Math.max(y,p[1]);return y>-9?y:null};
 const ringTop=(r,q)=>{const ys=[];for(let k=0;k<16;k++){const t=k/16*Math.PI*2,y=surface(Math.cos(t)*r,cz+Math.sin(t)*r);if(y!==null)ys.push(y)}return ys.length?pct(ys,q):null};
 const centre=[];for(const [dx,dz]of[[0,0],[.06,0],[-.06,0],[0,.06],[0,-.06],[.04,.04],[-.04,.04],[.04,-.04],[-.04,-.04]]){const y=surface(dx,cz+dz,.03);if(y!==null)centre.push(y)}
 const skull=Math.min(top,centre.length?pct(centre,.5):top);
 const halfAt=y=>{const xs=P.filter(p=>Math.abs(p[1]-y)<.025).map(p=>Math.abs(p[0]));return xs.length?pct(xs,.9):headW/2};
 const floor=skull-headH*.28;let r=Math.max(.15,Math.min(.34,headW*.3)),rim=skull;
 // a hat is never wider than the head where it sits (star tips, narrow crowns)
 rim=Math.max(floor,Math.min(skull,ringTop(r*.82,.35)??skull-.06));const r2=Math.max(.14,Math.min(r,halfAt(rim)*1.45));if(r2<r){r=r2;rim=Math.max(floor,Math.min(skull,ringTop(r*.82,.35)??skull-.06))}
 // headband: inner arc (radius ~1.0, top .29) hugs the skull
 let s=.4;for(let k=0;k<6;k++)s=Math.max(.28,Math.min(.52,halfAt(skull-.75*s)*.86));
 const n=slice(neck,.03),rx=Math.min(n.rx,.36),rz=Math.min(n.rz,.3);
 // Chest pieces (bows, medals) stay below the mouth and below glasses; they scale with the head.
 const A=entry.anchors,eyesLow=Math.min(...['EyeL','EyeR','Eye'].filter(k=>A[k]).map(k=>A[k].at.y-Math.max(A[k].rx,A[k].ry)*1.7)),mouthLow=A.Mouth?A.Mouth.at.y-Math.max(A.Mouth.ry,.02)*1.3:9;
 const frontTop=Math.min(eyesLow,mouthLow)-.02,frontAt=y=>{let z=-9;for(let i=0;i<pos.count;i++){if(Math.abs(pos.getY(i)-y)<.03&&Math.abs(pos.getX(i))<.08)z=Math.max(z,pos.getZ(i))}return z>-9?z:.15};
 entry.fits={front:{top:frontTop,scale:Math.max(.5,Math.min(.95,headW*.3/.39)),at:frontAt},hat:{at:[0,rim-.012,cz],size:[r,r,r],top:skull},band:{at:[0,skull-.015-.29*s,cz],size:[s,s,s]},neck:{y:neck,fy:neck,front:Math.min(n.front,n.cz+rz),rx,rz,cz:n.cz}};
 return entry.fits;
}

// A round, funny rear for the turn-around celebration: two soft lobes on the back at hip height.
export function glbRear(face){
 const entry=store.get(face);if(!entry)return null;if(entry.rear)return entry.rear;
 const pos=entry.geometry.attributes.position,legs=entry.bones.filter(b=>b.name==='LegL'||b.name==='LegR'),torso=entry.bones.find(b=>b.name==='Torso');
 const y=legs.length?Math.max(...legs.map(b=>b.at.y))+.07:(torso?.at.y??.1)+.05;
 let back=9,x0=9,x1=-9;for(let i=0;i<pos.count;i++){const py=pos.getY(i);if(Math.abs(py-y)>.05)continue;const x=pos.getX(i),z=pos.getZ(i);x0=Math.min(x0,x);x1=Math.max(x1,x);if(Math.abs(x)<.09)back=Math.min(back,z)}
 if(back===9)back=-.2;const w=Math.min(.46,Math.max(.2,(x1-x0)*.55)),r=Math.min(w*.42,face===5?.11:.15);
 entry.rear={at:[0,y,back+r*.42],r,colour:'#'+entry.base.clone().offsetHSL(0,.06,-.07).getHexString()};return entry.rear;
}
