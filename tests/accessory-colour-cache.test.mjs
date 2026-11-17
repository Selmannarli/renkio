import test from 'node:test';
import assert from 'node:assert/strict';
import {createCharacter,disposePerson} from '../client/characters.mjs';

test('fitted accessories cache geometry without leaking the first selected colour into later avatars',()=>{
 for(let face=0;face<7;face++)for(const [id,slot]of [['glasses','face'],['bow','neck'],['cap','head'],['crown','head']]){
  const make=n=>createCharacter(face,0,'standing',[id],{[slot]:n});
  const red=make(3),blue=make(2),redAgain=make(3),get=r=>r.getObjectByName('Accessory-'+id).children.find(n=>n.isMesh).geometry;
  assert.notEqual(get(red).uuid,get(blue).uuid,`${face}/${id} shares coloured geometry`);
  assert.notDeepEqual(Array.from(get(red).attributes.color.array),Array.from(get(blue).attributes.color.array));
  assert.equal(get(red).uuid,get(redAgain).uuid,'same colour should reuse its cached fit');
  [red,blue,redAgain].forEach(disposePerson);
 }
});

