import test from 'node:test';import assert from 'node:assert/strict';import {Vector3} from 'three';
import {createCharacter,disposePerson} from '../client/characters.mjs';
import {animateCharacter,captureRest,resetCharacter} from '../client/character-motion.mjs';
import {FRAME_SCENES,FRAME_SILL,frameLedge,sampleFrameScene,frameMask,frameReveal} from '../public/frame-scenes.mjs';
test('each authored scene has anticipation, finite values, a natural return and a clipped starting position',()=>{
 for(const [name,duration]of Object.entries(FRAME_SCENES)){
  const start=sampleFrameScene(name,0),end=sampleFrameScene(name,duration);assert.equal(start.clip,FRAME_SILL);assert.equal(end.clip,FRAME_SILL);
  for(const s of [start,end])for(const key of ['lift','sit','grip','slide','wipe','sleep','peek','out'])assert.ok(s[key]===0,name+' '+key);
  for(let t=0;t<=duration;t+=.05){const p=sampleFrameScene(name,t);assert.ok(Object.values(p).every(Number.isFinite));assert.ok(p.clip>=0&&p.clip<=FRAME_SILL)}
 }
});
test('vault has planted hands before departure, a landing pause, then grips again to climb back',()=>{
 assert.ok(sampleFrameScene('frameVault',1).grip>.99);assert.ok(sampleFrameScene('frameVault',2.9).lift<-.3);
 assert.equal(sampleFrameScene('frameVault',4).lift,sampleFrameScene('frameVault',5).lift);
 assert.ok(sampleFrameScene('frameVault',7.5).grip>.99);assert.ok(sampleFrameScene('frameSit',4).sit>.99);
});

test('sitting and leaving the frame reveal the feet; the portrait framing returns smoothly',()=>{
 assert.ok(frameMask(sampleFrameScene('frameSit',0))>30);assert.equal(frameMask(sampleFrameScene('frameSit',4)),0);assert.equal(frameMask(sampleFrameScene('frameVault',4)),0);
 for(const name of Object.keys(FRAME_SCENES)){assert.equal(frameReveal(name,0),0);assert.equal(frameReveal(name,1),1);assert.equal(frameReveal(name,FRAME_SCENES[name]),0)}
});

test('retired frame scenes cannot stretch or move the production actors',()=>{for(let face=0;face<7;face++){const root=createCharacter(face,0,'standing');captureRest(root);for(const mood of Object.keys(FRAME_SCENES)){animateCharacter(root,{mood,elapsed:3});assert.deepEqual(root.position.toArray(),[0,0,0]);assert.deepEqual(root.scale.toArray(),[1,1,1]);assert.ok(root.userData.rig.arms.every(a=>a.scale.equals(new Vector3(1,1,1))))}disposePerson(root)}});
