import {accessoryFit} from '../client/character-fit.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3,Box3,PerspectiveCamera} from 'three';
import {createCharacter,disposePerson,characterContactPoint,CHARACTER_MODEL_VERSION} from '../client/characters.mjs';
import {animateCharacter,captureCharacterPose,blendCharacterPose,resetCharacter} from '../client/character-motion.mjs';
import {acceptsCharacterGesture,accessoryList} from '../public/character-style.mjs';

test('outcomes and warnings cannot be interrupted or restarted by repeated taps',()=>{
 for(const current of ['win','lose','impact','knock'])assert.equal(acceptsCharacterGesture(current,'hello',500),false);
 for(const mood of ['hello','win','impact','knock'])assert.equal(acceptsCharacterGesture(mood,mood,500),false);
 assert.equal(acceptsCharacterGesture('hello','win',500),true);
 assert.equal(acceptsCharacterGesture('celebrate','knock',500),true);
 assert.equal(acceptsCharacterGesture('win','hello',0),true);
 assert.equal(acceptsCharacterGesture('knock','idle',500),true,'explicitly cancelling a warning must still work');
});

test('all six bare actors have real elbow/wrist joints and no baked-in cosmetic',()=>{
 for(let face=0;face<7;face++){
  const root=createCharacter(face),rig=root.userData.rig;
  assert.equal(root.userData.modelVersion,CHARACTER_MODEL_VERSION);
  const mounts=[];root.traverse(n=>{if(n.userData.attachment)mounts.push(n)});assert.equal(mounts.length,0);
  assert.equal(rig.forearms.length,rig.arms.length);if(face!==5)assert.equal(rig.hands.length,2);
  assert.ok(rig.forearms.every((n,i)=>n.parent===rig.arms[i]));
  disposePerson(root);
 }
});

test('every colour and compatible cosmetic combination stays mounted to its anatomical slot during motion',()=>{
 const loadouts=['none','glasses','bow','cap','crown','glasses,bow','glasses,bow,cap','glasses,bow,crown'];
 for(let face=0;face<7;face++)for(let colour=0;colour<8;colour++)for(const loadout of loadouts){
  const root=createCharacter(face,colour,'standing',loadout),rig=root.userData.rig,mounts=[];
  root.traverse(n=>{if(n.userData.attachment)mounts.push(n)});
  assert.deepEqual(mounts.map(n=>n.userData.attachment).sort(),accessoryList(loadout).sort());
  for(const n of mounts)assert.equal(n.parent.uuid,(accessoryFit(face,n.userData.attachment).parent==='body'?rig.body:rig.head).uuid);
  const local=mounts.map(n=>n.matrix.clone());
  for(const mood of ['hello','win','lose','knock','impact']){
   animateCharacter(root,{mood,elapsed:.85});root.updateMatrixWorld(true);
   mounts.forEach((n,i)=>assert.ok(n.matrix.equals(local[i])));
   assert.deepEqual(root.scale.toArray(),[1,1,1]);
   assert.ok(rig.arms.every(n=>n.scale.equals(new Vector3(1,1,1))));
  }
  disposePerson(root);
 }
});

test('nested joints restore exactly after long sequences and cross-fades preserve endpoints',()=>{
 for(let face=0;face<7;face++){
  const root=createCharacter(face,0,'standing','glasses,bow,cap');resetCharacter(root);
  const rest=captureCharacterPose(root);
  for(let frame=0;frame<300;frame++)animateCharacter(root,{mood:['hello','win','lose','impact','knock'][frame%5],elapsed:(frame%160)/40,time:frame/60});
  resetCharacter(root);
  for(const saved of rest){assert.ok(saved.node.position.equals(saved.position));assert.ok(saved.node.quaternion.equals(saved.quaternion));assert.ok(saved.node.scale.equals(saved.scale))}
  animateCharacter(root,{mood:'lose',elapsed:.8});const previous=captureCharacterPose(root);
  animateCharacter(root,{mood:'win',elapsed:.8});const desired=captureCharacterPose(root);
  blendCharacterPose(previous,0);for(const saved of previous)assert.ok(saved.node.position.distanceTo(saved.position)<1e-9);
  animateCharacter(root,{mood:'win',elapsed:.8});blendCharacterPose(previous,1);
  for(const saved of desired){assert.ok(saved.node.position.distanceTo(saved.position)<1e-9);assert.ok(Math.abs(saved.node.quaternion.dot(saved.quaternion))>1-1e-9)}
  disposePerson(root);
 }
});

test('all three glass contacts are inside each fixed portrait and match the actual articulated hand',()=>{
 for(let face=0;face<7;face++)for(const loadout of ['none','glasses,bow,cap']){
  const root=createCharacter(face,0,'standing',loadout),box=new Box3().setFromObject(root.userData.rig.head),center=box.getCenter(new Vector3()),size=box.getSize(new Vector3()),radius=Math.max(size.y*1.08,size.x)*.5,camera=new PerspectiveCamera(31,1,.1,30);
  center.y-=.04;camera.position.copy(center).add(new Vector3(.18,.12,1).normalize().multiplyScalar(radius/Math.sin(camera.fov*Math.PI/360)*1.14));camera.lookAt(center);camera.updateMatrixWorld();
  for(const elapsed of [.42,.76,1.10]){animateCharacter(root,{mood:'knock',elapsed});root.updateMatrixWorld(true);const p=characterContactPoint(root,camera);assert.ok(Math.abs(p.x)<.98&&Math.abs(p.y)<.98,face+': '+p.toArray());assert.ok(p.z>-1&&p.z<1)}
  disposePerson(root);
 }
});
