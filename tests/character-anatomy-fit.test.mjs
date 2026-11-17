import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createCharacter,disposePerson} from '../client/characters.mjs';
import {animateCharacter} from '../client/character-motion.mjs';
import {accessoryFit,REAR_PROFILES} from '../client/character-fit.mjs';

test('paired rear lobes stay integrated in each body instead of hanging below it',()=>{
 assert.equal(new Set(REAR_PROFILES.map(p=>p.name)).size,7);
 for(let face=0;face<7;face++){
  const root=createCharacter(face,0,'standing'),rig=root.userData.rig,hips=rig.hips;
  assert.equal(hips.children.length,1);assert.equal(hips.userData.lobes,2);
  assert.equal(hips.parent.uuid,(rig.rear.parent==='head'?rig.head:rig.body).uuid);
  for(const mood of ['idle','hello','win','lose','impact'])for(const elapsed of [0,.4,1.78,3.4]){
   animateCharacter(root,{mood,time:3,elapsed});root.updateMatrixWorld(true);
   const bounds=new T.Box3().setFromObject(hips);assert.ok(!bounds.isEmpty());
   if(face===5){const local=hips.position;assert.ok(local.y>-.15,'jelly rear stays in the bell, not at tentacle tips');assert.ok(hips.scale.z<=1.05)}
   if(face===1)assert.equal(hips.scale.z,1,'robot chassis remains rigid');
  }
  disposePerson(root);
 }
});

test('every accessory has an independent anatomy fit and remains attached through gestures',()=>{
 for(let face=0;face<7;face++)for(const headwear of ['cap','crown']){
  const root=createCharacter(face,0,'standing',['glasses','bow',headwear]),rig=root.userData.rig;
  const mounts=['glasses','bow',headwear].map(id=>root.getObjectByName('Accessory-'+id));
  const rest=mounts.map(m=>({p:m.position.toArray(),s:m.scale.toArray()}));
  assert.notDeepEqual(accessoryFit(face,'cap').size,accessoryFit(face,'crown').size);
  for(const mood of ['idle','hello','win','lose','impact'])for(const elapsed of [0,.6,1.78,3.4]){
   animateCharacter(root,{mood,time:4,elapsed});
   mounts.forEach((m,i)=>{assert.deepEqual(m.position.toArray(),rest[i].p);assert.deepEqual(m.scale.toArray(),rest[i].s)});
  }
  disposePerson(root);
 }
 const cloned=accessoryFit(2,'future-hat','head');cloned.at[0]=99;
 assert.notEqual(accessoryFit(2,'cap').at[0],99);
 assert.notDeepEqual(accessoryFit(1,'bow'),accessoryFit(5,'bow'));
});
