import * as T from 'three';

// Face markings are sampled onto the actual head/muzzle, including every morph
// target. They never translate or scale independently of the skin.
const cache=new Map();
const designs=[
 {name:'cloud-bean',at:[0,.752],width:.07,ink:'#4a1f33',brow:'#8a68c4',browY:.965,browX:.14,browWidth:.045},
 {name:'robot-display',at:[0,.80],width:.08,ink:'#86f4ff',brow:'#86f4ff',browY:.995,browX:.11,browWidth:.045},
 {name:'cat-muzzle',at:[0,.732],width:.06,ink:'#4a1f33',brow:'#b5652c',browY:.975,browX:.15,browWidth:.045},
 {name:'cyclops-grin',at:[0,.735],width:.085,ink:'#4a1f33',brow:'#d05a8f',browY:1.055,browX:0,browWidth:.11},
 {name:'dragon-smile',at:[0,.706],width:.07,ink:'#4a1f33',brow:'#4f9a3e',browY:.995,browX:.15,browWidth:.045},
 {name:'jelly-pucker',at:[0,.785],width:.055,ink:'#4a1f33',brow:'#3f9bd0',browY:.965,browX:.15,browWidth:.045},
 {name:'star-smile',at:[0,.61],width:.065,ink:'#4a1f33',brow:'#d9a015',browY:.845,browX:.13,browWidth:.042}
];
const clamp=x=>Math.max(0,Math.min(1,x));
function mouthShape(face,u,expression){
 const arch=1-u*u,smile=expression==='happy',sad=expression==='sad',surprise=expression==='surprise';
 if(face===1){if(surprise)return {top:.030*Math.sqrt(arch),bottom:-.060*Math.sqrt(arch)};const step=Math.round(u*3)/3,mid=(sad?.034:smile?-.044:-.024)*(1-step*step);return {top:mid+.009,bottom:mid-.009}}
 // A soft open "D" smile: the upper lip barely curves, the lower lip drops.
 const k=face===3?1.2:1,w=Math.pow(arch,.75);
 if(surprise)return {top:.02*k*Math.sqrt(arch),bottom:-.04*k*Math.sqrt(arch)};
 if(sad)return {top:.013*k*arch+.004,bottom:.013*k*arch-.004};
 const curl=(smile?.017:.012)*k,open=(smile?.042:.014)*k;
 return {top:-curl*arch+.004*u*u,bottom:-curl*arch-open*w};
}
function tongueShape(face,u,expression){
 // Lies inside the lower half of the open mouth, collapsing when the mouth closes.
 const s=mouthShape(face,u*.5,expression),h=expression==='sad'?0:(s.top-s.bottom)*.42*(1-u*u);return {top:s.bottom+h,bottom:s.bottom+.0015};
}
function projector(surfaces,offset=.003){
 const ray=new T.Raycaster(),memo=new Map();
 for(const mesh of surfaces)mesh.updateWorldMatrix(true,false);
 return (x,y)=>{const key=x.toFixed(6)+':'+y.toFixed(6);if(memo.has(key))return memo.get(key);ray.set(new T.Vector3(x,y,3),new T.Vector3(0,0,-1));const hit=ray.intersectObjects(surfaces,false)[0];if(!hit)throw Error('Facial surface missing at '+key);const z=hit.point.z+offset;memo.set(key,z);return z};
}
function strip(makePoint,z,segments=24){
 const positions=[];for(let i=0;i<=segments;i++){const u=i/segments*2-1;for(const edge of [0,1]){const [x,y]=makePoint(u,edge);positions.push(x,y,z(x,y))}}return new T.Float32BufferAttribute(positions,3);
}
function morphGeometry(base,targets,z){
 const g=new T.BufferGeometry(),positions=strip(base,z),indices=[];g.setAttribute('position',positions);
 for(let i=0;i<positions.count/2-1;i++){const a=i*2;indices.push(a,a+1,a+2,a+2,a+1,a+3)}
 g.setIndex(indices);g.morphAttributes.position=targets.map(target=>strip(target,z));g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();return g;
}
function material(colour,led=false){return new T.MeshBasicMaterial({color:colour,toneMapped:false,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1})}
function faceMesh(parent,name,geometry,colour,led=false){
 const m=material(colour,led);m.userData.instanceOwned=true;const mesh=new T.Mesh(geometry,m);mesh.name=name;mesh.userData.surfaceFace=true;mesh.castShadow=false;mesh.receiveShadow=!led;parent.add(mesh);return mesh;
}
export function createFacialRig(head,face){
 const d=designs[face],surfaces=head.children.filter(n=>n.isMesh),z=projector(surfaces,face===4?.0028:.003),key=face;
 let geometry=cache.get(key);
 if(!geometry){
  const mouthPoint=expression=>(u,edge)=>{const shape=mouthShape(face,u,expression);return [d.at[0]+u*d.width,d.at[1]+(edge?shape.bottom:shape.top)]};
  const mouth=morphGeometry(mouthPoint('neutral'),['happy','sad','surprise'].map(mouthPoint),z);
  const browSides=face===3?[0]:[-1,1];
  const brows=browSides.map(side=>{
   const point=expression=>(u,edge)=>{
    const arch=1-u*u,thickness=[.007,.006,.007,.008,.007,.007,.007][face];
    let curve=[.016,0,.018,.031,.014,.020,.016][face]*arch;
    if(face===2)curve=.020*(1-Math.abs(u))+.007*side*u;
    if(face===4)curve+=side*u*.007;
    if(expression==='happy')curve+=.009*arch;
    if(expression==='sad')curve+=side?(-side*u*.013):(.018*arch);
    if(expression==='angry')curve+=side?(side*u*(face===4?.004:.018)):(-.013*arch);
    return [side*d.browX+u*d.browWidth,d.browY+curve+(edge?-thickness:thickness)];
   };
   return morphGeometry(point('neutral'),['happy','sad','angry'].map(point),z);
  });
  const details=[];if(face!==1){const tongue=expression=>(u,edge)=>{const t=tongueShape(face,u,expression);return [d.at[0]+u*d.width*.5,d.at[1]+(edge?t.bottom:t.top)]};details.push(morphGeometry(tongue('neutral'),['happy','sad','surprise'].map(tongue),(x,y)=>z(x,y)+.0006))}
  if(face===3)for(const side of [-1,1]){const tooth=open=>(u,edge)=>[side*.032+u*.011,.727-(edge?(open?.022:.016)*(1-Math.abs(u)*.7):0)];details.push(morphGeometry(tooth(false),[tooth(true),tooth(false),tooth(false)],(x,y)=>z(x,y)+.0007))}
  geometry={mouth,brows,details};cache.set(key,geometry);
 }
 const mouthRoot=new T.Group();mouthRoot.name='FaceMouth';head.add(mouthRoot);
 const mesh=faceMesh(mouthRoot,'Mouth-'+d.name,geometry.mouth,d.ink,face===1);
 const details=geometry.details.map((g,i)=>faceMesh(mouthRoot,face!==1&&i===0?'Tongue':'CyclopsTooth',g,face!==1&&i===0?'#ff7f9a':'#fffaf0'));
 const mouth={};for(const state of ['neutral','happy','sad']){const marker=new T.Group();marker.name='Mouth'+state;marker.visible=state==='neutral';mouthRoot.add(marker);mouth[state]=marker}
 const brows=geometry.brows.map((g,i)=>{const group=new T.Group();group.name='Brow'+i;group.userData.surfaceFace=true;head.add(group);faceMesh(group,'BrowSurface',g,d.brow,face===1);return group});
 const reset=()=>{for(const n of [mesh,...details])n.morphTargetInfluences.fill(0);for(const b of brows)b.children[0].morphTargetInfluences.fill(0)};
 const expression=name=>{for(const n of [mesh,...details]){n.morphTargetInfluences.fill(0);const i=['happy','sad','surprise'].indexOf(name);if(i>=0)n.morphTargetInfluences[i]=1}};
 const brow=(name,strength)=>{for(const b of brows){b.children[0].morphTargetInfluences.fill(0);const i=['happy','sad','angry'].indexOf(name);if(i>=0)b.children[0].morphTargetInfluences[i]=clamp(strength)}};
 return {name:d.name,mouth,brows,mesh,details,reset,expression,brow};
}
