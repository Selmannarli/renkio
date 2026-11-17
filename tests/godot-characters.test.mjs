import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {avatarArt} from '../public/profile-art.mjs';

test('all Godot frames passed real-alpha, clean-edge, safe-padding and loop-closure checks',async()=>{
 const report=JSON.parse(await readFile(new URL('../art/character-studio/quality-report.json',import.meta.url),'utf8'));
 assert.equal(report.framesPerCharacter,32);assert.equal(report.characters.length,6);assert.equal(report.columns*report.rows,32);
 for(const [i,c]of report.characters.entries()){
  assert.ok(c.minimumPaddingPx>=40,c.name+' motion padding');assert.equal(c.strayIslands,0,c.name+' pixel residue');
  const bytes=await readFile(new URL('../public/assets/character-'+c.name+'-v3.webp',import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),c.sha256,c.name+' audited artifact');
  assert.equal(bytes.toString('ascii',8,12),'WEBP');assert.equal(bytes.toString('ascii',12,16),'VP8L','lossless alpha WebP');
  const dimensions=bytes.readUInt32LE(21);assert.equal((dimensions&0x3fff)+1,report.cellSize*report.columns);assert.equal(((dimensions>>>14)&0x3fff)+1,report.cellSize*report.rows);
 }
});
test('production portraits request the shared 3D model rather than the retired expression sheets',()=>{
 for(let face=0;face<7;face++){const art=avatarArt({face,color:2});assert.ok(art.includes('data-character="'+face+'"'));assert.ok(art.includes('data-colour="2"'));assert.ok(!/webp|background-image|avatar-image/.test(art))}
});
