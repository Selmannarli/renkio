import test from 'node:test';import assert from 'node:assert/strict';import {Vector3} from 'three';
import {createCharacter,disposePerson} from '../client/characters.mjs';import {animateCharacter,CHARACTER_DURATIONS} from '../client/character-motion.mjs';
test('head rotates around a fixed anatomical neck and torso gestures carry the entire actor',()=>{
 const neck=[.56,.65,.59,.57,.62,.77,.66];
 for(let face=0;face<7;face++){const root=createCharacter(face,0,'standing'),rig=root.userData.rig,headY=rig.head.position.y,bodyRotation=rig.body.rotation.clone();
 for(const [mood,duration]of Object.entries(CHARACTER_DURATIONS))for(let i=0;i<=24;i++){
 animateCharacter(root,{mood,elapsed:duration*i/24,time:0});root.updateMatrixWorld(true);
 const anchor=rig.head.localToWorld(new Vector3(0,neck[face]-headY,0));root.worldToLocal(anchor);
 assert(anchor.distanceTo(new Vector3(0,neck[face],0))<.00001,`${face}/${mood}: detached neck`);
 assert(rig.body.rotation.equals(bodyRotation),`${face}/${mood}: torso moved through head`);
 }disposePerson(root)}
});
