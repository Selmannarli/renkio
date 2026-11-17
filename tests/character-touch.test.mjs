import test from 'node:test';
import assert from 'node:assert/strict';
import {createCharacter,disposePerson} from '../client/characters.mjs';
import {resetCharacter} from '../client/character-motion.mjs';
import {applyCharacterTouch} from '../client/character-touch.mjs';
test('touch reactions remain bounded, repeatable and attached for every character',()=>{
 for(let face=0;face<7;face++){
  const root=createCharacter(face,0,'standing',['glasses','bow','cap']),rig=root.userData.rig,accessories=[];
  root.traverse(n=>{if(n.userData.attachment)accessories.push({node:n,p:n.position.clone(),s:n.scale.clone()})});
  for(const kind of ['pat','tickle','curious'])for(let i=0;i<100;i++){
   resetCharacter(root);applyCharacterTouch(root,{x:.8,y:.6,strength:1,kind,elapsed:(i%20)/10});
   assert.deepEqual(root.scale.toArray(),[1,1,1]);assert.ok(Math.abs(rig.head.rotation.y)<.5);
   accessories.forEach(({node,p,s})=>{assert.ok(node.position.equals(p));assert.ok(node.scale.equals(s))});
  }
  resetCharacter(root);const pose=rig.head.rotation.toArray();applyCharacterTouch(root,{kind:'tickle',elapsed:3});assert.deepEqual(rig.head.rotation.toArray(),pose);
  resetCharacter(root);applyCharacterTouch(root,{kind:'tickle',elapsed:.5,reduced:true});assert.deepEqual(rig.head.rotation.toArray(),pose);
  disposePerson(root);
 }
});

test('touch gestures have a readable silhouette even when tapped in the centre',()=>{
 for(let face=0;face<7;face++){
  const root=createCharacter(face,0,'standing'),rig=root.userData.rig;
  resetCharacter(root);applyCharacterTouch(root,{kind:'pat',elapsed:.725});assert.ok(Math.abs(rig.head.rotation.z)>.20);
  resetCharacter(root);applyCharacterTouch(root,{kind:'curious',elapsed:.9});assert.ok(Math.abs(rig.head.rotation.z)>.20);
  resetCharacter(root);applyCharacterTouch(root,{kind:'tickle',elapsed:1.05});assert.ok(rig.arms.some(a=>Math.abs(a.rotation.x)>.4));
  disposePerson(root);
 }
});
