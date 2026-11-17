import test from 'node:test';
import assert from 'node:assert/strict';
import {Group} from 'three';
import {createCharacter,disposePerson} from '../client/characters.mjs';
import {captureRest,resetCharacter,animateCharacter,CHARACTER_DURATIONS} from '../client/character-motion.mjs';
import {animationEmotion} from '../public/animation-style.mjs';

function actor(face=0,pose='seated'){
 const root=new Group();root.position.set(1,2,3);root.rotation.y=.4;root.scale.setScalar(.9);
 const head=new Group(),body=new Group(),arms=[new Group(),new Group()],legs=[new Group(),new Group()],eyes=[new Group(),new Group()],lids=[new Group(),new Group()],brows=[new Group(),new Group()],tail=new Group(),accent=new Group();
 head.position.set(.02,.72,.03);head.rotation.z=.015;body.position.y=.27;eyes.forEach((e,i)=>{e.scale.setScalar([.7,.8][i]);e.userData.eyeScale=[.7,.8][i]});lids.forEach(l=>l.visible=false);
 const mouth={neutral:new Group(),happy:new Group(),sad:new Group()};mouth.happy.visible=false;mouth.sad.visible=false;head.add(...eyes,...lids,...brows,...Object.values(mouth));root.add(head,body,...arms,...legs,tail,accent);
 root.userData={face,rig:{face,pose,head,body,arms,legs,eyes,lids,brows,mouth,tail,accent}};captureRest(root);return root;
}
function snapshot(root){const result=[];root.traverse(n=>result.push({position:n.position.toArray(),rotation:n.rotation.toArray().slice(0,3),scale:n.scale.toArray(),visible:n.visible}));return result}

test('all shared rig gestures seek deterministically without accumulating transform drift',()=>{
 for(let face=0;face<7;face++)for(const mood of ['idle',...Object.keys(CHARACTER_DURATIONS)]){
  const root=actor(face);animateCharacter(root,{face,mood,time:3.7,elapsed:.76});const first=snapshot(root);animateCharacter(root,{face,mood,time:5,elapsed:1.3});animateCharacter(root,{face,mood,time:3.7,elapsed:.76});assert.deepEqual(snapshot(root),first);
  resetCharacter(root);assert.deepEqual(root.position.toArray(),[1,2,3]);assert.deepEqual(root.userData.rig.eyes.map(e=>e.scale.y),[.7,.8]);
 }
});

test('winning and losing have opposite facial and articulated poses for every character',()=>{
 for(let face=0;face<7;face++){
  const winner=actor(face),loser=actor(face);animateCharacter(winner,{mood:'win',elapsed:.8});animateCharacter(loser,{mood:'lose',elapsed:.8});
  assert.equal(winner.userData.rig.mouth.happy.visible,true);assert.equal(winner.userData.rig.mouth.sad.visible,false);assert.equal(loser.userData.rig.mouth.sad.visible,true);assert.equal(loser.userData.rig.mouth.happy.visible,false);
  assert.ok(winner.userData.rig.head.rotation.x<0,'winner looks up');assert.ok(loser.userData.rig.head.rotation.x>0,'loser lowers their head');
  if(face!==5){assert.ok(winner.userData.rig.arms[0].rotation.z<0);assert.ok(winner.userData.rig.arms[1].rotation.z>0)}
  assert.deepEqual(winner.position.toArray(),[1,2,3],'seated hips never leave the chair');
 }
});

test('blink uses registered closed-eye geometry and restores authored eye proportions',()=>{
 const root=actor(0),rig=root.userData.rig;animateCharacter(root,{mood:'idle',time:1.345});assert.ok(rig.lids.every(l=>l.visible));assert.ok(rig.eyes.every(e=>!e.visible));
 animateCharacter(root,{mood:'idle',time:1.8});assert.ok(rig.lids.every(l=>!l.visible));assert.ok(rig.eyes.every(e=>e.visible));assert.deepEqual(rig.eyes.map(e=>e.scale.y),[.7,.8]);
});

test('gestures have bounded lifetimes, settle to rest and preserve the correct final expression',()=>{
 for(const [mood,duration]of Object.entries(CHARACTER_DURATIONS)){
  const root=actor();assert.equal(animateCharacter(root,{mood,elapsed:duration-.01}),true);assert.equal(animateCharacter(root,{mood,elapsed:duration}),false);
  assert.deepEqual(root.userData.rig.arms.map(a=>a.rotation.toArray().slice(0,3)),[[0,0,0],[0,0,0]]);assert.deepEqual(root.userData.rig.head.rotation.toArray().slice(0,3),[0,0,.015]);
  const expression=animationEmotion(mood);assert.equal(root.userData.rig.mouth[expression].visible,true);
 }
});

test('reduced motion keeps static emotion without limb, eye or body motion',()=>{
 for(const mood of ['idle','hello','win','lose']){
  const root=actor(3),rig=root.userData.rig;assert.equal(animateCharacter(root,{mood,time:12,elapsed:.8,reduced:true}),false);assert.deepEqual(root.position.toArray(),[1,2,3]);assert.deepEqual(rig.head.rotation.toArray().slice(0,3),[0,0,.015]);assert.ok(rig.arms.every(a=>a.rotation.z===0));assert.ok(rig.eyes.every(e=>e.visible));
 }
});

test('standing jumps stay above the floor and every sampled rig transform is finite',()=>{
 for(let face=0;face<7;face++)for(const mood of ['idle','hello','win','lose']){
  const root=actor(face,'standing');for(let i=0;i<180;i++){animateCharacter(root,{face,mood,time:i/60,elapsed:i/60});assert.ok(root.position.y>=2&&root.position.y<=2.06);for(const n of snapshot(root))for(const value of [...n.position,...n.rotation,...n.scale])assert.ok(Number.isFinite(value))}
 }
 assert.equal(animateCharacter(null),false);const root=actor();animateCharacter(root,{face:NaN,time:Infinity,elapsed:NaN,mood:'unknown'});assert.ok(snapshot(root).flatMap(n=>n.position).every(Number.isFinite));
});

test('the six production models share the same expression and articulated motion contract',()=>{
 for(let face=0;face<7;face++){
  const root=createCharacter(face,0,'seated');root.position.y=.96;captureRest(root);
  for(const mood of ['hello','win','lose']){
   animateCharacter(root,{face,mood,elapsed:.8});assert.equal(root.position.y,.96);
   assert.equal(root.userData.rig.mouth[mood==='hello'?'neutral':mood==='win'?'happy':'sad'].visible,true);
   for(const n of snapshot(root))for(const v of [...n.position,...n.rotation,...n.scale])assert.ok(Number.isFinite(v));
  }
  assert.equal(root.userData.rig.eyes.length,root.userData.rig.lids.length);disposePerson(root);
 }
});


test('glass knocking articulates all six rigs three times without moving the actor out of its card',()=>{
 for(let face=0;face<7;face++){
  const root=createCharacter(face,0,'standing');captureRest(root);const origin=root.position.clone(),rotation=root.rotation.clone();
  for(const contact of [.42,.76,1.10]){
   animateCharacter(root,{face,mood:'knock',elapsed:contact-.12});const before=root.userData.rig.arms[1].rotation.x;
   animateCharacter(root,{face,mood:'knock',elapsed:contact});assert.ok(root.userData.rig.arms[1].rotation.x<before-.2);
   assert.ok(root.position.equals(origin));assert.ok(root.rotation.equals(rotation));assert.equal(root.userData.rig.mouth.neutral.visible,true);
   for(const n of snapshot(root))for(const v of [...n.position,...n.rotation,...n.scale])assert.ok(Number.isFinite(v));
  }
  assert.equal(animateCharacter(root,{mood:'knock',elapsed:1.8}),false);disposePerson(root);
 }
});
