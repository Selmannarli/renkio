import {randomBytes,createHash} from 'node:crypto';
import {stateDocuments} from './durable-state.mjs';
export const RECOVERY={key:'selman-20261102',from:'415148343475',to:'775891289432',oldUid:'ywCcVwPhsudDf16408po1uJ49rl2',uid:'jDpj4eAsbrYDBNCpm1MG3rh3a3S2',tag:'19432'};
const union=(a=[],b=[])=>[...new Map([...a,...b].map(v=>[JSON.stringify(v),v])).values()];
export function recoverAccount(input,now=Date.now(),token=()=>randomBytes(24).toString('hex')){
 const state=structuredClone(input),{from,to,oldUid,uid,tag,key}=RECOVERY,source=state.social.profiles[from],target=state.social.profiles[to];
 if(target?.accountRecovery?.key===key||!source)return {state:input,changed:false};
 if(!source||!target||String(target.tag)!==tag||source.name!=='Selman')throw Error('Account recovery identities do not match');
 if(state.rooms.some(r=>r.seats.some(s=>s.playerId===from)&&r.seats.some(s=>s.playerId===to)))throw Error('Both accounts occupy the same room');
 const combined={...target,...source,tag,lastSeen:Math.max(source.lastSeen||0,target.lastSeen||0),pushDevices:union(source.pushDevices,target.pushDevices).slice(-5),messageLinks:{...target.messageLinks,...source.messageLinks},recoveryName:source.name,recoveryAuthName:target.name,accountRecovery:{key,from,at:now}};
 combined.economy={...source.economy,diamonds:(source.economy?.diamonds||0)+(target.economy?.diamonds||0),inventory:{}};
 for(const item of new Set([...Object.keys(source.economy?.inventory||{}),...Object.keys(target.economy?.inventory||{})]))combined.economy.inventory[item]=(source.economy?.inventory?.[item]||0)+(target.economy?.inventory?.[item]||0);
 for(const field of ['accessories','receipts','gifts','timeReceipts'])combined.economy[field]=union(source.economy?.[field],target.economy?.[field]);
 delete state.social.profiles[from];state.social.profiles[to]=combined;
 function map(value,field=''){
  if(['text','body','name','recoveryName','recoveryAuthName','fromBackup'].includes(field))return value;
  if(typeof value==='string'){if(value===from)return to;if(value===oldUid)return uid;if(value.startsWith(from+':'))return to+value.slice(from.length);return value}
  if(Array.isArray(value))return value.map(v=>map(v,field));
  if(value&&typeof value==='object'){const out={};for(const [k,v]of Object.entries(value))out[k===from?to:k]=k==='accountRecovery'?v:map(v,k);return out}return value;
 }
 const result=map(state);let movedRooms=0;
 for(const room of result.rooms){for(const seat of room.seats){if(seat.playerId===to&&seat.uid===uid){seat.playerTag=tag;seat.name=combined.name;seat.token=token();movedRooms++;}}}
 const edges=new Map();for(const e of result.social.friends||[]){if(e.from===e.to)continue;const k=[e.from,e.to].sort().join(':');const prior=edges.get(k);if(!prior||e.status==='accepted')edges.set(k,e)}result.social.friends=[...edges.values()];result.social.invites=(result.social.invites||[]).filter(i=>i.from!==i.to);
 return {state:result,changed:true,report:{from,to,tag,movedRooms,diamonds:combined.economy.diamonds,inventory:combined.economy.inventory}};
}
export async function backupRecovery(db,before,after){
 const a=stateDocuments(before),b=stateDocuments(after.state),existing=new Set((await db.collection('renkio_recovery_20261102').get()).docs.map(d=>d.id));
 const changes=[...a].filter(([path,json])=>b.get(path)!==json);for(let i=0;i<changes.length;i+=400){const batch=db.batch();let count=0;for(const [path,json]of changes.slice(i,i+400)){const id=createHash('sha256').update(path).digest('hex');if(!existing.has(id)){batch.create(db.collection('renkio_recovery_20261102').doc(id),{path,json,at:Date.now()});count++}}if(count)await batch.commit()}
}
