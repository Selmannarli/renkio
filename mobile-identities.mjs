import {playerId,publicProfile} from './account.mjs';
import {RECOVERY} from './account-recovery.mjs';
export function mobileIdentity(state,rooms,user){
 const direct=playerId(user.uid),profiles=state.profiles;
 let found=Object.entries(profiles).find(([,p])=>p.mobileAuthLinks?.some(l=>l.uid===user.uid&&l.project===user.project));
 found??=Object.entries(profiles).find(([,p])=>p.accountRecovery?.from===direct);
 const id=found?.[0]||direct,p=profiles[id];
 const uid=p?.mobilePrimaryUid||(id===RECOVERY.to&&p?.accountRecovery?.key===RECOVERY.key?RECOVERY.uid:null)||[...rooms.values()].flatMap(r=>r.seats).find(s=>s.playerId===id&&s.uid&&!s.bot)?.uid||(id===direct?user.uid:null);
 if(p&&!uid)throw Error('Hesap kimliği doğrulanamadı.');return {id,uid:uid||user.uid,profile:p,exists:!!p};
}
export function mobilePreview(state,rooms,user){
 const identity=mobileIdentity(state,rooms,user),p=identity.profile,matchCount=(state.matches||[]).filter(m=>m.players?.some(s=>s.id===identity.id)).length,openCount=[...rooms.values()].filter(r=>!r.closedAt&&!r.game?.over&&r.seats.some(s=>s.playerId===identity.id&&!s.kicked)).length;
 return {id:identity.id,tag:p?.tag||null,name:p?.name||publicProfile(user).name,diamonds:p?.economy?.diamonds||0,matchCount,openCount,exists:identity.exists,meaningful:!!(matchCount||openCount||p?.economy?.diamonds||p?.name&&!/^Player\s+\d+$/.test(p.name))};
}
export function mobileChoice(current,candidate){if(!current||current.id===candidate.id)return 'cloud';if(!candidate.exists)return 'current';return current.meaningful?'conflict':'cloud'}
export function bindMobileIdentity(state,rooms,current,candidate,choice){
 const cloud=mobileIdentity(state,rooms,candidate),local=current&&mobileIdentity(state,rooms,current);
 if(choice==='keep'){if(!local)throw Error('Cihaz hesabı bulunamadı.');return {id:local.id,action:'keep',changed:false}}
 if(choice==='cloud')return {id:cloud.id,action:'cloud',changed:false};
 if(choice!=='current'||!local?.profile)throw Error('Hesap seçimi geçersiz.');
 if(cloud.exists&&cloud.id!==local.id)throw Error('Bulut hesabının üzerine yazılamaz.');
 const p=local.profile;p.mobileAuthLinks??=[];
 if(p.mobileAuthLinks.some(l=>l.uid===candidate.uid&&l.project===candidate.project))return {id:local.id,action:'cloud',changed:false};
 if(p.mobileAuthLinks.length>=12)throw Error('Bu hesaba bağlanabilecek giriş sayısına ulaşıldı.');
 p.mobilePrimaryUid=local.uid;p.mobileNamePinned=true;p.mobileAuthLinks.push({uid:candidate.uid,project:candidate.project});
 return {id:local.id,action:'cloud',changed:true};
}
