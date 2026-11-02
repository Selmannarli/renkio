import {fixedNickname} from './public/identity-policy.mjs';
import {createHash} from 'node:crypto';
import {createRemoteJWKSet,jwtVerify} from 'jose';
import {firebaseConfig,googleClientId} from './public/firebase-config.mjs';
const keys=createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));
export function playerId(uid){return (BigInt('0x'+createHash('sha256').update(uid).digest('hex').slice(0,16))%800000000000n+100000000000n).toString()}
export function publicProfile(user){const id=playerId(user.uid);return {id,name:fixedNickname(id)||user.name?.trim().slice(0,24)||'Player '+id,guest:user.guest}}
export async function verifyAccount(token){
 if(typeof token!=='string'||token.length>8192)throw Error('Hesabına yeniden giriş yap.');
 try{let p;const projects=[firebaseConfig.projectId,...(process.env.RENKIO_LEGACY_AUTH_PROJECT?[process.env.RENKIO_LEGACY_AUTH_PROJECT]:[])];for(const project of projects){try{({payload:p}=await jwtVerify(token,keys,{clockTolerance:30,algorithms:['RS256'],audience:project,issuer:'https://securetoken.google.com/'+project}));break}catch{}}if(!p)throw Error();
 if(!p.sub||p.sub.length>128||!Number.isInteger(p.auth_time)||p.auth_time>Date.now()/1000+30)throw Error();
 return {uid:p.sub,project:p.aud,name:p.name||'',guest:p.firebase?.sign_in_provider==='anonymous'||!!p.renkioGuest&&!Object.keys(p.firebase?.identities||{}).length,authTime:p.auth_time};
 }catch{throw Error('Hesap oturumu doğrulanamadı. Yeniden giriş yap.')}
}

const googleKeys=createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
export async function verifyGoogleCredential(token,nonce){const {payload}=await jwtVerify(token,googleKeys,{clockTolerance:30,algorithms:['RS256'],audience:googleClientId,issuer:['https://accounts.google.com','accounts.google.com']});if(payload.nonce!==nonce)throw Error('Giriş isteği doğrulanamadı.');return payload}

export async function legacyIdentity(input){
 const project=process.env.RENKIO_LEGACY_AUTH_PROJECT,key=process.env.RENKIO_LEGACY_WEB_KEY;
 if(!project||!key)throw Error('Eski oturum aktarımı kullanılamıyor.');
 if(typeof input.refreshToken!=='string'||input.refreshToken.length<20||input.refreshToken.length>8192)throw Error('Geçersiz oturum aktarımı.');
 const res=await fetch('https://securetoken.googleapis.com/v1/token?key='+encodeURIComponent(key),{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',refresh_token:input.refreshToken}),signal:AbortSignal.timeout(15000)});
 if(!res.ok)throw Error('Önceki oturum doğrulanamadı.');const value=await res.json();
 const {payload:p}=await jwtVerify(value.id_token,keys,{clockTolerance:30,algorithms:['RS256'],audience:project,issuer:'https://securetoken.google.com/'+project});
 if(!p.sub||p.sub.length>128)throw Error('Önceki oturum doğrulanamadı.');return {uid:p.sub,guest:p.firebase?.sign_in_provider==='anonymous'};
}
