export class ChatOutbox {
 constructor(change=()=>{},gap=1250){this.rows=[];this.tail=Promise.resolve();this.change=change;this.gap=gap;this.last=0}
 merge(scope,messages){const receipts=new Set(messages.map(m=>m.receipt).filter(Boolean));this.rows=this.rows.filter(m=>m.scope!==scope||!receipts.has(m.receipt));return [...messages,...this.rows.filter(m=>m.scope===scope)].sort((a,b)=>a.at-b.at)}
 send(scope,message,transport){const row={...message,scope,receipt:crypto.randomUUID(),at:Date.now(),delivery:'pending'};row.id='local:'+row.receipt;this.rows.push(row);const run=()=>{if(row.queued)return;row.queued=true;row.delivery='pending';this.change(scope);this.tail=this.tail.catch(()=>{}).then(async()=>{await new Promise(r=>setTimeout(r,Math.max(0,this.last+this.gap-Date.now())));this.last=Date.now();try{await transport(row.receipt);if(this.rows.includes(row))row.delivery='sent'}catch(e){if(this.rows.includes(row)){row.delivery='failed';row.error=e.message}}row.queued=false;this.change(scope)});};row.retry=run;run();return row}
}
export function hintAllowed(game,seat,admin=false){return admin||(game.hintUses?.[seat]||0)<2}
export function useHint(game,seat){game.hintUses??={};game.hintUses[seat]=(game.hintUses[seat]||0)+1}
export function hintUsesForViewer(game,seats,viewer,privatePlayerId){return Object.fromEntries(Object.entries(game.hintUses||{}).filter(([seat])=>Number(seat)===viewer||seats[seat]?.playerId!==privatePlayerId))}
