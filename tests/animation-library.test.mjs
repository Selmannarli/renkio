import test from 'node:test';
import assert from 'node:assert/strict';
import {ANIMATION_OPTIONS,ANIMATION_DURATIONS,ANIMATION_PRIORITIES,DEFAULT_ANIMATION_PREFERENCES,normalizeAnimationPreferences,resolveAnimationMood,animationEmotion,VISITOR_TIMING,SOCIAL_TIMING} from '../public/animation-style.mjs';
import {createCharacter,disposePerson} from '../client/characters.mjs';
import {animateCharacter,resetCharacter,captureRest,characterSocialContactPoint} from '../client/character-motion.mjs';

const pose=root=>{const r=root.userData.rig;return [root,r.head,r.body,...r.arms,...r.forearms,...r.legs,...r.knees].flatMap(n=>[...n.position,...n.rotation.toArray().slice(0,3),...n.scale]).map(v=>+v.toFixed(5))};
test('account animation choices are finite, safe, serializable and preserve old profile defaults',()=>{
 assert.equal(ANIMATION_OPTIONS.greeting.length,5);assert.equal(ANIMATION_OPTIONS.win.length,3);assert.equal(ANIMATION_OPTIONS.loss.length,4);
 assert.deepEqual(normalizeAnimationPreferences(null),DEFAULT_ANIMATION_PREFERENCES);
 assert.deepEqual(normalizeAnimationPreferences({greeting:'__proto__',win:'missing',loss:42}),DEFAULT_ANIMATION_PREFERENCES);
 const selected={greeting:'bothHands',win:'dance',loss:'stomp'};assert.deepEqual(normalizeAnimationPreferences(JSON.parse(JSON.stringify(selected))),selected);
 assert.equal(resolveAnimationMood('hello',undefined),'hello');assert.equal(resolveAnimationMood('win',undefined),'win');assert.equal(resolveAnimationMood('lose',undefined),'lose');
 assert.equal(resolveAnimationMood('hello',selected),'greetBoth');assert.equal(resolveAnimationMood('win',selected),'winDance');assert.equal(resolveAnimationMood('lose',selected),'lossStomp');
 assert.equal(resolveAnimationMood('knock',selected),'knock');assert.equal(resolveAnimationMood('impact',selected),'impact');
 assert.equal(VISITOR_TIMING.duration,2400);assert.equal(VISITOR_TIMING.takeoff+750+650+450,VISITOR_TIMING.duration);
 assert.equal(animationEmotion(null),'neutral');
});
test('every selectable greeting, win and loss has a distinct articulated silhouette in each anatomy',()=>{
 for(let face=0;face<7;face++){const root=createCharacter(face,0,'standing');
  for(const options of Object.values(ANIMATION_OPTIONS)){const seen=new Set();for(const item of options){animateCharacter(root,{mood:item.clip,elapsed:item.duration*.36});seen.add(JSON.stringify(pose(root)))}assert.equal(seen.size,options.length,face+': choices must not be duplicate clips')}
  disposePerson(root);
 }
});
test('all new clips seek deterministically, keep actor scale and settle with the intended emotion',()=>{
 for(let face=0;face<7;face++){const root=createCharacter(face,0,'standing');captureRest(root);const baseScale=root.scale.toArray();
  for(const [mood,duration]of Object.entries(ANIMATION_DURATIONS)){
   for(let i=0;i<=20;i++){const t=duration*i/20;animateCharacter(root,{mood,elapsed:t,time:t});assert.deepEqual(root.scale.toArray(),baseScale);root.traverse(n=>assert([...n.position,...n.quaternion,...n.scale].every(Number.isFinite),face+'/'+mood));}
   animateCharacter(root,{mood,elapsed:duration*.37});const first=pose(root);animateCharacter(root,{mood,elapsed:duration*.63});animateCharacter(root,{mood,elapsed:duration*.37});assert.deepEqual(pose(root),first);
   assert.equal(animateCharacter(root,{mood,elapsed:duration}),false);assert.equal(root.userData.rig.mouth[animationEmotion(mood)].visible,true);
   resetCharacter(root);assert.deepEqual(root.scale.toArray(),baseScale);assert.equal(root.rotation.x,0);assert.equal(root.rotation.y,0);
  }disposePerson(root);
 }
});
test('selected outcomes stay seated and reduced motion never moves any joint',()=>{
 for(let face=0;face<7;face++){const root=createCharacter(face,0,'seated');root.position.set(.4,.96,.2);captureRest(root);const base=pose(root);
  for(const mood of Object.keys(ANIMATION_DURATIONS)){animateCharacter(root,{mood,elapsed:.8,reduced:true});assert.deepEqual(pose(root),base);}
  for(const option of [...ANIMATION_OPTIONS.win,...ANIMATION_OPTIONS.loss]){animateCharacter(root,{mood:option.clip,elapsed:option.duration*.4});assert.deepEqual(root.position.toArray(),[.4,.96,.2]);assert.deepEqual(root.scale.toArray(),[1,1,1]);}
  disposePerson(root);
 }
});
test('flight has a tucked held leg pose rather than a translated walk cycle and hops stay in portrait margin',()=>{
 for(let face=0;face<7;face++){const root=createCharacter(face,0,'standing'),r=root.userData.rig;
  animateCharacter(root,{mood:'visitorFly',elapsed:.2});const legs=r.legs.map(n=>n.rotation.toArray().slice(0,3));animateCharacter(root,{mood:'visitorFly',elapsed:.6});assert.deepEqual(r.legs.map(n=>n.rotation.toArray().slice(0,3)),legs);
  for(let i=0;i<=100;i++){animateCharacter(root,{mood:'winHop',elapsed:i*.028});assert(root.position.y>=0&&root.position.y<=.060001)}disposePerson(root);
 }
});
test('high-five exposes the actual palm/tentacle endpoint and holds it through contact',()=>{
 for(let face=0;face<7;face++)for(const mood of ['highFiveLeft','highFiveRight']){const root=createCharacter(face,0,'standing');
  animateCharacter(root,{mood,elapsed:SOCIAL_TIMING.holdStart/1000});const first=characterSocialContactPoint(root,mood);assert(first?.toArray().every(Number.isFinite));
  animateCharacter(root,{mood,elapsed:SOCIAL_TIMING.holdEnd/1000});const last=characterSocialContactPoint(root,mood);assert(first.distanceTo(last)<1e-7,face+'/'+mood+' planted palm');
  assert.equal(ANIMATION_PRIORITIES[mood],5);disposePerson(root);
 }
});
