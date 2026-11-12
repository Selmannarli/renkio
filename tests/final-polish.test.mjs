import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,pass,expireTurn} from '../public/engine.mjs';
import {extendTurn} from '../public/time-support.mjs';
import {characterEvents,CharacterReactions} from '../public/motion.mjs';
import {tableSeats} from '../public/table.mjs';
import {t,EN,setLanguageForTest} from '../public/i18n.mjs';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {localizedPush} from '../push-notifications.mjs';
import {LEGAL_EN} from '../public/legal-copy.mjs';
import {AudioStudio} from '../public/audio-studio.mjs';

test('paid +30 seconds is once per turn, persistent and never revives an expired turn',()=>{
 const g=createGame(['A','B'],{turnSeconds:60,experimental:true});g.turn=0;const now=Date.now(),old=g.turnDeadline,bag=JSON.stringify(g.bag),hands=JSON.stringify(g.players.map(p=>p.hand));
 assert.equal(extendTurn(g,0,now),old+30000);assert.equal(g.turn,0);assert.equal(JSON.stringify(g.bag),bag);assert.equal(JSON.stringify(g.players.map(p=>p.hand)),hands);
 assert.throws(()=>extendTurn(g,0,now),/kullandın/);assert.throws(()=>extendTurn(g,1,now),/sıran/);
 const saved=JSON.parse(JSON.stringify(g));assert.throws(()=>extendTurn(saved,0,now),/kullandın/);pass(saved,0);assert.ok(extendTurn(saved,1,now)>old);
 const untimed=createGame(['A','B']);assert.throws(()=>extendTurn(untimed,untimed.turn),/süre sınırı/);
 const expired=createGame(['A','B'],{turnSeconds:30});assert.throws(()=>extendTurn(expired,expired.turn,expired.turnDeadline),/doldu/);assert.equal(expired.timeSupportUsed,undefined);
});
test('time boost cannot be used during a third-timeout decision or after the match ends',()=>{
 const g=createGame(['A','B'],{turnSeconds:30});g.timeoutDecision={actor:0,decider:1};assert.throws(()=>extendTurn(g,g.turn));delete g.timeoutDecision;g.over=true;assert.throws(()=>extendTurn(g,g.turn));
});
test('characters react once to committed scoring and timeouts, not reconnects or time boosts',()=>{
 const before={matchId:'x',revision:1,players:[{name:'A'},{name:'B'}],timeoutCounts:[0,0],history:[]};
 const after={...before,revision:2,history:[{actor:0,name:'A',score:12,renkios:1}]};assert.deepEqual(characterEvents(before,after),[{seat:0,mood:'celebrate'},{seat:1,mood:'sad'}]);
 assert.deepEqual(characterEvents(after,JSON.parse(JSON.stringify({...after,revision:3}))),[]);assert.deepEqual(characterEvents(null,after),[]);assert.deepEqual(characterEvents(before,{...after,matchId:'new'}),[]);
 assert.deepEqual(characterEvents(after,{...after,revision:3,timeoutCounts:[0,1]}),[{seat:1,mood:'sad'}]);
});
test('table always has four seats, own character is at the front, kicked players are excluded',()=>{
 const seats=[{playerId:'a'},{playerId:'b'},{playerId:'c',kicked:true},{playerId:'d'}];const ordered=tableSeats(seats,'b');assert.equal(ordered.length,4);assert.equal(ordered[3].playerId,'b');assert.deepEqual(ordered.slice(0,2).map(p=>p.playerId),['a','d']);assert.equal(ordered[2],null);assert.equal(new Set(ordered.filter(Boolean)).size,3);
});
test('a score reaction survives a UI redraw without extending its lifetime or replaying an old move',()=>{
 const r=new CharacterReactions(),g={matchId:'a',revision:1,players:[{name:'A'},{name:'B'}],timeoutCounts:[0,0],history:[]};r.update(g,0);const next={...g,revision:2,history:[{actor:0,name:'A',score:6}]};assert.equal(r.update(next,100)[0].remaining,2650);assert.equal(r.update(next,500)[0].remaining,2250);assert.equal(r.update({...next,revision:3},700)[0].remaining,2050);assert.deepEqual(r.update(next,2751),[]);assert.deepEqual(r.update({...g,matchId:'b'},2000),[]);
});
test('English copy covers rules, controls and errors without rewriting player names or free chat',async()=>{
 setLanguageForTest('en');assert.equal(t('Pas geç'),'Pass turn');assert.equal(t('Taş değiştir'),'Exchange tiles');assert.equal(t('İpucu'),'Hint');assert.equal(t('12 taş oynadı'),'Played 12 tiles');assert.equal(t('Kırmızı Yonca'),'Red Clover');assert.equal(t('Selman · Karakteri canlandır'),'Selman · Animate character');assert.equal(t('Selman'),'Selman');assert.equal(t('Merhaba Selman, yarın görüşürüz'),'Merhaba Selman, yarın görüşürüz');
 const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');const text=[...html.matchAll(/>([^<>]+)</g)].map(m=>m[1].trim()).filter(s=>/[çğıöşüÇĞİÖŞÜ]/.test(s));const missing=text.filter(s=>!EN[s]&&t(s)===s&&s!=='Türkçe'&&s!=='Onaylamak için SİL yaz');assert.deepEqual(missing,[]);
 setLanguageForTest('tr');assert.equal(t('Pas geç'),'Pas geç');
});
test('English phone notifications use the recipient device language and preserve sender names',()=>{
 const message={kind:'message',title:'Yeni mesaj',body:'Selman sana mesaj gönderdi.'};assert.deepEqual(localizedPush(message,'en'),{title:'New message',body:'Selman sent you a message.'});assert.deepEqual(localizedPush(message,'tr'),{title:message.title,body:message.body});assert.equal(localizedPush({kind:'turn',title:'Sıra sende',body:''},'en').body,'Your Renkio table is waiting.');
});
test('dense feedback never interrupts all high-priority finales with an untracked UI voice',()=>{
 const a=new AudioStudio();let starts=0;a.buffers.set('renkio',{});a.buffers.set('select',{});a.bus={};a.ctx={state:'running',createBufferSource(){return {playbackRate:{},connect(){},disconnect(){},start(){this.started=true;starts++},stop(){assert.ok(this.started)}}},createGain(){return {gain:{},connect(){},disconnect(){}}}};for(let i=0;i<6;i++)assert.equal(a.play('renkio'),true);assert.equal(a.play('select'),true);assert.equal(a.voices.length,6);assert.equal(starts,6);
});
test('all 24 expression cells are unclipped and production files match their audit',async()=>{
 const report=JSON.parse(await readFile(new URL('../docs/character-art-v4.json',import.meta.url),'utf8'));assert.equal(report.length,6);for(const item of report){assert.equal(item.cells.length,4);assert.ok(item.cells.every(c=>c.borderAlphaMax<=32&&c.visiblePixels>10000));const bytes=await readFile(new URL('../public/assets/character-'+item.name+'-v4.webp',import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),item.sha256)}
});
test('English privacy and deletion pages include a translation for every Turkish text node',async()=>{
 for(const file of ['privacy.html','delete-account.html']){const html=await readFile(new URL('../public/'+file,import.meta.url),'utf8');const body=html.split('<body>')[1]||html.split('<main')[1];const copy=[...(body||'').matchAll(/>([^<>]+)</g)].map(m=>m[1].trim()).filter(s=>/[çğıöşüÇĞİÖŞÜ]/.test(s)&&!s.startsWith('import '));assert.deepEqual(copy.filter(s=>s!=='Türkçe'&&!EN[s]&&!LEGAL_EN[s]),[])}
});
