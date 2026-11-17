import test from 'node:test';
import assert from 'node:assert/strict';
import {CHARACTER_TINTS,CHARACTER_BASES,characterBodyColour,MIKO_AVATAR} from '../public/character-style.mjs';
import {normalizeAvatar,defaultAvatar,avatarArt} from '../public/profile-art.mjs';
import {Sound} from '../public/ui.mjs';

test('every explicit picker colour means the same body colour for all six characters',()=>{
 assert.equal(CHARACTER_TINTS.length,8);assert.equal(CHARACTER_TINTS[0].hex,null);
 for(let face=0;face<7;face++){assert.equal(characterBodyColour(face,0),CHARACTER_BASES[face]);for(let colour=1;colour<8;colour++)assert.equal(characterBodyColour(face,colour),CHARACTER_TINTS[colour].hex)}
});
test('Miko stays the original robot even when a stale profile value says otherwise',()=>{
 assert.deepEqual(defaultAvatar('miko'),MIKO_AVATAR);assert.deepEqual(normalizeAvatar({face:5,color:7},'miko'),MIKO_AVATAR);assert.ok(avatarArt({face:5,color:7},'miko').includes('data-character="1"'));assert.deepEqual(normalizeAvatar({face:5,color:7},'real-player-id'),{face:5,color:7});
});
test('character voices are distinct, quiet, short, throttled and respect mute',()=>{
 const signatures=[];
 for(let face=0;face<7;face++){const sound=new Sound(true),notes=[];sound.tone=(...args)=>notes.push(args);sound.character(face);assert.ok(notes.length>=2&&notes.length<=3);assert.ok(notes.every(([,at,length,,gain])=>at+length<.3&&gain<=.025));signatures.push(JSON.stringify(notes));const count=notes.length;sound.character(face);assert.equal(notes.length,count);sound.enabled=false;sound.lastCharacterVoice=-999;sound.character(face);assert.equal(notes.length,count)}
 assert.equal(new Set(signatures).size,7);
});
