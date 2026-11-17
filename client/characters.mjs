import {acceleratedRaycast} from 'three-mesh-bvh';
import {sculptHead} from './creature-sculpt.mjs';
import {BAKED_ACCESSORY_FITS} from './accessory-surfaces.mjs';
import {accessoryFit,REAR_PROFILES} from './character-fit.mjs';
import {createFacialRig} from './facial-rig.mjs';
import {characterBodyColour,accessoryList,accessoryColour} from '../public/character-style.mjs';
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
function batchColours(parent,options={}){if(parent.userData.surfaceFace)return;const parts=parent.children.filter(n=>n.isMesh);if(parts.length<2)return;const bits=parts.map(n=>{n.updateMatrix();const g=(n.geometry.index?n.geometry.toNonIndexed():n.geometry.clone()).applyMatrix4(n.matrix);g.deleteAttribute('uv');const c=n.material.color,values=[];for(let i=0;i<g.attributes.position.count;i++)values.push(c.r,c.g,c.b);g.setAttribute('color',new T.Float32BufferAttribute(values,3));return g}),merged=mergeGeometries(bits);bits.forEach(n=>n.dispose());merged.userData.owned=true;parts.forEach(n=>parent.remove(n));mesh(parent,merged,mat('#ffffff',.32,.02,{vertexColors:true,...options}));}
function bakeRigid(parent){for(const child of [...parent.children])if(!child.isMesh)bakeRigid(child);const buckets=new Map();for(const child of [...parent.children])if(child.isMesh&&!child.userData.surfaceFace){child.updateMatrix();const list=buckets.get(child.material)||[];list.push(child);buckets.set(child.material,list)}for(const [m,parts]of buckets){if(parts.length<2)continue;const bits=parts.map(n=>{const g=(n.geometry.index?n.geometry.toNonIndexed():n.geometry.clone()).applyMatrix4(n.matrix);g.deleteAttribute('uv');return g}),merged=mergeGeometries(bits);bits.forEach(n=>n.dispose());merged.userData.owned=true;parts.forEach(n=>parent.remove(n));mesh(parent,merged,m)}}
export function disposePerson(root){const buffers=new Set(),ownedMats=new Set();root.traverse(n=>{if(n.isMesh&&n.geometry.userData.owned)buffers.add(n.geometry);if(n.isMesh&&n.material.userData.instanceOwned)ownedMats.add(n.material)});buffers.forEach(g=>g.dispose());ownedMats.forEach(m=>m.dispose())}

// Studio toys v2: real shoulder/elbow/wrist and hip/knee joints. Silhouettes,
// expressions and attachment mounts belong to this shared model, never to the UI.
export const CHARACTER_MODEL_VERSION='wardrobe-v9';
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
 if(face===0){
  // A continuous soft cloud, not intersecting cropped puff pictures.
  mesh(head,geometry('sculpt-pof-v8',()=>sculptHead(0)),body);orb(torso,body,[0,.33,-.03],[.34,.36,.25]);orb(torso,CREAM(),[0,.29,.20],[.21,.24,.055]);
  addEye([-.2,.745,.35],1.16,'#7b45d6');addEye([.2,.745,.35],1.16,'#7b45d6');

  cheek(-.34,.57,.325);cheek(.34,.57,.325);
  accent=group(head,'CloudCurl',[0,1.20,-.025]);for(const side of [-1,1])orb(accent,body,[side*.065,.025,.16],[.06,.10,.04]);
  armPair(.45,.49,.025,{short:true});feet=legsV2(root,body,pose,{short:true,paw:true});
  headPivot=.70;
 }else if(face===1){
  // Pearl ceramic shell, glossy black visor and glowing display eyes; the tint drives the trim.
  const ceramic=mat('#f4f1fb',.24,.05,{clearcoat:.8,clearcoatRoughness:.18}),visor=mat('#0d0b1c',.12,.25,{clearcoat:1,clearcoatRoughness:.06}),glow=mat('#9ff7ff',.2,0,{emissive:'#33d3ff',emissiveIntensity:1.1}),brass=mat('#b8875a',.3,.6);
  box(torso,ceramic,[0,.30,0],[.58,.56,.44],.2);
  box(torso,body,[0,.31,.21],[.36,.30,.06],.1);
  const heart=new T.Shape();heart.moveTo(0,-.06);heart.bezierCurveTo(-.12,.01,-.06,.12,0,.055);heart.bezierCurveTo(.06,.12,.12,.01,0,-.06);mesh(torso,geometry('robot-heart',()=>new T.ExtrudeGeometry(heart,{depth:.009,bevelEnabled:true,bevelSize:.006,bevelThickness:.004,bevelSegments:3,steps:1})),glow,[0,.31,.245]);
  orb(torso,body,[0,.60,0],[.15,.07,.15]);
  orb(head,ceramic,[0,1.03,-.02],[.56,.49,.47]);
  orb(head,visor,[0,1.02,.16],[.47,.37,.335]);
  for(const side of [-1,1]){orb(head,body,[side*.535,1.03,-.01],[.075,.17,.17]);orb(head,ceramic,[side*.6,1.03,-.01],[.03,.11,.11]);orb(head,glow,[side*.625,1.03,-.01],[.012,.05,.05])}
  addEye([-.17,1.06,.47],.92,'#9ff7ff',true);addEye([.17,1.06,.47],.92,'#9ff7ff',true);
  accent=group(head,'Antenna',[0,1.48,-.04]);tube(accent,brass,[[0,0,0],[0,.07,0],[.03,.14,0]],.016);orb(accent,mat('#ffb36b',.25,0,{emissive:'#ff7a3a',emissiveIntensity:.6}),[.03,.155,0],[.045,.045,.045]);
  for(const side of [-1,1])arms.push(limb(root,ceramic,side,[side*.34,.52,.015],{robot:true,joint:body}));
  feet=legsV2(root,ceramic,pose,{robot:true,boot:body});
  headPivot=1.0;
 }else if(face===2){
  orb(torso,body,[0,.32,0],[.35,.43,.275]);orb(torso,CREAM(),[0,.275,.24],[.20,.27,.055]);
  mesh(head,geometry('sculpt-cat-v8',()=>sculptHead(2)),body);
  for(const side of [-1,1]){
   const ear=group(head,side<0?'EarL':'EarR',[side*.29,1.19,-.035]);
   const shape=new T.Shape();shape.moveTo(-.17,-.13);shape.quadraticCurveTo(-.18,.17,-.035,.36);shape.quadraticCurveTo(.05,.4,.18,-.13);shape.closePath();
   const g=geometry('connected-cat-ear-v9',()=>new T.ExtrudeGeometry(shape,{depth:.10,bevelEnabled:true,bevelSize:.035,bevelThickness:.03,bevelSegments:4,curveSegments:16}));
   mesh(ear,g,body,[0,0,-.06]);mesh(ear,g,mat('#f1b4b1',.63),[0,.045,.071],[.60,.72,.12]);ear.rotation.z=-side*.13;ears.push(ear);
   orb(head,CREAM(),[side*.135,.837,.30],[.17,.11,.07]);
   for(let i=0;i<2;i++)tube(head,mat('#b9704b',.6),[[side*.32,.85-i*.05,.30],[side*.54,.87-i*.07,.25]],.004);
  }
  addEye([-.19,1.05,.312],1.06,'#6a52d8');addEye([.19,1.05,.312],1.06,'#6a52d8');

  orb(head,mat('#b66c76',.5),[0,.89,.389],[.044,.032,.024]);
  for(const x of [-.12,0,.12]){const s=orb(head,mat('#b9704b',.6),[x,1.34,.20],[.026,.075,.02]);s.rotation.z=x*-.8}
  tail=group(root,'Tail',[0,.08,-.18]);tapered(tail,body,[[0,0,0],[.36,-.07,-.10],[.50,.13,-.12],[.46,.37,-.09],[.32,.39,-.02]],[.085,.095,.09,.10,.055]);orb(tail,CREAM(),[.32,.39,-.02],[.10,.10,.085]);
  armPair(.33,.52,.015,{paw:true});feet=legsV2(root,body,pose,{paw:true});
  headPivot=.96;
 }else if(face===3){
  orb(torso,body,[0,.35,0],[.43,.47,.32]);orb(torso,mat('#b9e8cd',.6),[0,.265,.285],[.26,.30,.055]);
  mesh(head,geometry('sculpt-cyclops-v8',()=>sculptHead(3)),body);
  for(const side of [-1,1]){
   tapered(head,mat('#e9b24c',.28,.55,{clearcoat:.6}),[[side*.34,1.20,-.02],[side*.46,1.31,-.03],[side*.45,1.49,-.05],[side*.35,1.57,-.04]],[.105,.10,.065,.006]);
   for(let i=0;i<3;i++)orb(head,mat('#3caa92',.65),[side*(.36+i*.028),.73+i*.08,.25],[.022,.025,.014]);
  }
  addEye([0,1.0,.322],1.62,'#ee8a1c');
  // Satchel: a strap hugging the belly and a little leather bag on the hip.
  {const leather=mat('#7a4a2b',.55),lid=mat('#8f5a34',.5),surf=(x,y)=>.32*Math.sqrt(Math.max(0,1-(x/.43)**2-((y-.35)/.47)**2))+.014,strap=[];for(let i=0;i<=16;i++){const t=i/16,x=-.30+.62*t,y=.66-.50*t;strap.push([x,y,surf(x,y)])}
   tube(torso,leather,strap,.022);const bag=group(torso,'Satchel',[.33,.15,.17]);bag.rotation.set(-.15,.55,-.12);box(bag,leather,[0,0,0],[.2,.17,.09],.035);box(bag,lid,[0,.045,.04],[.205,.095,.03],.02);orb(bag,mat('#e9b24c',.3,.5),[0,.02,.06],[.022,.022,.01]);
   for(const [x,y]of [[-.2,.5],[-.25,.3],[.22,.48],[.12,.62],[-.1,.08]])orb(torso,mat('#2f9a7c',.6),[x,y,surf(x,y)-.012],[.035,.035,.012]);}

  accent=group(head,'Sprout',[0,1.36,-.07]);for(const side of [-1,1]){const leaf=orb(accent,mat('#268b75',.55),[side*.045,.055,0],[.042,.10,.043]);leaf.rotation.z=-side*.4}
  armPair(.40,.56,0);feet=legsV2(root,body,pose);
  headPivot=.87;
 }else if(face===4){
  mesh(head,geometry('sculpt-dragon-v8',()=>sculptHead(4)),body);orb(torso,body,[0,.32,-.025],[.32,.37,.24]);orb(torso,CREAM(),[0,.29,.20],[.19,.25,.045]);for(const side of [-1,1]){tapered(head,CREAM(),[[side*.30,1.12,-.04],[side*.37,1.27,-.07],[side*.31,1.43,-.08]],[.085,.065,.004]);const fin=group(head,'DragonEar',[side*.45,.91,-.075]);const shape=new T.Shape();shape.moveTo(0,-.08);shape.quadraticCurveTo(side*.32,.03,side*.23,.24);shape.quadraticCurveTo(side*.08,.19,0,.08);mesh(fin,geometry('dragon-fin-'+side,()=>new T.ExtrudeGeometry(shape,{depth:.025,bevelEnabled:true,bevelSize:.02,bevelThickness:.015,bevelSegments:3})),body);ears.push(fin)}tail=group(root,'Tail',[0,.12,-.14]);tapered(tail,body,[[0,0,0],[.27,-.03,-.20],[.43,.10,-.25],[.45,.23,-.23]],[.10,.085,.06,.004]);
  addEye([-.178,.835,.262],.98,'#c4581f');addEye([.178,.835,.262],.98,'#c4581f');

  orb(head,CREAM(),[0,.64,.29],[.26,.20,.055]);for(const side of [-1,1])orb(head,mat('#ac855a',.75),[side*.07,.69,.348],[.014,.010,.006]);cheek(-.30,.66,.258,.057);cheek(.30,.66,.258,.057);
  armPair(.34,.58,.005,{short:true});feet=legsV2(root,body,pose,{short:true});
  headPivot=.74;
 }else if(face===6){
  // Puffy star: a soft core with five rounded points; the side points are arms, the lower points legs.
  const C=.66,dir=a=>[Math.cos(a),Math.sin(a)],lobe=(parent,a,len,base,tip,origin=[0,0,0])=>{const prof=[];for(let i=0;i<=10;i++){const t=i/10;prof.push(new T.Vector2(base+(tip-base)*(t*t*(3-2*t)),len*t))}for(let k=1;k<=8;k++){const th=k/8*Math.PI/2;prof.push(new T.Vector2(Math.max(.0005,tip*Math.cos(th)),len+tip*Math.sin(th)))}const m=mesh(parent,geometry('star-lobe:'+len+':'+base+':'+tip,()=>new T.LatheGeometry(prof,40)),body,origin,[1,1,.78]);m.rotation.z=a-Math.PI/2;return m};
  mesh(head,pillowStar([.66,.34,.36,.36,.34],.34,.31),body,[0,C,0]);
  accent=group(head,'StarCurl',[0,C+.66,-.02]);{const tuft=mat('#8b4ee0',.4,0,{sheen:.6,sheenColor:new T.Color('#e9d2ff')});tapered(accent,tuft,[[0,-.06,0],[.02,.05,.0],[-.04,.14,-.01],[-.12,.17,-.02],[-.15,.11,-.02]],[.06,.07,.06,.04,.012]);tapered(accent,tuft,[[.02,-.05,.02],[.09,.04,.02],[.1,.11,.01]],[.05,.045,.012])}
  addEye([-.15,C+.06,.262],.92,'#7a3fd0');addEye([.15,C+.06,.262],.92,'#7a3fd0');
  cheek(-.26,C-.07,.225,.058);cheek(.26,C-.07,.225,.058);
  for(const side of [-1,1]){const a=side<0?Math.PI-.31:.31,[dx,dy]=dir(a),shoulder=group(root,side<0?'ArmL':'ArmR',[dx*.24,C+dy*.24,0]);shoulder.rotation.z=0;lobe(shoulder,a,.34,.235,.12);const elbow=group(shoulder,'Elbow',[dx*.30,dy*.30,0]),wrist=group(elbow,'Wrist',[dx*.1,dy*.1,0]);shoulder.userData.elbow=elbow;shoulder.userData.wrist=wrist;shoulder.userData.grip=[dx*.46,dy*.46,.06];arms.push(shoulder)}
  feet=[-1,1].map(side=>{const a=-Math.PI/2+side*.62,[dx,dy]=dir(a),hip=group(root,side<0?'LegL':'LegR',[dx*.2,C+dy*.2,0]),knee=group(hip,'Knee',[dx*.22,dy*.22,0]);lobe(hip,a,.2,.235,.17);lobe(knee,a,.15,.17,.125);if(pose==='seated'){hip.rotation.x=-Math.PI/2;knee.rotation.x=Math.PI/2}return hip});
  headPivot=C;
 }else{
  const jelly=body.clone();jelly.userData.instanceOwned=true;jelly.roughness=.16;jelly.clearcoat=1;jelly.clearcoatRoughness=.12;jelly.transparent=true;jelly.opacity=.9;jelly.emissive=new T.Color(jelly.color).multiplyScalar(.14);jelly.iridescence=.35;jelly.sheen=.6;jelly.sheenColor=new T.Color('#e8fbff');
  mesh(head,geometry('sculpt-jelly-v8',()=>sculptHead(5)),jelly);
  for(let i=0;i<7;i++){const a=i*Math.PI*2/7;orb(head,jelly,[Math.cos(a)*.43,.56,Math.sin(a)*.22],[.14,.115,.15])}
  addEye([-.188,.92,.31],1.05,'#5d44d6');addEye([.188,.92,.31],1.05,'#5d44d6');

  cheek(-.30,.74,.29,.055);cheek(.30,.74,.29,.055);
  const spread=[[-.33,.02],[-.22,.18],[-.08,.25],[.08,.25],[.22,.18],[.33,.02]];
  spread.forEach(([x,z],i)=>{const side=i<3?-1:1,n=group(root,'Tentacle'+i,[x,.53,z-.10]);
   tapered(n,jelly,[[0,0,0],[side*.02,-.17,.015],[side*.06,-.34,.035],[side*.17,-.40,.085]],[.062,.073,.074,.055]);
   const elbow=group(n,'Elbow',[side*.17,-.40,.085]);orb(elbow,jelly,[side*.035,.012,.01],[.09,.07,.08]);
   n.userData.grip=[side*.205,-.388,.095];n.userData.elbow=elbow;arms.push(n);
  });
  {head.updateWorldMatrix(true,true);const bell=head.children.filter(n=>n.isMesh),ray=new T.Raycaster(),spark=mat('#ffffff',.2,0,{emissive:'#d8f6ff',emissiveIntensity:.9});for(const [x,y,r]of [[-.3,1.1,.012],[-.12,1.24,.016],[.08,1.3,.01],[.28,1.14,.014],[.36,.98,.009],[-.38,.95,.01],[.02,1.16,.009],[-.22,1.33,.008]]){ray.set(new T.Vector3(x,y,3),new T.Vector3(0,0,-1));const hit=ray.intersectObjects(bell,false)[0];if(hit)orb(head,spark,[x,y,hit.point.z+.004],[r,r,r*.5])}}
  accent=group(head,'BellGlint',[.17,1.19,.22]);orb(accent,mat('#d5f3ff',.4),[0,0,0],[.037,.08,.012]);accent.rotation.z=-.5;
  headPivot=.87;
 }
 if(face===0||face===4){const rise=face===0?.12:.24;for(const leg of feet)leg.position.y+=rise;root.userData.seatOffset=-rise}
 const rear=REAR_PROFILES[face],hips=group(rear.parent==='head'?head:torso,'Hips',rear.at);hips.userData.anatomy=rear.name;
 // Broad overlapping lobes stay embedded in the torso; no hanging spheres.
 if(face===5)mesh(hips,jellyRearSurface(head,rear.at),body);else for(const side of [-1,1]){const [w,h,d]=rear.size;if(face===1)box(hips,body,[side*w*.245,0,0],[w*.48,h,d],.045);else orb(hips,body,[side*w*.28,0,0],[w*.72,h*.78,d])}
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

function addAccessory(root,id,colours={}){
 const rig=root.userData.rig,head=rig.head,fit=accessoryFit(rig.face,id),slot=['bow','silkBow','royalBow'].includes(id)?'neck':['glasses','shades','stargaze'].includes(id)?'face':'head';
 const parent=fit.parent==='body'?rig.body:head,mount=group(parent,'Accessory-'+id);
 mount.userData.attachment=id;mount.userData.fit=fit;mount.userData.slot=slot;
 const colour=accessoryColour(colours,slot,id==='royalBow'?'#6c37ad':id==='silkBow'?'#c393df':id==='stargaze'?'#e4bc66':'#7953bd'),fabric=mat(colour,id==='silkBow'?.27:.66,0,{sheen:id==='silkBow'?.85:.35,sheenRoughness:.45}),metal=mat(accessoryColour(colours,slot,id==='stargaze'?'#e4bc66':'#e7bd69'),.24,.64),gold=mat('#f0cc76',.22,.68),jewel=mat('#74e4dd',.18,.18,{emissive:'#459990',emissiveIntensity:.15});
 const extrude=(name,shape,material,at=[0,0,0],depth=.025)=>mesh(mount,geometry(name,()=>new T.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSize:.006,bevelThickness:.004,bevelSegments:3,curveSegments:16})),material,at);
 if(slot==='face'){
  const ink=mat(accessoryColour(colours,'face',id==='stargaze'?'#e4bc66':id==='shades'?'#342b50':'#59456e'),id==='stargaze'?.21:.38,id==='stargaze'?.6:.12),points=rig.eyes.map(e=>e.position.clone()),lenses=group(mount,'OpticalLenses');
  for(let i=0;i<points.length;i++){
   const p=points[i],size=rig.eyes[i].userData.eyeScale||1,side=points.length===1?1:i===0?-1:1,z=p.z+fit.depth*size;
   if(id==='glasses'){const ring=torus(mount,ink,[p.x,p.y,z],.174*size,.014);ring.scale.y=1.10;}
   else{
    const shape=new T.Shape(),w=.176*size,h=(id==='shades'?.118:.160)*size;
    shape.moveTo(-w,-h*.66);shape.quadraticCurveTo(-w*1.12,-h,w*-.65,-h);shape.lineTo(w*.65,-h);shape.quadraticCurveTo(w*1.12,-h,w,-h*.3);
    if(id==='stargaze'){shape.lineTo(w*(side>0?1.40:1.02),h*1.1);shape.quadraticCurveTo(0,h*.77,-w*(side<0?1.40:1.02),h*1.1);}else{shape.lineTo(w,h*.6);shape.quadraticCurveTo(w,h,w*.65,h);shape.lineTo(-w*.65,h);shape.quadraticCurveTo(-w,h,-w,h*.5)}shape.closePath();
    const outline=shape.getPoints(36).map(q=>[q.x+p.x,q.y+p.y,z]);outline.push(outline[0]);tube(mount,ink,outline,id==='stargaze'?.019:.021);
    const lens=mesh(lenses,geometry('optical-lens-'+id+':'+size+':'+side,()=>new T.ShapeGeometry(shape,24)),mat(id==='shades'?'#30284b':'#8de1e4',.12,.08,{transparent:true,opacity:id==='shades'?.78:.16,side:T.DoubleSide}),[p.x,p.y,z-.006]);lens.renderOrder=2;
    if(id==='stargaze'){
     const outer=p.x+side*w*1.28;mesh(mount,geometry('jewel-cut',()=>new T.OctahedronGeometry(.036)),jewel,[outer,p.y+h*.95,z+.012]);
     tube(mount,gold,[[outer,p.y+h*.90,z],[outer+side*.045,p.y+h*.45,z+.006],[outer+side*.052,p.y+h*.10,z+.010]],.007);
     const drop=mesh(mount,geometry('glasses-pearl',()=>new T.SphereGeometry(.023,14,10)),mat('#f8ebd5',.27),[outer+side*.05,p.y-h*.3,z+.01]);
    }
   }
   const r=.174*size;for(const sign of rig.face===6?[]:points.length===1?[-1,1]:[i===0?-1:1]){
    const wrap=[[.22,0],[.055,-.006],[fit.back,-.025]].map(([depth,dy])=>sideContact(root,sign,p.y+head.position.y+dy,depth,fit.side));
    tube(mount,ink,[[p.x+sign*r,p.y,z],...wrap],id==='shades'?.017:.012);
   }
  }
  if(points.length===2){const [l,r]=points,contact=frontContact(root,0,l.y+head.position.y+fit.bridge);tube(mount,ink,[[l.x+.16,l.y,l.z+fit.depth],[0,l.y+fit.bridge,contact.z+.019],[r.x-.16,r.y,r.z+fit.depth]],id==='shades'?.021:.014)}
  if(id==='stargaze'){const mid=points.reduce((p,e)=>p.add(e),new T.Vector3()).multiplyScalar(1/points.length);const crest=mesh(mount,geometry('optical-crest',()=>new T.OctahedronGeometry(.047)),jewel,[mid.x,mid.y+.22*(points.length===1?1.45:1),mid.z+fit.depth+.01]);crest.scale.y=1.35}
 }else if(slot==='neck'){
  root.updateMatrixWorld(true);const ray=new T.Raycaster(new T.Vector3(fit.at[0],fit.at[1],3),new T.Vector3(0,0,-1)),hit=ray.intersectObjects([rig.head,rig.body],true).find(h=>!h.object.userData.surfaceFace&&!hasAccessoryParent(h.object));if(!hit)throw Error('Neck contact missing for '+rig.face);
  mount.position.copy(parent.worldToLocal(new T.Vector3(fit.at[0],fit.at[1],hit.point.z+.009)));mount.scale.set(...fit.size);mount.rotation.set(...fit.rotation);
  if(id==='bow'){
   for(const side of [-1,1]){const shape=new T.Shape();shape.moveTo(side*.023,-.028);shape.lineTo(side*.15,-.080);shape.lineTo(side*.15,.080);shape.lineTo(side*.023,.028);shape.closePath();extrude('classic-bow-wing-'+side,shape,fabric);tube(mount,mat(accessoryColour(colours,'neck','#b798df'),.75),[[side*.033,0,.035],[side*.12,.031,.035]],.003)}
   box(mount,fabric,[0,0,.025],[.058,.078,.055],.008);
  }else if(id==='silkBow'){
   for(const side of [-1,1]){const shape=new T.Shape();shape.moveTo(side*.016,-.017);shape.bezierCurveTo(side*.07,-.11,side*.225,-.09,side*.195,.045);shape.bezierCurveTo(side*.165,.15,side*.047,.080,side*.016,.017);shape.closePath();extrude('silk-loops-'+side,shape,fabric,[0,0,.006],.035);
    const tail=new T.Shape();tail.moveTo(side*.025,-.018);tail.bezierCurveTo(side*.055,-.075,side*.14,-.09,side*.12,-.205);tail.lineTo(side*.071,-.177);tail.lineTo(side*.04,-.218);tail.bezierCurveTo(side*.065,-.105,side*-.008,-.10,side*.006,-.025);tail.closePath();extrude('silk-tail-'+side,tail,fabric,[0,0,-.01],.018);tube(mount,mat('#e9d6f3',.3),[[side*.028,.012,.054],[side*.095,.070,.054],[side*.163,.052,.054]],.004)}
   orb(mount,fabric,[0,0,.047],[.036,.060,.034]);
  }else{
   // A pleated ceremonial rosette/cravat, not another triangular bow.
   for(let i=0;i<8;i++){const a=i*Math.PI/4,shape=new T.Shape();shape.moveTo(0,0);shape.quadraticCurveTo(-.070,.095,0,.145);shape.quadraticCurveTo(.070,.095,0,0);const petal=extrude('royal-pleat',shape,i%2?fabric:mat(accessoryColour(colours,'neck','#9463c9'),.45),[Math.sin(a)*.015,Math.cos(a)*.015,.012],.026);petal.rotation.z=-a;}
   for(const side of [-1,1]){const tail=new T.Shape();tail.moveTo(side*.025,-.065);tail.lineTo(side*.113,-.265);tail.lineTo(side*.04,-.227);tail.lineTo(side*.006,-.275);tail.lineTo(side*-.026,-.080);tail.closePath();extrude('royal-cravat-tail-'+side,tail,fabric,[0,0,-.015],.020);tube(mount,gold,[[side*.04,-.11,.016],[side*.078,-.238,.016]],.006)}
   const seal=torus(mount,gold,[0,0,.063],.058,.012);mesh(mount,geometry('royal-seal',()=>new T.OctahedronGeometry(.055)),jewel,[0,0,.083]);
   for(const side of [-1,1]){tube(mount,gold,[[side*.085,-.008,.05],[side*.14,-.095,.045],[side*.045,-.15,.05]],.008);orb(mount,mat('#fff0d8',.28),[side*.14,-.095,.045],[.021,.021,.016])}
  }
 }else{
  if(rig.accent)rig.accent.visible=false;
  const contact=BAKED_ACCESSORY_FITS[rig.face+':'+id]?.contact||headwearContact(root,id,fit);mount.userData.contact=contact;
  mount.position.set(fit.at[0],contact.base-head.position.y,fit.at[2]);mount.rotation.set(...fit.rotation);
  const [rx,height,rz]=fit.size,cuffMaterial=id==='crown'||id==='astralCrown'?mat(accessoryColour(colours,'head',id==='astralCrown'?'#29254b':'#7350a5'),.72):fabric;
  mesh(mount,geometry('anatomic-cuff:'+rig.face+':'+id,()=>headwearCuff(contact,rx,rz)),cuffMaterial);
  if(id==='cap'){
   mesh(mount,geometry('cap-open-dome-v9',()=>new T.SphereGeometry(1,36,20,0,Math.PI*2,0,Math.PI/2)),fabric,[0,.018,0],[rx,height,rz]);
   const brim=orb(mount,fabric,[0,.015,rz+.075],[rx*1.16,.025,rz*.72]);brim.rotation.x=.06;orb(mount,fabric,[0,height+.018,0],[.025,.015,.025]);
   for(const side of [-1,1])tube(mount,mat('#ddc9ee',.75),[[side*rx*.08,height+.018,0],[side*rx*.58,height*.78,rz*.50],[side*rx*.88,.026,rz*.43]],.003);
  }else if(id==='beanie'){
   mesh(mount,geometry('beanie-dome-v9',()=>new T.SphereGeometry(1,36,24,0,Math.PI*2,0,Math.PI/2)),fabric,[0,.025,0],[rx,height,rz]);
   for(let i=0;i<32;i++){const a=i/32*Math.PI*2,b=contact.ring[Math.floor(i*contact.ring.length/32)];const lower=(b?.[1]||-.08);tube(mount,mat(accessoryColour(colours,'head','#aa82ce'),.8),[[Math.cos(a)*rx*1.012,lower+.02,Math.sin(a)*rz*1.012],[Math.cos(a)*rx*1.018,.034,Math.sin(a)*rz*1.018]],.004)}
   orb(mount,fabric,[0,height+.085,0],[.09,.09,.09]);for(let i=0;i<7;i++){const a=i*Math.PI*2/7;orb(mount,fabric,[Math.cos(a)*.067,height+.085+Math.sin(a)*.045,Math.sin(a)*.035],[.036,.041,.035])}
  }else if(id==='crown'){
   mesh(mount,geometry('crown-band-v9',()=>new T.CylinderGeometry(1,1,.085,48,1,true)),metal,[0,.067,0],[rx*1.01,1,rz*1.01]);
   for(const y of [.026,.109]){const rim=torus(mount,gold,[0,y,0],1,.012);rim.rotation.x=Math.PI/2;rim.scale.set(rx,rz,1)}
   for(let i=0;i<5;i++){const a=i*Math.PI*2/5,x=Math.sin(a)*rx,z=Math.cos(a)*rz,spike=mesh(mount,geometry('crown-point-v9',()=>new T.ConeGeometry(.058,.19,4)),metal,[x,.195,z]);spike.rotation.y=a;orb(mount,jewel,[x,.297,z],[.027,.032,.027])}
   for(const side of [-1,1])mesh(mount,geometry('crown-front-gem',()=>new T.OctahedronGeometry(.033)),jewel,[side*rx*.55,.068,rz*.87+.014]);
  }else{
   // Celestial diadem: a high crescent arch and three crystal blades.
   tube(mount,gold,[[-rx*.95,.105,-.025],[-rx*.8,.26,-.04],[0,.40,-.055],[rx*.8,.26,-.04],[rx*.95,.105,-.025]],.019);
   const band=torus(mount,metal,[0,.046,0],1,.022);band.rotation.x=Math.PI/2;band.scale.set(rx,rz,1);
   for(const [x,y,size]of [[0,.23,.105],[-rx*.65,.15,.07],[rx*.65,.15,.07]]){const crystal=mesh(mount,geometry('astral-crystal',()=>new T.OctahedronGeometry(1)),jewel,[x,y,rz*.80+.018],[size*.65,size*1.55,size*.48]);crystal.rotation.z=-x*.9;tube(mount,gold,[[x,.055,rz*.8],[x,y-size*.8,rz*.80+.018]],.010)}
   for(const side of [-1,1])orb(mount,mat('#f9edd9',.23),[side*rx*.70,.285,-.04],[.025,.025,.025]);
  }
 }
 clearAccessorySurface(root,mount,id);
 const finish=id==='silkBow'?{roughness:.28,metalness:.02}:['crown','astralCrown','stargaze'].includes(id)?{roughness:.24,metalness:.58}:id==='beanie'?{roughness:.82,metalness:0}:{roughness:slot==='neck'?.66:.42,metalness:slot==='head'?.01:.08};
 batchColours(mount,finish);
 const baked=BAKED_ACCESSORY_FITS[rig.face+':'+id];if(baked){mount.position.fromArray(baked.at);const piece=mount.children.find(n=>n.isMesh),source=piece.geometry;piece.geometry=geometry('wardrobe-v9:'+rig.face+':'+id+':'+accessoryColour(colours,slot,'original'),()=>{const g=piece.geometry.clone();g.userData.owned=false;return g});if(source.userData.owned)source.dispose()}
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
 root.updateMatrixWorld(true);const skin=anatomySurfaces(root),up=mount.userData.slot==='head',ray=new T.Raycaster(),point=new T.Vector3();let correction=0;
 const sample=p=>{
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
