/** Bound account preparation before any room/match mutation is dispatched. */
export function prepareMatchAccount({ensure,profile,rename,token,syncAppearance=()=>{},name='',timeout=20000}){
 let expired=false,timer;
 const timeoutError=()=>Object.assign(Error('Hesap bağlantısı zaman aşımına uğradı. Lütfen yeniden dene.'),{code:'ACCOUNT_PREPARATION_TIMEOUT'});
 const check=()=>{if(expired)throw timeoutError()};
 const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{expired=true;reject(timeoutError())},timeout)});
 const work=(async()=>{await ensure();check();if(name&&name!==profile()?.name){await rename(name);check()}const accountToken=await token();check();
 // Appearance updates are idempotent and are broadcast by the server when saved.
 // They must not hold room creation hostage to a stalled cosmetic/profile request.
 Promise.resolve().then(syncAppearance).catch(()=>{});return {accountToken};})();
 return Promise.race([work,deadline]).finally(()=>clearTimeout(timer));
}
