import {randomUUID} from 'node:crypto';
export const conversationKey=(a,b)=>[String(a),String(b)].sort().join(':');
export function migrateRoomMessages(state,rooms){
 state.directMessages??=[];const seen=new Set(state.directMessages.map(m=>m.receipt));let added=0;
 for(const r of rooms){if(r.seats.length!==2||r.seats.some(s=>!s.playerId||s.bot))continue;
  for(const m of r.messages||[]){const from=r.seats[m.seat]?.playerId,to=r.seats[1-m.seat]?.playerId,receipt=m.receipt||r.code+':'+m.id;if(!from||!to||seen.has(receipt))continue;state.directMessages.push({id:receipt,receipt,thread:conversationKey(from,to),from,to,text:m.text,at:m.at});seen.add(receipt);added++}
 }return added;
}
export function recordGiftMessage(state,from,to,event){
 state.directMessages??=[];const id='gift:'+event.id;
 if(state.directMessages.some(m=>m.id===id))return false;
 state.directMessages.push({id,receipt:id,thread:conversationKey(from,to),from,to,kind:'gift',gift:{item:event.item,amount:event.amount},text:'Hediye',at:event.at});return true;
}
export function migrateGiftMessages(state){let count=0;for(const [to,p]of Object.entries(state.profiles))for(const event of p.giftInbox||[])if(state.profiles[event.from]&&recordGiftMessage(state,event.from,to,event))count++;return count}
export function conversationAllowed(state,a,b){return a!==b&&!!state.profiles[a]&&!!state.profiles[b]&&((state.friends||[]).some(e=>e.status==='accepted'&&conversationKey(e.from,e.to)===conversationKey(a,b))||(state.directMessages||[]).some(m=>m.thread===conversationKey(a,b))||(state.matches||[]).some(m=>m.players.some(p=>p.id===a)&&m.players.some(p=>p.id===b)));}
export function directMessages(state,a,b,{before=Infinity,beforeId='',limit=100}={}){return (state.directMessages||[]).filter(m=>m.thread===conversationKey(a,b)&&(m.at<before||m.at===before&&beforeId&&m.id<beforeId)).sort((x,y)=>y.at-x.at||(y.id>x.id?1:y.id<x.id?-1:0)).slice(0,limit).reverse()}
export function sendDirect(state,a,b,text,receipt,now=Date.now(),currentMatch=false){
 if(!currentMatch&&!conversationAllowed(state,a,b))throw Error('Bu oyuncuyla mesajlaşmak için arkadaş olmalısınız.');
 if(state.profiles[b]?.blockedPlayers?.includes(a))throw Error('Bu oyuncuya mesaj gönderilemiyor.');
 text=String(text||'').trim();if(!text||[...text].length>160||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text))throw Error('Mesaj 1–160 karakter olmalı.');
 if(typeof receipt!=='string'||!/^[-\w:]{12,100}$/.test(receipt))throw Error('Mesaj kimliği geçersiz.');
 state.directMessages??=[];const previous=state.directMessages.find(m=>m.from===a&&m.receipt===receipt);if(previous){if(previous.to!==b||previous.text!==text)throw Error('Mesaj kimliği daha önce kullanıldı.');return previous}
 const last=state.directMessages.findLast(m=>m.from===a);if(last&&now-last.at<1000)throw Error('Mesajlar arasında biraz bekle.');
 const m={id:randomUUID(),thread:conversationKey(a,b),from:a,to:b,text,receipt,at:now};state.directMessages.push(m);return m;
}
export function conversationList(state,id){const latest=new Map();for(const m of state.directMessages||[])if(m.from===id||m.to===id){const other=m.from===id?m.to:m.from;if(!latest.has(other)||latest.get(other).at<m.at)latest.set(other,m)}return [...latest].map(([other,last])=>({playerId:other,name:state.profiles[other]?.name||'Player',avatar:state.profiles[other]?.avatar,last})).sort((a,b)=>b.last.at-a.last.at)}
