import {acceleratedRaycast} from 'three-mesh-bvh';
import {sculptSpec,sculptGeometry,wardrobeSpec,wardrobeGeometry} from './sculpt-v2.mjs';
import {BAKED_ACCESSORY_FITS} from './accessory-surfaces.mjs';
import {accessoryFit,REAR_PROFILES} from './character-fit.mjs';
import {createFacialRig} from './facial-rig.mjs';
import {characterBodyColour,accessoryList,accessoryColour,accessoryById} from '../public/character-style.mjs';
import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries,mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';

// A single model library is used by the table, portraits and expression previews.
const geometries=new Map(),materials=new Map(),contactPoints=new Map();
function geometry(key,make){if(!geometries.has(key))geometries.set(key,make());return geometries.get(key)}
function mat(colour,roughness=.4,metalness=0,options={}){const key=JSON.stringify([colour,roughness,metalness,options]);if(!materials.has(key))materials.set(key,new T.MeshPhysicalMaterial({color:colour,roughness,metalness,clearcoat:.24,clearcoatRoughness:.24,...options}));return materials.get(key)}
function group(parent,name,at=[0,0,0]){const n=new T.Group();n.name=name;n.position.set(...at);parent.add(n);return n}
function mesh(parent,g,m,at=[0,0,0],scale=[1,1,1]){const n=new T.Mesh(g,m);if(g.boundsTree)n.raycast=acceleratedRaycast;n.position.set(...at);n.scale.set(...scale);n.castShadow=true;n.receiveShadow=true;parent.add(n);return n}
function orb(parent,m,at,scale){const size=Math.max(...scale),segments=size<.05?[12,8]:size<.18?[20,14]:[32,22];return mesh(parent,geometry('sphere:'+segments,()=>new T.SphereGeometry(1,...segments)),m,at,scale)}
function box(parent,m,at,size,r=.07){return mesh(parent,geometry('rounded:'+size+':'+r,()=>new RoundedBoxGeometry(...size,5,r)),m,at)}
function tube(parent,m,points,r=.022){return mesh(parent,geometry('tube:'+points.flat()+':'+r,()=>new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),32,r,10,false)),m)}
function torus(parent,m,at,r,t=.018){return mesh(parent,geometry('torus:'+r+':'+t,()=>new T.TorusGeometry(r,t,12,48)),m,at)}
function tapered(parent,m,points,radii,radialSegments=14){
 const key='tapered:'+points.flat()+':'+radii+':'+radialSegments;
 const g=geometry(key,()=>{const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),segments=40,radial=radialSegments,frames=curve.computeFrenetFrames(segments,false),positions=[],indices=[];
  for(let i=0;i<=segments;i++){const t=i/segments,p=curve.getPoint(t),u=t*(radii.length-1),j=Math.min(radii.length-2,Math.floor(u)),r=T.MathUtils.lerp(radii[j],radii[j+1],u-j);for(let k=0;k<=radial;k++){const a=k/radial*Math.PI*2,offset=frames.normals[i].clone().multiplyScalar(Math.cos(a)*r).addScaledVector(frames.binormals[i],Math.sin(a)*r);positions.push(p.x+offset.x,p.y+offset.y,p.z+offset.z)}}
  for(let i=0;i<segments;i++)for(let k=0;k<radial;k++){const a=i*(radial+1)+k,b=a+radial+1;indices.push(a,b,a+1,b,b+1,a+1)}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return g;
 });return mesh(parent,g,m);
}
function remember(n){n.userData.rest={position:n.position.toArray(),rotation:[n.rotation.x,n.rotation.y,n.rotation.z],scale:n.scale.toArray()};return n}
function skin(face,colour){return mat(characterBodyColour(face,colour),face===1?.34:face===5?.22:face===6?.36:.46,face===1?.04:0,{sheen:face===1?0:.3,sheenColor:new T.Color(characterBodyColour(face,colour)).lerp(new T.Color('#ffffff'),.5),sheenRoughness:.45,clearcoat:face===5?.9:face===6?.45:.28,clearcoatRoughness:.3})}
const INK=()=>mat('#21172f',.28),CREAM=()=>mat('#fff0dc',.57),PINK=()=>mat('#ed9bac',.5),BROW=()=>mat('#714270',.5);
function cloudHull(){return geometry('smooth-cloud',()=>{
 const puffs=[[0,.68,0,.58,.49,.34],[-.38,.90,-.035,.31,.31,.31],[-.45,.57,-.015,.27,.27,.31],[0,1.12,-.035,.35,.35,.31],[.40,.82,-.025,.32,.32,.31]],k=.11;
 const field=(x,y,z)=>{let distance=10;for(const [cx,cy,cz,rx,ry,rz]of puffs){const d=(Math.hypot((x-cx)/rx,(y-cy)/ry,(z-cz)/rz)-1)*Math.min(rx,ry,rz),h=Math.max(0,Math.min(1,.5+.5*(d-distance)/k));distance=d*(1-h)+distance*h-k*h*(1-h)}return distance};
 const nx=37,ny=35,nz=25,min=[-.80,.12,-.43],step=[1.60/nx,1.42/ny,.86/nz],values=new Float32Array((nx+1)*(ny+1)*(nz+1)),at=(x,y,z)=>x+(nx+1)*(y+(ny+1)*z);
 for(let z=0;z<=nz;z++)for(let y=0;y<=ny;y++)for(let x=0;x<=nx;x++)values[at(x,y,z)]=field(min[0]+x*step[0],min[1]+y*step[1],min[2]+z*step[2]);
 const corners=[[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]],tetra=[[0,5,1,6],[0,1,2,6],[0,2,3,6],[0,3,7,6],[0,7,4,6],[0,4,5,6]],edges=[[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]],positions=[],normals=[];
 const gradient=p=>{const e=.001;return new T.Vector3(field(p.x+e,p.y,p.z)-field(p.x-e,p.y,p.z),field(p.x,p.y+e,p.z)-field(p.x,p.y-e,p.z),field(p.x,p.y,p.z+e)-field(p.x,p.y,p.z-e)).normalize()};
 for(let z=0;z<nz;z++)for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
  const v=corners.map(c=>values[at(x+c[0],y+c[1],z+c[2])]);if(v.every(n=>n>=0)||v.every(n=>n<0))continue;
  const points=corners.map(c=>new T.Vector3(min[0]+(x+c[0])*step[0],min[1]+(y+c[1])*step[1],min[2]+(z+c[2])*step[2]));
  for(const t of tetra){const polygon=[];for(const [a,b]of edges){const i=t[a],j=t[b];if((v[i]<0)===(v[j]<0))continue;polygon.push(points[i].clone().lerp(points[j],v[i]/(v[i]-v[j])))}if(polygon.length<3)continue;
   const centre=polygon.reduce((c,p)=>c.add(p),new T.Vector3()).multiplyScalar(1/polygon.length),normal=gradient(centre),axis=polygon[0].clone().sub(centre).normalize(),across=new T.Vector3().crossVectors(normal,axis);polygon.sort((a,b)=>Math.atan2(a.clone().sub(centre).dot(across),a.clone().sub(centre).dot(axis))-Math.atan2(b.clone().sub(centre).dot(across),b.clone().sub(centre).dot(axis)));
   for(let j=1;j<polygon.length-1;j++)for(const p of [polygon[0],polygon[j],polygon[j+1]]){positions.push(p.x,p.y,p.z);const n=gradient(p);normals.push(n.x,n.y,n.z)}
  }
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('normal',new T.Float32BufferAttribute(normals,3));return g;
})}
function puffyStar(){return geometry('star',()=>{const points=Array.from({length:10},(_,i)=>{const a=Math.PI/2+i*Math.PI/5,r=i%2?.43:.61;return new T.Vector3(Math.cos(a)*r,Math.sin(a)*r,0)}),curve=new T.CatmullRomCurve3(points,true,'catmullrom',.5),outline=curve.getPoints(100).slice(0,-1),positions=[],indices=[],rings=16,count=outline.length;
 for(const side of [1,-1])for(let ring=0;ring<=rings;ring++){const a=ring/rings*Math.PI/2;for(const p of outline)positions.push(p.x*Math.sin(a),p.y*Math.sin(a),side*.28*Math.cos(a))}for(let side=0;side<2;side++)for(let ring=0;ring<rings;ring++)for(let j=0;j<count;j++){const start=side*(rings+1)*count,a=start+ring*count+j,b=start+(ring+1)*count+j,c=start+(ring+1)*count+(j+1)%count,d=start+ring*count+(j+1)%count;if(side)indices.push(a,c,b,a,d,c);else indices.push(a,b,c,a,c,d)}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return g});}
function pillowStar(tips,valley=.33,depth=.3){return geometry('pillow-star:'+tips+':'+valley+':'+depth,()=>{const points=Array.from({length:10},(_,i)=>{const a=Math.PI/2+i*Math.PI/5,r=i%2?valley:tips[i/2];return new T.Vector3(Math.cos(a)*r,Math.sin(a)*r,0)}),outline=new T.CatmullRomCurve3(points,true,'centripetal').getPoints(160).slice(0,-1),positions=[],indices=[],rings=20,count=outline.length;
 for(const side of [1,-1])for(let ring=0;ring<=rings;ring++){const a=ring/rings*Math.PI/2,k=Math.pow(Math.sin(a),.8);for(const p of outline)positions.push(p.x*k,p.y*k,side*depth*Math.cos(a))}for(let side=0;side<2;side++)for(let ring=0;ring<rings;ring++)for(let j=0;j<count;j++){const start=side*(rings+1)*count,a=start+ring*count+j,b=start+(ring+1)*count+j,c=start+(ring+1)*count+(j+1)%count,d=start+ring*count+(j+1)%count;if(side)indices.push(a,c,b,a,d,c);else indices.push(a,b,c,a,c,d)}const g=mergeVertices(new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(positions,3)).setIndex(indices));g.computeVertexNormals();return g})}
// Batched vertex colours preserve the small face/hand details with one draw per joint.
function batchColours(parent,options={}){if(parent.userData.surfaceFace)return;const parts=parent.children.filter(n=>n.isMesh&&!n.geometry.attributes.color);if(parts.length<2)return;const bits=parts.map(n=>{n.updateMatrix();const g=(n.geometry.index?n.geometry.toNonIndexed():n.geometry.clone()).applyMatrix4(n.matrix);g.deleteAttribute('uv');const c=n.material.color,values=[];for(let i=0;i<g.attributes.position.count;i++)values.push(c.r,c.g,c.b);g.setAttribute('color',new T.Float32BufferAttribute(values,3));return g}),merged=mergeGeometries(bits);bits.forEach(n=>n.dispose());merged.userData.owned=true;parts.forEach(n=>parent.remove(n));mesh(parent,merged,mat('#ffffff',.32,.02,{vertexColors:true,...options}));}
function bakeRigid(parent){for(const child of [...parent.children])if(!child.isMesh)bakeRigid(child);const buckets=new Map();for(const child of [...parent.children])if(child.isMesh&&!child.userData.surfaceFace&&!child.geometry.userData.sculpt){child.updateMatrix();const list=buckets.get(child.material)||[];list.push(child);buckets.set(child.material,list)}for(const [m,parts]of buckets){if(parts.length<2)continue;const bits=parts.map(n=>{const g=(n.geometry.index?n.geometry.toNonIndexed():n.geometry.clone()).applyMatrix4(n.matrix);g.deleteAttribute('uv');return g}),merged=mergeGeometries(bits);bits.forEach(n=>n.dispose());merged.userData.owned=true;parts.forEach(n=>parent.remove(n));mesh(parent,merged,m)}}
export function disposePerson(root){const buffers=new Set(),ownedMats=new Set();root.traverse(n=>{if(n.isMesh&&n.geometry.userData.owned)buffers.add(n.geometry);if(n.isMesh&&n.material.userData.instanceOwned)ownedMats.add(n.material)});buffers.forEach(g=>g.dispose());ownedMats.forEach(m=>m.dispose())}

// Studio toys v2: real shoulder/elbow/wrist and hip/knee joints. Silhouettes,
// expressions and attachment mounts belong to this shared model, never to the UI.
export const CHARACTER_MODEL_VERSION='vinyl-v1';
function capsule(parent,m,from,to,r){const a=new T.Vector3(...from),b=new T.Vector3(...to),len=a.distanceTo(b),n=mesh(parent,geometry('capsule:'+r.toFixed(3)+':'+len.toFixed(3),()=>new T.CapsuleGeometry(r,len,10,24)),m,a.clone().add(b).multiplyScalar(.5).toArray());n.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),b.clone().sub(a).normalize());return n}
function limb(parent,body,side,at,{robot=false,paw=false,short=false,joint:jointMat=null}={}){
 const shoulder=group(parent,side<0?'ArmL':'ArmR',at),length=short?.125:.175,elbow0=()=>shoulder.getObjectByName('Elbow')||group(shoulder,'Elbow',[0,-length,0]);
 const joint=jointMat||(robot?mat('#655478',.32,.35):body);
 if(robot){orb(shoulder,joint,[0,-.018,0],[.095,.096,.095]);orb(elbow0(),joint,[0,0,0],[.078,.079,.078])}
 capsule(shoulder,body,[0,-.01,.004],[0,-length,.008],.086);
 const elbow=shoulder.getObjectByName('Elbow')||group(shoulder,'Elbow',[0,-length,0]);
 if(!robot)orb(elbow,body,[0,0,.008],[.083,.083,.083]);
 capsule(elbow,body,[0,0,.008],[0,-length*.78,.022],.079);
 const wrist=group(elbow,'Wrist',[0,-length*.85,.025]),mitten=paw?CREAM():body;
 orb(wrist,mitten,[0,-.024,.02],[.112,.106,.095]);
 orb(wrist,mitten,[side*.086,.012,.035],[.043,.059,.049]);
 for(let k=0;k<2;k++)tube(wrist,mat(robot?'#584369':paw?'#c8ad9e':'#795572',.65),[[(k-.5)*.052,-.055,.104],[(k-.5)*.05,-.072,.097]],.003);
 shoulder.userData.grip=[0,-length*1.85-.024,.045];
 shoulder.userData.elbow=elbow;shoulder.userData.wrist=wrist;
 return shoulder;
}
function legsV2(root,body,pose,{robot=false,short=false,paw=false,boot=null}={}){
 return [-1,1].map(side=>{
  const hip=group(root,side<0?'LegL':'LegR',[side*.195,.09,0]),length=short?.11:.19;
  capsule(hip,body,[0,-.01,0],[0,-length,.004],.118);
  const knee=group(hip,'Knee',[0,-length,0]);
  capsule(knee,body,[0,0,.004],[0,-length*.9,.012],.104);
  orb(knee,paw?CREAM():body,[0,-length*.94,.075],[.151,.108,.192]);
  if(robot){orb(knee,boot||mat('#4e3e63',.36,.18),[0,-length*1.12,.07],[.165,.085,.205]);orb(knee,mat('#c9b6ef',.3,.35),[side*.10,0,0],[.025,.047,.05])}
  if(pose==='seated'){hip.rotation.x=-Math.PI/2;knee.rotation.x=Math.PI/2}
  return hip;
 });
}
function eyesV2(head,at,size,iris,robot=false){
 const n=group(head,'Eye',at);n.scale.setScalar(size);n.userData.eyeScale=size;
 if(robot){
  const light=mat('#3fe3ff',.2,0,{emissive:'#00aef5',emissiveIntensity:.75});
  orb(n,mat('#0f3f63',.3,0,{emissive:'#0b6fb0',emissiveIntensity:.45}),[0,0,.0],[.125,.155,.02]);
  orb(n,light,[0,0,.012],[.098,.128,.02]);
  orb(n,mat('#ffffff',.2,0,{emissive:'#ffffff',emissiveIntensity:.6}),[-.03,.05,.03],[.026,.03,.006]);
 }else{
  orb(n,mat('#fffaf4',.26),[0,0,0],[.155,.183,.08]);
  const lash=[];for(let i=0;i<=14;i++){const a=Math.PI*(.2+.6*i/14);lash.push([Math.cos(a)*.158,Math.sin(a)*.186-.004,.026+.012*Math.sin(a)])}
  tube(n,mat('#2a1838',.4),lash,.0135);
  const pupil=group(n,'Pupil',[0,0,.075]),deep=new T.Color(iris).multiplyScalar(.55),glow=new T.Color(iris).lerp(new T.Color('#ffffff'),.22);
  orb(pupil,mat('#'+deep.getHexString(),.3),[0,-.004,-.004],[.137,.166,.034]);
  orb(pupil,mat(iris,.3),[0,-.012,.004],[.124,.150,.032]);
  orb(pupil,mat('#'+glow.getHexString(),.3),[0,-.085,.012],[.07,.04,.02]);
  orb(pupil,mat('#170f26',.25),[.004,-.006,.024],[.074,.094,.02]);
  orb(pupil,mat('#ffffff',.15),[-.036,.05,.047],[.044,.05,.009]);
  orb(pupil,mat('#ffffff',.15),[.046,-.052,.044],[.017,.019,.005]);
  orb(pupil,mat('#fff6fa',.2),[.012,.078,.04],[.012,.012,.004]);
  batchColours(pupil,{roughness:.32});
 }
 const lid=group(head,'ClosedEye',at);lid.scale.setScalar(size);
 tube(lid,robot?mat('#9dfcff',.28,0,{emissive:'#36d8ff',emissiveIntensity:.8}):mat('#2a1838',.4),[[-.128,.016,.10],[-.065,-.02,.115],[0,-.03,.12],[.065,-.02,.115],[.128,.016,.10]],.018);lid.visible=false;
 return {eye:n,lid};
}

const sculptMaterials=new Map();
function sculptMaterial(face,name='skin',extra={}){const key=face+':'+name;if(!sculptMaterials.has(key)){const m=new T.MeshPhysicalMaterial({vertexColors:true,roughness:.5,metalness:0,sheen:.25,sheenRoughness:.6,sheenColor:new T.Color('#fff4fa'),clearcoat:.1,clearcoatRoughness:.4,...extra});sculptMaterials.set(key,m)}return sculptMaterials.get(key)}
// Glossy bead eyes (Robot: a glowing display) with a soft "^" lid for blinks and smiles.
function sculptEye(head,[at,normal],spec,face){
 const s=spec.size||[.06,.075,.034],n=group(head,'Eye',at),look=new T.Vector3(...at).add(new T.Vector3(...normal));n.lookAt(look);n.userData.eyeScale=1;
 const lid=group(head,'ClosedEye',at);lid.quaternion.copy(n.quaternion);lid.visible=false;
 const pupil=group(n,'Pupil',[0,0,0]);
 if(spec.style==='led'){
  mesh(pupil,geometry('led-eye',()=>new T.CapsuleGeometry(.75,.7,8,24)),mat('#86f4ff',.25,0,{emissive:'#26d0ff',emissiveIntensity:1.25}),[0,0,.004],[s[0],s[1],s[2]*.35]);
  tube(lid,mat('#86f4ff',.25,0,{emissive:'#26d0ff',emissiveIntensity:1.25}),[[-s[0]*1.1,-s[1]*.2,.01],[0,s[1]*.35,.01],[s[0]*1.1,-s[1]*.2,.01]],.012);
 }else{
  orb(pupil,mat('#21162d',.12,0,{clearcoat:1,clearcoatRoughness:.04}),[0,0,-s[2]*.35],s);
  if(spec.iris)orb(pupil,mat(spec.iris,.2,0,{clearcoat:1,clearcoatRoughness:.05}),[0,-s[1]*.5,s[2]*.42],[s[0]*.72,s[1]*.42,s[2]*.3]);
  const glint=mat('#ffffff',.3,0,{emissive:'#ffffff',emissiveIntensity:.35});
  orb(pupil,glint,[-s[0]*.32,s[1]*.36,s[2]*.6],[s[0]*.34,s[1]*.3,.008]);
  orb(pupil,glint,[s[0]*.36,-s[1]*.3,s[2]*.58],[s[0]*.15,s[1]*.13,.006]);
  tube(lid,mat('#2a1838',.4),[[-s[0]*1.05,-s[1]*.15,.004],[-s[0]*.5,s[1]*.22,.008],[0,s[1]*.32,.01],[s[0]*.5,s[1]*.22,.008],[s[0]*1.05,-s[1]*.15,.004]],.013);
 }
 return {eye:n,lid};
}
function pivotHead(head,y){for(const n of head.children)n.position.y-=y;head.position.y=y}

export function createCharacter(face=0,colour=0,pose='seated',accessory='none',accessoryColours={}){
 face=Number.isInteger(face)&&face>=0&&face<7?face:0;colour=Number.isInteger(colour)&&colour>=0&&colour<8?colour:0;
 const root=new T.Group();root.name=['Pof','Robot','Cat','Cyclops','Dragon','Jelly','Star'][face];root.userData.face=face;root.userData.modelVersion=CHARACTER_MODEL_VERSION;
 const body=skin(face,colour),head=group(root,'Head'),torso=group(root,'Torso'),eyes=[],lids=[],arms=[],eyebrows=[];
 let feet=[],mouth,tail=null,accent=null,ears=[];
 const addEye=(at,size=1,iris='#8054bb',robot=false)=>{const e=eyesV2(head,at,size,iris,robot);eyes.push(e.eye);lids.push(e.lid)};
 const cheek=(x,y,z,r=.06)=>orb(head,mat('#ff8fa6',.7,0,{transparent:true,opacity:.82}),[x,y,z],[r*1.15,r*.58,.016]);
 const armPair=(x,y,z,options={})=>{for(const side of [-1,1])arms.push(limb(root,body,side,[side*x,y,z],options))};
 let headPivot=.84;
 // Vinyl-toy sculpts (design/sculpt): one seamless painted mesh per rigid part.
 {const spec=sculptSpec(face),bodyHex=characterBodyColour(face,colour);
  spec.parts.forEach((part,i)=>{
   const g=sculptGeometry(face,i,bodyHex),m=sculptMaterial(face,part.material,spec.materials?.[part.material]);
   const side=part.group.endsWith('L')?-1:1;
   if(part.group==='head')mesh(head,g,m);
   else if(part.group==='torso')mesh(torso,g,m);
   else if(part.group==='armL'||part.group==='armR'){
    const shoulder=group(root,side<0?'ArmL':'ArmR',part.pivot);mesh(shoulder,g,m);
    const tip=[(part.min[0]+part.max[0])/2,part.min[1]+.075,(part.min[2]+part.max[2])/2];
    const elbow=group(shoulder,'Elbow',[tip[0]*.5,tip[1]*.5,tip[2]*.5]),wrist=group(elbow,'Wrist',[tip[0]*.5,tip[1]*.5,tip[2]*.5]);
    Object.assign(shoulder.userData,{elbow,wrist,grip:[tip[0],tip[1]-.02,tip[2]+.03]});arms.push(shoulder);
   }else if(part.group==='legL'||part.group==='legR'){
    const hip=group(root,side<0?'LegL':'LegR',part.pivot);mesh(hip,g,m);group(hip,'Knee',[0,-.11,0]);
    if(pose==='seated')hip.rotation.x=-Math.PI/2;feet.push(hip);
   }else if(part.group==='tail'){tail=tail||group(torso,'Tail',part.pivot);mesh(tail,g,m)}
   else{accent=accent||group(head,'Accent',part.pivot);mesh(accent,g,m)}
  });
  for(const k of ['eyeL','eyeR','eye'])if(spec.anchors[k]){const e=sculptEye(head,spec.anchors[k],spec.eyes,face);eyes.push(e.eye);lids.push(e.lid)}
  headPivot=spec.pivots.head;
  if(feet.length){const rise=feet[0].position.y-.09;root.userData.seatOffset=-rise}
 }
 const rear=REAR_PROFILES[face],hips=group(rear.parent==='head'?head:torso,'Hips',rear.at);hips.userData.anatomy=rear.name;
 // Broad overlapping lobes stay embedded in the torso; no hanging spheres.
 for(const side of [-1,1]){const [w,h,d]=rear.size;orb(hips,face===1?mat('#f6f3fb',.3):body,[side*w*.28,0,0],[w*.72,h*.78,d])}
 hips.userData.lobes=2;
 const facial=createFacialRig(head,face);mouth=facial.mouth;eyebrows.push(...facial.brows);
 pivotHead(head,headPivot);
 const forearms=arms.map(a=>a.userData.elbow).filter(Boolean),hands=arms.map(a=>a.userData.wrist).filter(Boolean),knees=feet.map(a=>a.getObjectByName('Knee')).filter(Boolean);
 root.userData.rig={face,pose,facial,rear,head,body:torso,eyes,pupils:eyes.flatMap(e=>e.children.filter(n=>n.name==='Pupil')),lids,arms,forearms,hands,legs:feet,knees,brows:eyebrows,mouth,tail,accent,ears,hips};
 root.userData.pose=pose;
 for(const eye of eyes)for(const pupil of eye.children.filter(n=>n.name==='Pupil'))pupil.scale.setScalar(1.08);
 for(const id of accessoryList(accessory))addAccessory(root,id,accessoryColours);
 // Preserve articulation; merge colour details only within each rigid joint.
 for(const parent of [torso,hips,...arms,...forearms,...hands,...feet,...knees,...eyes,...eyebrows])batchColours(parent,{roughness:face===1?.34:.48,metalness:face===1?.08:0});
 bakeRigid(root);root.updateMatrixWorld(true);return root;
}
export const createSeatedCharacter=(face,colour,accessory='none',colours={})=>createCharacter(face,colour,'seated',accessory,colours);

export function characterContactPoint(root,camera){
 const rig=root.userData.rig,node=rig.hands?.[1]||rig.forearms?.[1]||rig.arms[1];
 return node.getWorldPosition(new T.Vector3()).project(camera);
}

const WARDROBE_DEFAULTS={cap:'#7b5cd6',beanie:'#ff8fb1',crown:'#5fd6e0',astralCrown:'#3b2d6b',partyHat:'#ff6fa3',flowerCrown:'#ff9fc6',bunnyEars:'#ffffff',halo:'#ffe58a',
 bow:'#7b5cd6',silkBow:'#c393df',royalBow:'#6c37ad',medal:'#e0475f',scarf:'#ff7a6b',bellCollar:'#e0475f',glasses:'#59456e',shades:'#342b50',stargaze:'#e4bc66',heartShades:'#ff5f8f',monocle:'#e4bc66'};
const wardrobeMaterials=new Map();
function wardrobeMaterial(id){if(!wardrobeMaterials.has(id))wardrobeMaterials.set(id,new T.MeshPhysicalMaterial({vertexColors:true,roughness:['crown','astralCrown','medal'].includes(id)?.3:.55,metalness:['crown','astralCrown','medal'].includes(id)?.25:0,sheen:.35,sheenRoughness:.55,sheenColor:new T.Color('#fff6fb'),clearcoat:.2,clearcoatRoughness:.35,...(id==='halo'?{emissive:new T.Color('#ffd65c'),emissiveIntensity:.7}:{})}));return wardrobeMaterials.get(id)}
// Sculpted vinyl wardrobe (design/sculpt/accessories.py) scaled to each character's measured head and neck.
function addAccessory(root,id,colours={}){
 const rig=root.userData.rig,head=rig.head,item=accessoryById(id),slot=item?.slot;if(!slot)return;
 const fits=sculptSpec(rig.face).fits,tint=accessoryColour(colours,slot,WARDROBE_DEFAULTS[id]||'#7b5cd6');
 const fitParent=accessoryFit(rig.face,id,slot).parent,parent=fitParent==='body'?rig.body:head,mount=group(parent,'Accessory-'+id),lift=parent===head?head.position.y:0;
 mount.userData.attachment=id;mount.userData.slot=slot;mount.userData.fit={parent:fitParent};
 if(slot==='face'){buildEyewear(rig,mount,id,tint);batchColours(mount,{roughness:.35,metalness:['stargaze','monocle'].includes(id)?.5:.05});const piece=mount.children.find(n=>n.isMesh);if(piece){const source=piece.geometry;piece.geometry=geometry('eyewear:'+rig.face+':'+id+':'+tint,()=>{const g=source.clone();g.userData.owned=false;return g});source.dispose()}}
 else{
  const spec=wardrobeSpec(id);mesh(mount,wardrobeGeometry(id,tint),wardrobeMaterial(id));
  if(slot==='head'){
   if(rig.accent)rig.accent.visible=false;
   const h=fits.hat;mount.position.set(h.at[0],h.at[1]-head.position.y,h.at[2]);mount.scale.set(...h.size);
  }else{
   const n=fits.neck;
   if(spec.kind==='wrap'){mount.position.set(0,n.y-lift,n.cz);mount.scale.set(n.rx*1.08,n.rx*1.08,n.rz*1.1)}
   else{const k=Math.max(.8,Math.min(1.5,n.rx/.2));mount.position.set(0,(n.fy??n.y)-.01-lift,n.front+.012);mount.scale.setScalar(k)}
  }
 }
 clearAccessorySurface(root,mount,id);
 const baked=BAKED_ACCESSORY_FITS[rig.face+':'+id];if(baked)mount.position.fromArray(baked.at);
}
// Eyewear follows the eyes: rims, tinted lenses and a bridge; no temples to clip through soft heads.
function buildEyewear(rig,mount,id,tint){
 const spec=sculptSpec(rig.face),size=spec.eyes.size||[.06,.075,.034],rim=mat(tint,id==='stargaze'||id==='monocle'?.25:.4,id==='stargaze'||id==='monocle'?.55:.05),
  lensMat=mat(id==='shades'?'#2b2440':id==='heartShades'?'#ff8fb3':'#bdeff2',.1,.05,{transparent:true,opacity:id==='shades'?.82:id==='heartShades'?.55:.18,side:T.DoubleSide});
 const eyes=id==='monocle'?rig.eyes.slice(-1):rig.eyes,r=Math.max(size[0],size[1])*1.55,front=Math.max(size[2],.02)*.9+.03;
 const outline=(kind,cx,cy)=>{const pts=[];if(kind==='heart'){for(let i=0;i<=48;i++){const t=i/48*Math.PI*2,x=16*Math.sin(t)**3,y=13*Math.cos(t)-5*Math.cos(2*t)-2*Math.cos(3*t)-Math.cos(4*t);pts.push([cx+x/17*r,cy+y/17*r+r*.1])}}
  else if(kind==='star'){for(let i=0;i<=10;i++){const a=Math.PI/2+i*Math.PI/5,q=i%2?r*.55:r*1.08;pts.push([cx+Math.cos(a)*q,cy+Math.sin(a)*q])}}
  else if(kind==='rect'){for(let i=0;i<=40;i++){const a=i/40*Math.PI*2,c=Math.cos(a),s=Math.sin(a);pts.push([cx+Math.sign(c)*Math.abs(c)**.45*r*1.05,cy+Math.sign(s)*Math.abs(s)**.45*r*.78])}}
  else for(let i=0;i<=40;i++){const a=i/40*Math.PI*2;pts.push([cx+Math.cos(a)*r,cy+Math.sin(a)*r])}return pts};
 const kind=id==='heartShades'?'heart':id==='stargaze'?'star':id==='shades'?'rect':'round';
 const centres=[],lenses=group(mount,'OpticalLenses');
 for(const eye of eyes){
  const p=eye.position,z=p.z+front;centres.push([p.x,p.y,z]);
  const pts=outline(kind,p.x,p.y);tube(mount,rim,pts.map(([x,y])=>[x,y,z]),id==='glasses'||id==='monocle'?.011:.014);
  for(const sd of [-1,1])orb(mount,rim,[p.x+sd*r*(kind==='rect'?1.05:kind==='star'?.95:1),p.y+(kind==='heart'?r*.25:0),z+.006],[.014,.014,.012]);
  const shape=new T.Shape(pts.map(([x,y])=>new T.Vector2(x-p.x,y-p.y)));const lens=mesh(lenses,geometry('lens:'+kind+':'+r.toFixed(3),()=>new T.ShapeGeometry(shape,24)),lensMat,[p.x,p.y,z-.004]);lens.renderOrder=2;
 }
 if(centres.length===2){const [l,q]=centres,y=(l[1]+q[1])/2+r*.35;tube(mount,rim,[[l[0]+r*.92,y,l[2]],[0,y+r*.12,l[2]+.012],[q[0]-r*.92,y,q[2]]],.01)}
 if(id==='monocle'){const [x,y,z]=centres[0];tube(mount,mat('#e4bc66',.25,.55),[[x+r*.7,y-r*.7,z],[x+r*1.1,y-r*2.2,z-.02],[x+r*.9,y-r*3.6,z-.05]],.006);orb(mount,mat('#e4bc66',.25,.55),[x-r*.95,y+r*.2,z],[.012,.012,.012])}
 if(id==='stargaze')for(const [x,y,z] of centres)orb(mount,mat('#bff3ff',.15,.1,{emissive:'#7fe8ff',emissiveIntensity:.5}),[x+(x<0?-1:1)*r*.9,y+r*.85,z+.01],[.02,.02,.02]);
}

const headContacts=new Map();
function anatomySurfaces(root){const rig=root.userData.rig,skin=[];for(const parent of [rig.head,rig.body])parent.traverse(n=>{if(!n.isMesh||n.userData.surfaceFace||hasAccessoryParent(n))return;for(let p=n;p;p=p.parent)if(p===rig.accent||!p.visible)return;skin.push(n)});return skin}
function headwearContact(root,id,fit){
 const key=root.userData.face+':'+id;if(headContacts.has(key))return headContacts.get(key);root.updateMatrixWorld(true);const skin=anatomySurfaces(root),ray=new T.Raycaster(),[rx,,rz]=fit.size,[cx,,cz]=fit.at;
 const top=(x,z)=>{ray.set(new T.Vector3(x,3,z),new T.Vector3(0,-1,0));return ray.intersectObjects(skin,false)[0]?.point.y};
 let base=top(cx,cz)||fit.at[1];for(let x=-4;x<=4;x++)for(let z=-4;z<=4;z++){if(x*x+z*z>16)continue;const y=top(cx+x/4*rx,cz+z/4*rz);if(y)base=Math.max(base,y)}base+=root.userData.face===6?-.03:.013;
 const ring=[];for(let i=0;i<=48;i++){const a=i/48*Math.PI*2,x=Math.cos(a)*rx,z=Math.sin(a)*rz,y=top(cx+x,cz+z);ring.push([x,(y??base-.04)-base+.016,z])}
 const result={base,ring};headContacts.set(key,result);return result;
}
function headwearCuff(contact,rx,rz){
 const positions=[],indices=[],rings=5,count=contact.ring.length;
 for(let row=0;row<=rings;row++)for(const [x,bottom,z]of contact.ring){const t=row/rings,bulge=1+.025*Math.sin(Math.PI*t);positions.push(x*bulge,bottom*(1-t)+.026*t,z*bulge)}
 for(let row=0;row<rings;row++)for(let i=0;i<count-1;i++){const a=row*count+i,b=a+count;indices.push(a,b,a+1,b,b+1,a+1)}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
function jellyRearSurface(head,at){
 return geometry('jelly-bell-folds-v9',()=>{head.updateWorldMatrix(true,true);const surfaces=head.children.filter(n=>n.isMesh&&!n.userData.surfaceFace),ray=new T.Raycaster(),positions=[],indices=[],radial=48,rings=10;
  for(let j=0;j<=rings;j++)for(let i=0;i<=radial;i++){const r=j/rings,a=i/radial*Math.PI*2,x=Math.cos(a)*.235*r,y=at[1]+Math.sin(a)*.092*r;ray.set(new T.Vector3(x,y,-3),new T.Vector3(0,0,1));const hit=ray.intersectObjects(surfaces,false)[0],edge=(1-r*r)**2,left=Math.exp(-(((x+.105)/.105)**2+((y-at[1])/.07)**2)),right=Math.exp(-(((x-.105)/.105)**2+((y-at[1])/.07)**2)),z=(hit?.point.z??-.29)-.003-edge*(.018*(left+right));positions.push(x-at[0],y-at[1],z-at[2])}
  for(let j=0;j<rings;j++)for(let i=0;i<radial;i++){const a=j*(radial+1)+i,b=a+radial+1;indices.push(a,a+1,b,b,a+1,b+1)}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return g;
 });
}

function hasAccessoryParent(node){for(let n=node;n;n=n.parent)if(n.userData.attachment)return true;return false}

function frontContact(root,x,y){root.updateMatrixWorld(true);const rig=root.userData.rig,ray=new T.Raycaster(new T.Vector3(x,y,3),new T.Vector3(0,0,-1));const hit=ray.intersectObjects([rig.head,rig.body],true).find(h=>!h.object.userData.surfaceFace&&!hasAccessoryParent(h.object));if(!hit)throw Error('Accessory contact missing for '+rig.face);return rig.head.worldToLocal(hit.point.clone())}
function sideContact(root,side,y,z,fallback){const key=[root.userData.face,side,y,z].join(':');if(contactPoints.has(key))return [...contactPoints.get(key)];root.updateMatrixWorld(true);const head=root.userData.rig.head,ray=new T.Raycaster(new T.Vector3(side*3,y,z),new T.Vector3(-side,0,0)),hit=ray.intersectObject(head,true).find(h=>!h.object.userData.surfaceFace&&!hasAccessoryParent(h.object));const p=hit?head.worldToLocal(hit.point.clone()):new T.Vector3(side*fallback,y-head.position.y,z);p.x+=side*.016;const result=p.toArray();contactPoints.set(key,result);return [...result]}

// Fit the entire piece, not just its centre: curved skin can protrude through
// a wing, bridge or hat rim even when the attachment anchor itself is clear.
function clearAccessorySurface(root,mount,id){
 const rig=root.userData.rig;if(BAKED_ACCESSORY_FITS[rig.face+':'+id])return;
 root.updateMatrixWorld(true);const skin=anatomySurfaces(root),up=mount.userData.slot==='head',ray=new T.Raycaster(),point=new T.Vector3(),wrapMid=wardrobeSpec(id)?.kind==='wrap'?new T.Vector3().setFromMatrixPosition(mount.matrixWorld).z+.02:null;let correction=0;
 const sample=p=>{
  if(wrapMid!==null&&p.z<wrapMid)return;
  if(!up&&mount.userData.slot==='face'&&Math.abs(p.x)>.36&&p.z<.35)return;
  ray.set(up?new T.Vector3(p.x,3,p.z):new T.Vector3(p.x,p.y,3),new T.Vector3(0,up?-1:0,up?0:-1));
  const hit=ray.intersectObjects(skin,false)[0];if(hit)correction=Math.max(correction,(up?hit.point.y-p.y:hit.point.z-p.z)+.009);
 };
 mount.traverse(n=>{if(!n.isMesh)return;const pos=n.geometry.attributes.position,index=n.geometry.index;
  for(let i=0;i<pos.count;i++){point.fromBufferAttribute(pos,i).applyMatrix4(n.matrixWorld);sample(point)}
  const count=index?.count??pos.count,a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3();
  for(let i=0;i<count;i+=3){a.fromBufferAttribute(pos,index?index.getX(i):i);b.fromBufferAttribute(pos,index?index.getX(i+1):i+1);c.fromBufferAttribute(pos,index?index.getX(i+2):i+2);point.copy(a).add(b).add(c).multiplyScalar(1/3).applyMatrix4(n.matrixWorld);sample(point)}
 });
 if(correction>0){const world=mount.getWorldPosition(new T.Vector3());world[up?'y':'z']+=correction;mount.position.copy(mount.parent.worldToLocal(world));root.updateMatrixWorld(true)}
 mount.userData.clearanceShift=correction;
}
