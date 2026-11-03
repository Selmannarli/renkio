export const nativeMode=typeof window!=='undefined'&&window.RenkioNative?.accountProtocol?.()===2;
const impl=await import(nativeMode?'./account-native.mjs':'./account-web.mjs');
export let profile=impl.profile;let changed=()=>{};impl.watchProfile(p=>{profile=p;changed(p)});
export function watchProfile(fn){changed=fn;fn(profile)}
export const ensureAccount=(...a)=>impl.ensureAccount(...a),accountToken=(...a)=>impl.accountToken(...a),setNickname=(...a)=>impl.setNickname(...a),emailAccount=(...a)=>impl.emailAccount(...a),googleCredential=(...a)=>impl.googleCredential(...a),resetPassword=(...a)=>impl.resetPassword(...a),logout=(...a)=>impl.logout(...a),reauthenticate=(...a)=>impl.reauthenticate(...a),authMessage=(...a)=>impl.authMessage(...a);
export const googleLogin=(...a)=>impl.googleLogin?.(...a),guestAccount=(...a)=>impl.guestAccount?.(...a),cancelChoice=()=>impl.cancelChoice?.();
