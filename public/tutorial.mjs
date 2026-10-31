import {createGame,play,validate} from './engine.mjs';
export const TUTORIAL_VERSION=1;
export const LESSONS=[{id:'red-square',c:0,s:1,x:1,y:0},{id:'blue-circle',c:4,s:0,x:0,y:1},{id:'blue-square',c:4,s:1,x:1,y:1}];
const tile=(id,c,s)=>({id,c,s});
export function tutorialCanOffer({view,page,restoring=false,starting=false,searching=false}){return view==='home'&&page==='home'&&!restoring&&!starting&&!searching}
export function tutorialFinished(record){return Number(record?.version)>=TUTORIAL_VERSION&&['completed','skipped'].includes(record?.status)}
export function saveTutorial(profile,input,now=Date.now()){
 if(input.version!==TUTORIAL_VERSION||!['completed','skipped'].includes(input.status))throw Error('Geçersiz eğitim kaydı.');
 if(tutorialFinished(profile.tutorial))return profile.tutorial;
 profile.tutorial={version:TUTORIAL_VERSION,status:input.status,at:now};return profile.tutorial;
}
export class TutorialGame{
 constructor(){this.restart()}
 restart(){this.game=createGame(['Sen','Miko']);this.game.board={'0,0':tile('seed',0,0)};this.game.players[0].hand=[...LESSONS.map(v=>tile(v.id,v.c,v.s)),tile('d1',2,2),tile('d2',5,3),tile('d3',1,5)];this.game.players[1].hand=[tile('bot-heart',0,2),tile('bot-green',3,0),tile('b1',2,5),tile('b2',5,1),tile('b3',1,4),tile('b4',3,3)];this.game.bag=[];this.game.turn=0;this.game.history=[];this.step=0;this.phase='welcome';this.pending=[];this.selected=null;this.error=null;return this}
 get lesson(){return LESSONS[this.step]}
 begin(){if(this.phase==='welcome')this.phase='select'}
 select(id){if(!['select','place','review'].includes(this.phase))return false;if(id!==this.lesson.id){this.error='tile';return false}this.selected=id;this.pending=[];this.phase='place';this.error=null;return true}
 place(id,{x,y}){if(this.phase!=='place'||id!==this.lesson.id){this.error='select';return false}if(x!==this.lesson.x||y!==this.lesson.y){this.error='target';return false}const p={id,x,y},r=validate(this.game.board,this.game.players[0].hand,[p],this.game);if(r.error)throw Error(r.error);this.pending=[p];this.selected=null;this.phase='review';this.error=null;return true}
 commit(){if(this.phase!=='review')return false;play(this.game,0,this.pending);this.pending=[];this.error=null;this.phase=this.step===2?'complete':'bot';return true}
 bot(){if(this.phase!=='bot')return false;const p=this.step===0?{id:'bot-heart',x:2,y:0}:{id:'bot-green',x:0,y:2};play(this.game,1,[p]);this.step++;this.phase='select';return true}
 skip(){this.phase='skipped';this.pending=[];this.selected=null}
}
