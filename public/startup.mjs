export class StartupGate{
 constructor(native=false,onChange=()=>{}){this.native=native;this.nativeReady=!native;this.appReady=false;this.closed=false;this.status='loading';this.onChange=onChange}
 update(status){if(this.closed)return;if(['checking','updating','saved'].includes(status)){this.nativeReady=false;this.status='updating'}else if(['current','offline'].includes(status)){this.nativeReady=true;this.status='loading'}this.settle()}
 releaseCached(){if(this.closed)return;this.nativeReady=true;this.status='loading';this.settle()}
 ready(){this.appReady=true;this.settle()}
 settle(){if(this.closed)return;if(this.appReady&&this.nativeReady)this.closed=true;this.onChange(this)}
}
export async function settleWithin(work,ms){let timer;try{await Promise.race([Promise.resolve(work).catch(()=>{}),new Promise(resolve=>{timer=setTimeout(resolve,ms)})])}finally{clearTimeout(timer)}}
export function createOpening({doc=document,win=window,nativeWait=6000,nativeRetry=750}={}){
 const screen=doc.getElementById('startupScreen'),label=doc.getElementById('startupStatus'),retry=doc.getElementById('startupRetry'),native=!!win.RenkioNative?.refresh;let resolve,started=false,timer,nativeTimer,retryTimer;
 if(!screen)return {finished:Promise.resolve(),start(){if(native)win.RenkioNative.refresh()}};
 const finished=new Promise(r=>resolve=r),language=()=>{try{return localStorage.getItem('renkio-language')==='en'}catch{return false}};
 const gate=new StartupGate(native,state=>{if(!screen)return;if(state.closed){clearTimeout(timer);clearTimeout(nativeTimer);clearTimeout(retryTimer);screen.classList.add('startup-leaving');doc.body.removeAttribute('data-starting');setTimeout(()=>{screen.remove();resolve()},180);return}label.textContent=state.status==='updating'?(language()?'Updating…':'Güncelleniyor…'):(language()?'Loading…':'Yükleniyor…')});
 win.addEventListener('renkio-update',e=>{gate.update(e.detail);if(e.detail==='saved'&&!gate.closed&&native)win.RenkioNative.refresh()});
 const failed=()=>{if(gate.closed)return;label.textContent=language()?'Could not connect. Try again.':'Bağlantı kurulamadı. Tekrar deneyebilirsin.';retry.hidden=false;retry.textContent=language()?'Try again':'Yeniden dene';screen.classList.add('startup-failed')};
 retry.onclick=()=>win.location.reload();doc.querySelector('script[src="/app.mjs"]')?.addEventListener('error',failed);timer=setTimeout(failed,15000);gate.onChange(gate);
 return {finished,start(preparation){if(started)return;started=true;const began=performance.now();if(native){if(win.navigator?.onLine===false)gate.update('offline');else{gate.update('checking');nativeTimer=setTimeout(()=>gate.releaseCached(),nativeWait);retryTimer=setTimeout(()=>{if(!gate.closed&&!gate.nativeReady)try{win.RenkioNative.refresh()}catch{}},nativeRetry);try{win.RenkioNative.refresh()}catch{gate.update('offline')}}}Promise.resolve(preparation).then(()=>new Promise(r=>setTimeout(r,Math.max(0,400-(performance.now()-began))))).then(()=>gate.ready(),failed)}};
}
export const opening=typeof document==='undefined'?null:createOpening();
