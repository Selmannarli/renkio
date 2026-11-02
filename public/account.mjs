import {SingleFlight} from './network.mjs';
import {initializeApp,getAuth,signInWithCustomToken,signInAnonymously,onAuthStateChanged,signInWithEmailAndPassword,EmailAuthProvider,linkWithCredential,signInWithCredential,GoogleAuthProvider,updateProfile,signOut,sendPasswordResetEmail,reauthenticateWithCredential} from './firebase.mjs';
import {firebaseConfig} from './firebase-config.mjs';
try{const transfer=JSON.parse(window.RenkioNative?.legacyIdentity?.()||'null');for(const [key,value]of Object.entries(transfer?.storage||{}))if(key.startsWith('renkio-')&&typeof value==='string'&&localStorage.getItem(key)===null)localStorage.setItem(key,value)}catch{}
const auth=getAuth(initializeApp(firebaseConfig));auth.languageCode='tr';
let changed=()=>{},known=null,guestPending=null;
const identityRestoration=new SingleFlight();
// Existing browser/WebView installations keep their own previous Firebase identity.
async function previousBrowserIdentity(){
 if(!globalThis.indexedDB)return null;
 return new Promise(resolve=>{let done=false;const finish=value=>{if(done)return;done=true;clearTimeout(timer);resolve(value)};const timer=setTimeout(()=>finish(null),3000);let request;
 try{request=indexedDB.open('firebaseLocalStorageDb')}catch{return finish(null)}
 request.onupgradeneeded=()=>{request.transaction.abort();finish(null)};request.onerror=()=>finish(null);
 request.onsuccess=()=>{const db=request.result;if(done){db.close();return}if(!db.objectStoreNames.contains('firebaseLocalStorage')){db.close();return finish(null)}let tx;try{tx=db.transaction('firebaseLocalStorage','readonly');const rows=tx.objectStore('firebaseLocalStorage').getAll();rows.onsuccess=()=>{const user=rows.result.map(row=>row.value).find(value=>value?.apiKey&&value.apiKey!==firebaseConfig.apiKey&&typeof value.stsTokenManager?.refreshToken==='string');finish(user?{refreshToken:user.stsTokenManager.refreshToken}:null)};tx.oncomplete=()=>db.close();tx.onerror=()=>{db.close();finish(null)}}catch{db.close();finish(null)}};
 });
}
async function restoreIdentity(){
 await auth.authStateReady();if(auth.currentUser)return;
 await identityRestoration.run('legacy',async()=>{let legacy=null;try{legacy=JSON.parse(window.RenkioNative?.legacyIdentity?.()||'null')}catch{}
 legacy??=await previousBrowserIdentity();if(!legacy)return;const r=await fetch('/api/auth/upgrade',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({refreshToken:legacy.refreshToken}),signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('Önceki hesabın aktarımı tamamlanamadı. İnternet bağlantını kontrol edip yeniden aç.');
 const {token}=await r.json();await signInWithCustomToken(auth,token);window.RenkioNative?.identityRestored?.();});
}
const tags=new Map();
const read=()=>{try{return JSON.parse(localStorage.getItem('renkio-profile'))}catch{return null}};
export let profile=read();
// Player tags are stable; restoring a known account must not wait for a profile round trip.
if(profile?.id&&profile.tag)tags.set(profile.id,profile.tag);
export function watchProfile(fn){changed=fn;fn(profile)}
export async function idFor(uid){const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(uid)));const hex=[...bytes.slice(0,8)].map(n=>n.toString(16).padStart(2,'0')).join('');return (BigInt('0x'+hex)%800000000000n+100000000000n).toString()}
async function publish(user){if(!user||auth.currentUser?.uid!==user.uid)return;const claims=(await user.getIdTokenResult()).claims,restoredGuest=!!claims.renkioGuest&&!user.email&&!user.providerData.length;const id=await idFor(user.uid);let tag=tags.get(id)||((profile?.id===id&&profile.tag)||null);if(!tags.has(id))try{const r=await fetch('/api/profile',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({accountToken:await user.getIdToken()}),signal:AbortSignal.timeout(12000)});if(r.ok){tag=(await r.json()).tag;tags.set(id,tag)}}catch{}if(auth.currentUser?.uid!==user.uid)return;const next={id,tag,name:user.displayName&&!/^Player \d{12}$/.test(user.displayName)?user.displayName:'Player '+(tag||'…'),guest:user.isAnonymous||restoredGuest,email:user.email||'',photoURL:user.photoURL||''};if(known===user.uid&&profile&&['id','tag','name','guest','email','photoURL'].every(k=>profile[k]===next[k]))return;profile=next;known=user.uid;try{localStorage.setItem('renkio-profile',JSON.stringify(profile))}catch{}changed(profile)}
onAuthStateChanged(auth,user=>{if(user)publish(user).catch(()=>{});else{known=null;profile=null;try{localStorage.removeItem('renkio-profile')}catch{}changed(null)}});
export async function ensureAccount(){await restoreIdentity();await auth.authStateReady();if(!auth.currentUser){guestPending??=signInAnonymously(auth).finally(()=>{guestPending=null});await guestPending;}await publish(auth.currentUser);return auth.currentUser}
export async function accountToken(){await auth.authStateReady();const user=auth.currentUser||await ensureAccount();return user.getIdToken()}
export async function setNickname(value){const user=await ensureAccount(),n=String(value).trim();if(n.length<2||n.length>24)throw Error('Takma ad 2–24 karakter olmalı.');await updateProfile(user,{displayName:n});await user.getIdToken(true);await publish(user);return profile}
export async function emailAccount(email,password,register){if(password.length<8)throw Error('Şifre en az 8 karakter olmalı.');email=email.trim();if(register){const user=await ensureAccount();if(!user.isAnonymous&&!profile?.guest)throw Error('Önce hesabından çıkış yap.');await linkWithCredential(user,EmailAuthProvider.credential(email,password))}else await signInWithEmailAndPassword(auth,email,password);await publish(auth.currentUser);return profile}
export async function googleCredential(token){await auth.authStateReady();const previous=auth.currentUser,nickname=previous?.displayName,credential=GoogleAuthProvider.credential(token);let result;try{result=(previous?.isAnonymous||profile?.guest)?await linkWithCredential(previous,credential):await signInWithCredential(auth,credential)}catch(e){if(e.code==='auth/credential-already-in-use')result=await signInWithCredential(auth,credential);else throw e}if((previous?.isAnonymous||profile?.guest)&&result.user.uid===previous.uid)await updateProfile(result.user,{displayName:nickname||'Player '+(profile?.tag||await idFor(previous.uid))});else if(!result.user.displayName||result.user.metadata.creationTime===result.user.metadata.lastSignInTime)await updateProfile(result.user,{displayName:'Player '+(profile?.id===await idFor(result.user.uid)&&profile.tag||await idFor(result.user.uid))});await result.user.getIdToken(true);await publish(result.user);return profile}
export async function resetPassword(email){if(!email.trim())throw Error('E-posta adresini yaz.');await sendPasswordResetEmail(auth,email.trim())}
export async function logout(){await signOut(auth);profile=null;changed(null)}
export async function reauthenticate(email,password){await auth.authStateReady();if(!auth.currentUser)throw Error('Önce giriş yap.');await reauthenticateWithCredential(auth.currentUser,EmailAuthProvider.credential(email,password))}
export function authMessage(e){return ({'auth/invalid-credential':'E-posta veya şifre hatalı.','auth/email-already-in-use':'Bu e-posta zaten kayıtlı. Giriş yap seçeneğini kullan.','auth/invalid-email':'E-posta adresini kontrol et.','auth/weak-password':'Daha güçlü bir şifre seç.','auth/too-many-requests':'Çok fazla deneme. Biraz sonra yeniden dene.','auth/network-request-failed':'İnternet bağlantısını kontrol et.','auth/popup-blocked':'Giriş penceresine izin verip tekrar dene.','auth/popup-closed-by-user':'Giriş penceresi kapatıldı.','auth/requires-recent-login':'Önce yeniden giriş yap.'})[e.code]||e.message||'Giriş tamamlanamadı.'}
