export class SingleFlight{
 constructor(){this.pending=new Map()}
 run(key,work){if(!key)return work();if(this.pending.has(key))return this.pending.get(key);const promise=Promise.resolve().then(work).finally(()=>this.pending.delete(key));this.pending.set(key,promise);return promise}
}
export const READ_ROUTES=new Set(['tutorial','state','games','friends','rewards','messages','messages/list','history','leaderboard','profile']);

// Hosting proxies may return HTML while waking or restarting. Never expose it as JSON.
export async function readApiResponse(response){
 const text=await response.text();let value;
 try{value=JSON.parse(text)}catch{const e=Error('Sunucuya şu anda bağlanılamıyor. Lütfen biraz sonra yeniden dene.');e.code='SERVER_UNAVAILABLE';e.status=response.status;throw e}
 if(!value||typeof value!=='object'||Array.isArray(value)){const e=Error('Sunucudan geçerli yanıt alınamadı. Lütfen yeniden dene.');e.code='INVALID_RESPONSE';throw e}
 if(!response.ok){const e=Error(typeof value.error==='string'?value.error:'İşlem tamamlanamadı.');e.code=value.code;e.details=value;e.status=response.status;throw e}
 return value;
}
export async function requestApiJson(url,options,{readOnly=false,fetchImpl=fetch,wait=ms=>new Promise(r=>setTimeout(r,ms))}={}){
 for(let attempt=0;;attempt++){
  try{return await readApiResponse(await fetchImpl(url,options))}
  catch(e){if(!readOnly||attempt>=7||e.code!=='SERVER_UNAVAILABLE'||options.signal?.aborted)throw e;await wait(Math.min(10000,1000*2**attempt));if(options.signal?.aborted)throw new DOMException('Aborted','AbortError')}
 }
}
