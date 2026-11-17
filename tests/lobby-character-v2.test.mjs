import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createCharacter,disposePerson} from '../client/characters.mjs';
import {animateCharacter,CHARACTER_DURATIONS} from '../client/character-motion.mjs';
import {Friends} from '../friends.mjs';
const hash=root=>{const h=createHash('sha256');root.traverse(n=>{if(n.isMesh){h.update(Buffer.from(n.geometry.attributes.position.array.buffer));h.update(n.material.color.getHexString())}});return h.digest('hex')};
test('all accessories use the same articulated geometry in portrait and at the table',()=>{
 for(let face=0;face<7;face++)for(const accessory of ['none','glasses','bow','cap','crown']){const a=createCharacter(face,0,'standing',accessory),b=createCharacter(face,0,'seated',accessory);assert.equal(hash(a.userData.rig.head),hash(b.userData.rig.head),face+'/'+accessory);for(const root of [a,b]){for(const mood of ['angry','surprise','impact']){animateCharacter(root,{mood,elapsed:.85});root.traverse(n=>{for(const v of [...n.position,...n.rotation.toArray().slice(0,3),...n.scale])assert.ok(Number.isFinite(v))});if(root.userData.rig.pose==='seated')assert.equal(root.position.y,0);animateCharacter(root,{mood,elapsed:CHARACTER_DURATIONS[mood]+.1});assert.equal(root.rotation.y,0)}disposePerson(root)}}
});
test('repeated invites are idempotent, newer tables replace old invites, absent inviters cannot retain invites',()=>{
 const profiles={a:{name:'A'},b:{name:'B'}},state={profiles,friends:[{from:'a',to:'b',status:'accepted'}]},f=new Friends(state),rooms=new Map([['one',{seats:[{playerId:'a'}]}],['two',{seats:[{playerId:'a'}]}]]);const first=f.invite('a','b','one',100);assert.equal(f.invite('a','b','one',101).id,first.id);f.invite('a','b','two',102);assert.equal(state.invites.length,1);assert.equal(f.view('b',rooms,103).invites[0].room,'two');rooms.get('two').seats=[];assert.equal(f.view('b',rooms,104).invites.length,0);rooms.get('two').seats=[{playerId:'a'}];rooms.get('two').closedAt=105;assert.equal(f.view('b',rooms,106).invites.length,0);f.cancelRoom('two');assert.equal(state.invites.length,0);
});
