package com.renkio.game;
import android.app.*;import android.os.Bundle;import android.webkit.WebView;import android.view.View;import android.view.ViewGroup;import org.json.*;import java.util.concurrent.*;
/** Real WebView and native-account regression checks; no personal Google credentials. */
public final class PlayReleaseSmoke extends Instrumentation {
 private Bundle args;private WebView web;
 @Override public void onCreate(Bundle value){args=value;start();}
 private WebView find(View v){if(v instanceof WebView)return (WebView)v;if(v instanceof ViewGroup){ViewGroup g=(ViewGroup)v;for(int i=0;i<g.getChildCount();i++){WebView w=find(g.getChildAt(i));if(w!=null)return w;}}return null;}
 private String js(String source)throws Exception{CompletableFuture<String> value=new CompletableFuture<>();runOnMainSync(()->web.evaluateJavascript(source,value::complete));return value.get(12,TimeUnit.SECONDS);}
 private Object value(String source)throws Exception{return new JSONTokener(js(source)).nextValue();}
 private void waitFor(String source)throws Exception{for(int i=0;i<150;i++){if("true".equals(js(source)))return;Thread.sleep(200);}throw new Exception("Timed out: "+source);}
 private void capture(String name)throws Exception{android.graphics.Bitmap b=getUiAutomation().takeScreenshot();try(java.io.FileOutputStream out=new java.io.FileOutputStream(new java.io.File(getTargetContext().getExternalFilesDir(null),name))){b.compress(android.graphics.Bitmap.CompressFormat.PNG,100,out);}b.recycle();}
 @Override public void onStart(){Bundle result=new Bundle();try{Activity a=startActivitySync(getTargetContext().getPackageManager().getLaunchIntentForPackage("com.renkio.game"));web=find(a.getWindow().getDecorView());Thread.sleep(8000);waitFor("typeof document.getElementById('create')?.onclick==='function'&&!document.body.hasAttribute('data-starting')");
  if(!"2".equals(js("window.RenkioNative.accountProtocol()")))throw new Exception("Native protocol missing");
  if("diagnostic".equals(args.getString("mode"))){Thread.sleep(5000);result.putString("stage",String.valueOf(value("document.body.dataset.accountStage")));result.putString("welcome",String.valueOf(value("document.getElementById('accountWelcome').open")));result.putString("screen",String.valueOf(value("JSON.stringify({view:document.body.dataset.view,profile:!!JSON.parse(localStorage.getItem('renkio-profile')||'null')?.nativeUid,dialogs:[...document.querySelectorAll('dialog[open]')].map(d=>d.id),text:document.body.innerText.slice(-700)})")));finish(Activity.RESULT_OK,result);return;}
  waitFor("!!JSON.parse(localStorage.getItem('renkio-profile')||'null')?.nativeUid");JSONObject profile=new JSONObject((String)value("localStorage.getItem('renkio-profile')"));String expected=args.getString("expected",profile.getString("id"));if(!expected.equals(profile.getString("id")))throw new Exception("Guest changed after native migration");
  result.putString("playerId",profile.getString("id"));
  if("fresh".equals(args.getString("mode"))){
   js("import('/account.mjs').then(async a=>{const accountToken=await a.accountToken();window.qaRestore=await (await fetch('/api/mobile-accounts/bootstrap',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({accountToken,accountProtocol:2})})).json()})");waitFor("!!window.qaRestore?.token");String restoreToken=(String)value("window.qaRestore.token");
   js("window.qaAccount=import('/account.mjs');window.qaAccount.then(a=>a.logout()).then(()=>window.qaAccount.then(a=>a.ensureAccount()).catch(()=>{}))");waitFor("document.getElementById('accountWelcome').open");capture("play114-account-welcome.png");
   if(!"true".equals(js("!!document.getElementById('welcomeGoogle').onclick&&!!document.getElementById('welcomeGuest').onclick")))throw new Exception("Missing account choices");
   js("document.getElementById('welcomeGuest').click()");waitFor("!document.getElementById('accountWelcome').open&&JSON.parse(localStorage.getItem('renkio-profile')||'null')?.id!=="+JSONObject.quote(expected));
   com.google.android.gms.tasks.Tasks.await(com.google.firebase.auth.FirebaseAuth.getInstance().getCurrentUser().delete(),30,TimeUnit.SECONDS);
   com.google.android.gms.tasks.Tasks.await(com.google.firebase.auth.FirebaseAuth.getInstance().signInWithCustomToken(restoreToken),30,TimeUnit.SECONDS);
   result.putString("result","PASS: explicit guest choice opens native account; no account created before choice; temporary auth user deleted and baseline restored");finish(Activity.RESULT_OK,result);return;
  }
  Thread.sleep(4000);js("document.querySelector('#guidedTutorial[open] .tutorial-skip')?.click();document.querySelectorAll('dialog[open]').forEach(d=>d.close())");
  String language=args.getString("language","tr");js("if(document.getElementById('languageSelect').value!=="+JSONObject.quote(language)+"){document.getElementById('languageSelect').value="+JSONObject.quote(language)+";document.getElementById('languageSelect').dispatchEvent(new Event('change'))}");
  Thread.sleep(8000);waitFor("typeof document.getElementById('practice')?.onclick==='function'&&!document.body.hasAttribute('data-starting')");js("document.querySelector('#guidedTutorial[open] .tutorial-skip')?.click()");capture("play114-"+language+"-home.png");
  if(!"true".equals(js("document.documentElement.scrollWidth<=innerWidth+2")))throw new Exception("Horizontal layout overflow");
  js("document.querySelector('#guidedTutorial[open] .tutorial-skip')?.click();document.querySelector('[data-page=more]').click();document.getElementById('morePractice').click();document.getElementById('practice').click();if(document.getElementById('practiceChoice').open)document.getElementById('continueTraining').click()");
  waitFor("document.body.dataset.view==='game'");waitFor("document.querySelector('#scores .character-art')?.dataset.modelReady==='true'");
  js("window.qaArt=document.querySelector('#scores .character-art');window.qaCanvas=window.qaArt.firstElementChild;window.qaArt.dataset.accessory='stargaze,royalBow,astralCrown'");Thread.sleep(600);waitFor("document.querySelector('#scores .character-canvas')?.classList.contains('portrait-overscan')");
  if(!"true".equals(js("window.qaCanvas===window.qaArt.firstElementChild&&document.documentElement.scrollWidth<=innerWidth+2")))throw new Exception("Portrait replaced or layout overflowed");
  for(int face=0;face<6;face++){js("window.qaArt.dataset.character='"+face+"'");Thread.sleep(400);capture("play114-"+language+"-face-"+face+".png");}
  js("document.querySelector('#rack .tile')?.click();document.getElementById('shuffle').click();document.getElementById('zoomOut').click();document.getElementById('zoomIn').click()");
  if(!"true".equals(js("window.qaCanvas===window.qaArt.firstElementChild")))throw new Exception("Interaction recreated portrait");
  result.putString("viewport",String.valueOf(value("JSON.stringify({width:innerWidth,scale:visualViewport.scale,height:innerHeight})")));
  result.putString("result","PASS: native migration preserved player; small-screen layout, six accessorized portraits and interaction continuity checked");finish(Activity.RESULT_OK,result);
 }catch(Exception e){try{capture("play114-failure.png");result.putString("screen",String.valueOf(value("JSON.stringify({view:document.body.dataset.view,page:document.body.dataset.page,text:document.body.innerText.slice(-1000)})")));}catch(Exception ignored){}result.putString("error",e.toString());finish(Activity.RESULT_CANCELED,result);}}
}
