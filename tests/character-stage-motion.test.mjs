import test from 'node:test';
import assert from 'node:assert/strict';
import {createCharacter,disposePerson} from '../client/characters.mjs';
import {animateCharacter,resetCharacter} from '../client/character-motion.mjs';
test('walking, climbing, waving and button strikes preserve model scale and restore all six rigs',()=>{
 for(let face=0;face<7;face++){const root=createCharacter(face),rig=root.userData.rig,scale=root.scale.toArray();
  for(const mood of ['walkLeft','walkRight','climbDown','climbUp','ledge','punch','kick','waveLeft','waveRight'])for(const elapsed of [.05,.2,.4,.7]){animateCharacter(root,{mood,elapsed,time:elapsed});assert.deepEqual(root.scale.toArray(),scale);root.traverse(n=>assert([...n.position,...n.quaternion,...n.scale].every(Number.isFinite)))}
  resetCharacter(root);assert.deepEqual(root.scale.toArray(),scale);assert.equal(root.rotation.y,0);
  if(face!==5){const rest=rig.legs[1].rotation.x;animateCharacter(root,{mood:'kick',elapsed:.42});assert(rig.legs[1].rotation.x<rest-.7);resetCharacter(root);assert.equal(rig.legs[1].rotation.x,rest)}disposePerson(root);
 }
});
