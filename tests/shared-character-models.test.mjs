import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createCharacter,disposePerson} from '../client/characters.mjs';
import {animateCharacter} from '../client/character-motion.mjs';

function meshes(root){return root.children.filter(n=>n.isMesh)}
function intersectsInterior(mesh,point){
 const old=mesh.material.side;mesh.material.side=T.DoubleSide;
 try{const ray=new T.Raycaster(point,new T.Vector3(.017,.013,1).normalize()),hits=ray.intersectObject(mesh,false),distances=[];for(const hit of hits)if(!distances.some(d=>Math.abs(d-hit.distance)<1e-5))distances.push(hit.distance);return distances.length%2===1}finally{mesh.material.side=old}
}
function jointDistance(trunks,point){let nearest=Infinity;for(const trunk of trunks){if(intersectsInterior(trunk,point))return 0;const centre=new T.Box3().setFromObject(trunk).getCenter(new T.Vector3()),direction=centre.sub(point).normalize(),old=trunk.material.side;trunk.material.side=T.DoubleSide;try{const hit=new T.Raycaster(point,direction).intersectObject(trunk,false)[0];if(hit)nearest=Math.min(nearest,hit.distance)}finally{trunk.material.side=old}}return nearest}

test('shared reference models use finite real geometry, expressive joints and a bounded draw budget',()=>{
 for(let face=0;face<7;face++)for(const pose of ['standing','seated']){const root=createCharacter(face,0,pose),rig=root.userData.rig,bounds=new T.Box3().setFromObject(root);assert.equal(rig.pose,pose);assert.equal(rig.face,face);assert.ok(bounds.min.y>-.7&&bounds.max.y<1.85);assert.ok(rig.mouth.neutral.visible&&!rig.mouth.happy.visible&&!rig.mouth.sad.visible);assert.equal(rig.lids.length,rig.eyes.length);let calls=0;
  const visit=n=>{assert.ok(!n.isSprite);if(n.isMesh){assert.ok(!n.geometry.isPlaneGeometry);assert.ok(!n.material.map);for(const key of ['position','normal'])for(const value of n.geometry.attributes[key].array)assert.ok(Number.isFinite(value));}if(!n.visible)return;if(n.isMesh)calls++;n.children.forEach(visit)};visit(root);assert.ok(calls<=30,face+': '+calls+' draw calls');disposePerson(root);
 }
});

test('feet overlap their authored body and shoulders remain attached during every real rig gesture',()=>{
 for(let face=0;face<7;face++)for(const pose of ['standing','seated']){const root=createCharacter(face,0,pose),rig=root.userData.rig;
  for(const mood of ['idle','hello','celebrate','sad','win','lose'])for(const elapsed of [0,.3,.65,1.1,1.5]){animateCharacter(root,{face,mood,time:5.2,elapsed});root.updateMatrixWorld(true);const trunkMeshes=[...meshes(rig.head),...(rig.body?meshes(rig.body):[])];
   if(face!==5)for(const arm of rig.arms){const distance=jointDistance(trunkMeshes,arm.getWorldPosition(new T.Vector3()));assert.ok(distance<.145,`${face}/${pose}/${mood}/${elapsed}: shoulder gap ${distance}`)}
   const bodyBox=new T.Box3();trunkMeshes.forEach(mesh=>bodyBox.union(new T.Box3().setFromObject(mesh)));for(const leg of rig.legs){const legBox=new T.Box3().setFromObject(leg);assert.ok(legBox.intersectsBox(bodyBox),`${face}/${pose}/${mood}: feet detached`)}
  }disposePerson(root);
 }
});
