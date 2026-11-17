import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createCharacter,disposePerson} from '../client/characters.mjs';
import {animateCharacter,CHARACTER_DURATIONS} from '../client/character-motion.mjs';
import {CharacterReactions} from '../public/motion.mjs';
import {createHash} from 'node:crypto';
const signature=root=>{const hash=createHash('sha256');root.traverse(n=>{if(n.isMesh){hash.update(Buffer.from(n.geometry.attributes.position.array.buffer));if(n.material.color)hash.update(n.material.color.getHexString())}});return hash.digest('hex')};

test('profile and table use byte-identical heads and the same identity for every colour',()=>{
 for(let face=0;face<7;face++)for(const colour of [0,3,7]){const portrait=createCharacter(face,colour,'standing'),table=createCharacter(face,colour,'seated');assert.equal(signature(portrait.userData.rig.head),signature(table.userData.rig.head));assert.equal(portrait.userData.rig.face,table.userData.rig.face);assert.notEqual(portrait.userData.rig.pose,table.userData.rig.pose);disposePerson(portrait);disposePerson(table)}
});
test('win and loss use separate actual face geometries, and greeting articulates a limb',()=>{
 for(let face=0;face<7;face++){const model=createCharacter(face,0,'standing'),rig=model.userData.rig;animateCharacter(model,{mood:'win',elapsed:.8});assert.equal(rig.mouth.happy.visible,true);assert.equal(rig.mouth.sad.visible,false);animateCharacter(model,{mood:'lose',elapsed:.8});assert.equal(rig.mouth.happy.visible,false);assert.equal(rig.mouth.sad.visible,true);const arm=rig.arms[1],rest=arm.rotation.z;animateCharacter(model,{mood:'hello',elapsed:.8});assert.notEqual(arm.rotation.z,rest);disposePerson(model)}
});
test('reaction lifetimes match the articulated clips so redraws cannot skip anticipation',()=>{
 const reactions=new CharacterReactions(),before={matchId:'m',revision:1,over:false,players:[{name:'A',score:0},{name:'B',score:0}],history:[],timeoutCounts:[0,0]};reactions.update(before,0);const scored={...before,revision:2,history:[{actor:0,name:'A',score:3}]};assert.equal(reactions.update(scored,100)[0].remaining,CHARACTER_DURATIONS.celebrate*1000);assert.equal(reactions.update(scored,500)[0].remaining,CHARACTER_DURATIONS.celebrate*1000-400);
});
test('portrait renderer multiplexes one context and cancels hidden rendering, never uses atlas transforms',async()=>{
 const source=await readFile(new URL('../client/portrait-scene.mjs',import.meta.url),'utf8'),motion=await readFile(new URL('../public/motion.mjs',import.meta.url),'utf8');assert.equal((source.match(/new T.WebGLRenderer/g)||[]).length,1);assert.ok(source.includes('this.observer.unobserve(art)')&&source.includes('document.hidden'));assert.ok(source.includes("createCharacter(face,colour,'standing',accessory,colours)"));assert.ok(!motion.includes('spriteFrames')&&!motion.includes('prepareAtlas')&&!motion.includes('portrait-eyelid'));
});

test('waiting scenes skip the active and eliminated seats, run briefly at spaced intervals and reset on a new turn',async()=>{
 const {WaitingCharacters}=await import('../public/motion.mjs'),w=new WaitingCharacters(),g={matchId:'wait',turn:0,history:[],players:[{},{},{},{eliminated:true}],turnSeconds:60,turnDeadline:60000};
 assert.equal(w.update(g,5999),null);assert.deepEqual(w.update(g,6000).seats,[1,2]);assert.equal(w.update(g,7000),null);assert.equal(w.update(g,32000).mood,'frameSit');assert.equal(w.update(g,66000,{blocked:true}),null);g.turn=1;g.history.push({});g.turnDeadline=130000;assert.equal(w.update(g,71000),null);assert.deepEqual(w.update(g,76000).seats,[0,2]);g.over=true;assert.equal(w.update(g,112000),null);
});
