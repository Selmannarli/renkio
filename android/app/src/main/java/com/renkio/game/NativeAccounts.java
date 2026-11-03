package com.renkio.game;

import android.app.Activity;
import android.os.CancellationSignal;
import androidx.credentials.*;
import androidx.credentials.exceptions.GetCredentialException;
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;
import com.google.firebase.FirebaseApp;
import com.google.firebase.auth.*;
import com.google.android.gms.tasks.Task;
import org.json.*;
import java.util.UUID;
import java.util.concurrent.Executor;

/** Android is the sole session authority for protocol-2 installations. */
final class NativeAccounts {
 interface Sink { void send(String request,JSONObject value,String code,String message); }
 private final Activity activity;private final Sink sink;private final FirebaseAuth auth,candidate;
 private final Executor executor;private final CredentialManager manager;
 private AuthCredential pendingCredential;private CancellationSignal googleCancellation;private boolean choosing=false;
 NativeAccounts(Activity activity,Sink sink){this.activity=activity;this.sink=sink;executor=command->activity.runOnUiThread(command);auth=FirebaseAuth.getInstance();
  FirebaseApp second;try{second=FirebaseApp.getInstance("RenkioCandidate");}catch(IllegalStateException e){second=FirebaseApp.initializeApp(activity,FirebaseApp.getInstance().getOptions(),"RenkioCandidate");}
  candidate=FirebaseAuth.getInstance(second);candidate.signOut();manager=CredentialManager.create(activity);
 }
 JSONObject state(){JSONObject o=new JSONObject();FirebaseUser u=auth.getCurrentUser();try{o.put("migrationDone",activity.getSharedPreferences("native-account",0).getBoolean("migrationDone",false));if(u==null){o.put("signedIn",false);return o;}boolean migrated=activity.getSharedPreferences("native-account",0).getString("guestUid","").equals(u.getUid());o.put("signedIn",true).put("uid",u.getUid()).put("name",u.getDisplayName()==null?"":u.getDisplayName()).put("email",u.getEmail()==null?"":u.getEmail()).put("guest",u.isAnonymous()||migrated&&u.getEmail()==null).put("photoURL",u.getPhotoUrl()==null?"":u.getPhotoUrl().toString());JSONArray providers=new JSONArray();for(UserInfo info:u.getProviderData())if(!"firebase".equals(info.getProviderId()))providers.put(info.getProviderId());o.put("providers",providers);}catch(JSONException ignored){}return o;}
 private void result(String id){if(auth.getCurrentUser()!=null)activity.getSharedPreferences("native-account",0).edit().putBoolean("migrationDone",true).apply();sink.send(id,state(),null,null);}
 private void fail(String id,Exception e){String code="auth/native-error";if(e instanceof FirebaseAuthException)code="auth/"+((FirebaseAuthException)e).getErrorCode().replaceFirst("^ERROR_","").toLowerCase(java.util.Locale.ROOT).replace('_','-');if(e instanceof com.google.firebase.FirebaseNetworkException)code="auth/network-request-failed";if(e instanceof androidx.credentials.exceptions.GetCredentialCancellationException)code="auth/cancelled";sink.send(id,null,code,e.getLocalizedMessage()==null?"Giriş tamamlanamadı.":e.getLocalizedMessage());}
 private void session(String id,Task<AuthResult> task){task.addOnCompleteListener(activity,t->{if(t.isSuccessful())result(id);else fail(id,t.getException());});}
 void request(String id,String action,JSONObject data){try{switch(action){
  case "state": result(id);break;
  case "restore": if(auth.getCurrentUser()!=null){result(id);break;}String token=data.optString("token");if(token.length()<20||token.length()>20000)throw new IllegalArgumentException("Geçersiz oturum.");auth.signInWithCustomToken(token).addOnCompleteListener(activity,t->{if(t.isSuccessful()){if(data.optBoolean("guest"))activity.getSharedPreferences("native-account",0).edit().putString("guestUid",t.getResult().getUser().getUid()).apply();result(id);}else fail(id,t.getException());});break;
  case "guest": if(auth.getCurrentUser()!=null)result(id);else session(id,auth.signInAnonymously());break;
  case "token": FirebaseUser u=auth.getCurrentUser();if(u==null)throw new IllegalStateException("Önce giriş yap.");u.getIdToken(data.optBoolean("force")).addOnCompleteListener(activity,t->{if(t.isSuccessful()){try{sink.send(id,new JSONObject().put("token",t.getResult().getToken()),null,null);}catch(JSONException e){fail(id,e);}}else fail(id,t.getException());});break;
  case "google": google(id);break;
  case "emailCandidate": candidate(id,EmailAuthProvider.getCredential(data.getString("email"),data.getString("password")));break;
  case "finishCandidate": if(pendingCredential==null)throw new IllegalStateException("Giriş süresi doldu. Yeniden dene.");AuthCredential credential=pendingCredential;pendingCredential=null;auth.signInWithCredential(credential).addOnCompleteListener(activity,t->{candidate.signOut();if(t.isSuccessful())result(id);else fail(id,t.getException());});break;
  case "cancelCandidate": cancel();result(id);break;
  case "emailRegister": String email=data.getString("email"),password=data.getString("password");FirebaseUser current=auth.getCurrentUser();if(current==null)session(id,auth.createUserWithEmailAndPassword(email,password));else if(current.isAnonymous()||state().optBoolean("guest"))session(id,current.linkWithCredential(EmailAuthProvider.getCredential(email,password)));else throw new IllegalStateException("Önce hesabından çıkış yap.");break;
  case "nickname": FirebaseUser named=auth.getCurrentUser();if(named==null)throw new IllegalStateException("Önce giriş yap.");named.updateProfile(new UserProfileChangeRequest.Builder().setDisplayName(data.getString("name")).build()).addOnCompleteListener(activity,t->{if(t.isSuccessful())result(id);else fail(id,t.getException());});break;
  case "passwordReset": auth.sendPasswordResetEmail(data.getString("email")).addOnCompleteListener(activity,t->{if(t.isSuccessful())result(id);else fail(id,t.getException());});break;
  case "reauthenticate": FirebaseUser reauth=auth.getCurrentUser();if(reauth==null)throw new IllegalStateException("Önce giriş yap.");reauth.reauthenticate(EmailAuthProvider.getCredential(data.getString("email"),data.getString("password"))).addOnCompleteListener(activity,t->{if(t.isSuccessful())result(id);else fail(id,t.getException());});break;
  case "logout": cancel();auth.signOut();activity.getSharedPreferences("native-account",0).edit().remove("guestUid").apply();result(id);break;
  default: throw new IllegalArgumentException("Giriş işlemi geçersiz.");
 }}catch(Exception e){fail(id,e);}}
 private void google(String id){if(choosing){sink.send(id,null,"auth/busy","Giriş işlemi devam ediyor.");return;}choosing=true;googleCancellation=new CancellationSignal();GetSignInWithGoogleOption option=new GetSignInWithGoogleOption.Builder("29242429689-b8kq150s2o7fvau3mqjrevrc98l9sh05.apps.googleusercontent.com").setNonce(UUID.randomUUID().toString()).build();GetCredentialRequest request=new GetCredentialRequest.Builder().addCredentialOption(option).build();manager.getCredentialAsync(activity,request,googleCancellation,executor,new CredentialManagerCallback<GetCredentialResponse,GetCredentialException>(){
  @Override public void onResult(GetCredentialResponse response){choosing=false;try{Credential credential=response.getCredential();if(!(credential instanceof CustomCredential))throw new IllegalArgumentException("Google yanıtı geçersiz.");GoogleIdTokenCredential google=GoogleIdTokenCredential.createFrom(credential.getData());candidate(id,GoogleAuthProvider.getCredential(google.getIdToken(),null));}catch(Exception e){fail(id,e);}}
  @Override public void onError(GetCredentialException e){choosing=false;fail(id,e);}
 });}
 private void candidate(String id,AuthCredential credential){pendingCredential=null;candidate.signInWithCredential(credential).addOnCompleteListener(activity,t->{if(!t.isSuccessful()){fail(id,t.getException());return;}pendingCredential=credential;t.getResult().getUser().getIdToken(false).addOnCompleteListener(activity,token->{if(token.isSuccessful()){try{sink.send(id,new JSONObject().put("candidateToken",token.getResult().getToken()),null,null);}catch(JSONException e){fail(id,e);}}else fail(id,token.getException());});});}
 private void cancel(){if(googleCancellation!=null)googleCancellation.cancel();choosing=false;pendingCredential=null;candidate.signOut();}
}
