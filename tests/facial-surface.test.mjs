import test from 'node:test';
import assert from 'node:assert/strict';
import {Raycaster,Vector3} from 'three';
import {createCharacter,disposePerson} from '../client/characters.mjs';
import {animateCharacter,captureCharacterPose,blendCharacterPose} from '../client/character-motion.mjs';
import {normalizeAvatar,avatarArt} from '../public/profile-art.mjs';
import {normalizeAccessoryColours,accessoryColourKey} from '../public/character-style.mjs';

test('six different mouth and brow designs remain painted onto the head throughout expression blends',()=>{
 const names=new Set(),shapes=new Set();
 for(let face=0;face<7;face++){
  const root=createCharacter(face,0,'standing'),rig=root.userData.rig,facial=rig.facial;
  names.add(facial.name);shapes.add(Array.from(facial.mesh.geometry.attributes.position.array).join(','));
  root.updateMatrixWorld(true);const skin=rig.head.children.filter(n=>n.isMesh),ray=new Raycaster();
  for(const mesh of [facial.mesh,...facial.brows.map(b=>b.children[0])]){
   const base=mesh.geometry.attributes.position,targets=mesh.geometry.morphAttributes.position;
   for(const target of targets)for(const mix of [0,.25,.5,.75,1])for(let i=0;i<base.count;i++){
    const p=new Vector3().fromBufferAttribute(base,i).lerp(new Vector3().fromBufferAttribute(target,i),mix);mesh.localToWorld(p);
    ray.set(new Vector3(p.x,p.y,3),new Vector3(0,0,-1));const hit=ray.intersectObjects(skin,false)[0];assert.ok(hit,'skin exists below face');
    const depth=p.z-hit.point.z;assert.ok(depth>-.0002&&depth<.004,`${face} ${mesh.name}: depth ${depth}`);
   }
  }
  for(const mood of ['idle','hello','win','lose','angry','surprise','impact'])for(const elapsed of [.1,.5,1,1.5]){
   animateCharacter(root,{mood,elapsed,time:elapsed});assert.deepEqual(facial.mesh.position.toArray(),[0,0,0]);assert.deepEqual(facial.mesh.scale.toArray(),[1,1,1]);
   assert.ok(facial.brows.every(b=>b.rotation.x===0&&b.rotation.y===0&&b.rotation.z===0));
  }
  animateCharacter(root,{mood:'lose',elapsed:.8});const pose=captureCharacterPose(root);animateCharacter(root,{mood:'win',elapsed:.8});blendCharacterPose(pose,0);
  assert.deepEqual(facial.mesh.morphTargetInfluences,[0,1,0]);
  disposePerson(root);
 }
 assert.equal(names.size,7);assert.equal(shapes.size,7);
});

test('independent accessory colours survive avatar storage and serialized artwork, with safe legacy defaults',()=>{
 const avatar=normalizeAvatar({face:2,color:0,accessories:['glasses','bow','cap'],accessoryColors:{face:2,neck:3,head:5}});
 assert.deepEqual(avatar.accessoryColors,{face:2,neck:3,head:5});assert.deepEqual(normalizeAvatar(JSON.parse(JSON.stringify(avatar))),avatar);
 assert.match(avatarArt(avatar),/data-accessory-colours="face:2,neck:3,head:5"/);
 assert.equal(accessoryColourKey('head:5,neck:3,face:2'),'face:2,neck:3,head:5');
 assert.deepEqual(normalizeAccessoryColours({face:99,neck:-1,head:'red',unknown:1}),{});
 assert.deepEqual(normalizeAvatar({face:2,color:0}),{face:2,color:0});
 const root=createCharacter(2,0,'standing','glasses,bow,cap',avatar.accessoryColors);
 const colours=id=>{const part=root.getObjectByName('Accessory-'+id),values=[];part.traverse(n=>{const c=n.geometry?.attributes.color;if(c)values.push(...c.array)});return values};
 assert.notDeepEqual(colours('glasses'),colours('bow'));assert.ok(colours('bow').length>0);
 disposePerson(root);
});
