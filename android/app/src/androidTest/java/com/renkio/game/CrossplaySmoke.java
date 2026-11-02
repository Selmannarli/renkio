package com.renkio.game;
import android.app.*;
import android.os.Bundle;
import android.webkit.WebView;
import org.json.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;

/** Device smoke test: real WebView load and Android/desktop room interoperability. */
public class CrossplaySmoke extends OfflineSmoke {
 private Bundle args;
 private final String base="https://renkio.onrender.com";
 @Override public void onCreate(Bundle arguments){args=arguments;start();}
 private JSONObject post(String route,JSONObject body)throws Exception{
  HttpURLConnection c=(HttpURLConnection)new URL(base+"/api/"+route).openConnection();
  c.setRequestMethod("POST");c.setConnectTimeout(65000);c.setReadTimeout(65000);c.setDoOutput(true);c.setRequestProperty("Content-Type","application/json");
  try(java.io.OutputStream out=c.getOutputStream()){out.write(body.toString().getBytes(StandardCharsets.UTF_8));}
  int status=c.getResponseCode();String response=new String((status<400?c.getInputStream():c.getErrorStream()).readAllBytes(),StandardCharsets.UTF_8);c.disconnect();
  if(status!=200)throw new Exception(route+": "+response);return new JSONObject(response);
 }
 private JSONObject auth(String room,String token)throws Exception{return new JSONObject().put("room",room).put("token",token);}
 private JSONArray opening(JSONArray hand)throws Exception{
  List<JSONObject> best=new ArrayList<>();for(String attr:new String[]{"c","s"})for(int n=0;n<6;n++){
   List<JSONObject> group=new ArrayList<>();Set<String> seen=new HashSet<>();for(int i=0;i<hand.length();i++){JSONObject t=hand.getJSONObject(i);String k=t.getInt("c")+":"+t.getInt("s");if(t.getInt(attr)==n&&seen.add(k))group.add(t);}if(group.size()>best.size())best=group;
  }JSONArray result=new JSONArray();for(int i=0;i<best.size();i++)result.put(new JSONObject().put("id",best.get(i).getString("id")).put("x",i).put("y",0));return result;
 }
 private void startupSmoke(){Bundle result=new Bundle();long startupBegan=android.os.SystemClock.elapsedRealtime();try{
 Activity a=startActivitySync(getTargetContext().getPackageManager().getLaunchIntentForPackage("com.renkio.game"));WebView web=findWebView(a.getWindow().getDecorView());boolean saw=false,ready=false;
 for(int i=0;i<1000;i++){try{boolean opening="true".equals(matchJs(web,"!!document.getElementById('startupScreen')&&!document.getElementById('startupScreen').classList.contains('startup-leaving')"));if(opening&&!saw){Bundle stage=new Bundle();stage.putString("stage","opening visible");sendStatus(1,stage);}saw|=opening;if(saw&&"true".equals(matchJs(web,"!document.body.hasAttribute('data-starting')&&typeof document.getElementById('create')?.onclick==='function'"))){if("true".equals(matchJs(web,"document.getElementById('toast')?.textContent.includes('Güncelsin.')===true")))throw new Exception("Unexpected success toast");ready=true;break;}}catch(Exception sampling){if(!"WebView timeout".equals(sampling.getMessage()))throw sampling;}Thread.sleep(100);}
 if(!saw||!ready)throw new Exception("Opening did not transition to ready game");long elapsed=android.os.SystemClock.elapsedRealtime()-startupBegan;if(elapsed>12000)throw new Exception("Opening exceeded 12 seconds: "+elapsed);result.putLong("startupMs",elapsed);
 result.putString("result","PASS: installed Android showed opening screen, completed preparation/update handshake, revealed ready game and did not show up-to-date toast");finish(Activity.RESULT_OK,result);
 }catch(Exception e){result.putString("error",e.toString());finish(Activity.RESULT_CANCELED,result);}}
 private void backSmoke(){Bundle result=new Bundle();try{
 Activity a=startActivitySync(getTargetContext().getPackageManager().getLaunchIntentForPackage("com.renkio.game"));WebView web=findWebView(a.getWindow().getDecorView());
 matchWait(web,"typeof document.querySelector('.bottom-nav button[data-page=messages]')?.onclick==='function'");
 for(String page:new String[]{"messages","friends","leaders","more"}){
 matchJs(web,"document.querySelector('.bottom-nav button[data-page="+page+"]').click()");matchWait(web,"document.body.dataset.page==='"+page+"'&&document.body.dataset.view==='hub'");
 sendKeyDownUpSync(android.view.KeyEvent.KEYCODE_BACK);matchWait(web,"document.body.dataset.page==='home'&&document.body.dataset.view==='home'");
 if(a.isFinishing()||!a.hasWindowFocus())throw new Exception("Exit dialog appeared before home");
 }
 sendKeyDownUpSync(android.view.KeyEvent.KEYCODE_BACK);boolean prompt=false;for(int i=0;i<20;i++){if(!a.hasWindowFocus()&&!a.isFinishing()){prompt=true;break;}Thread.sleep(100);}if(!prompt)throw new Exception("Exit prompt missing on home");sendKeyDownUpSync(android.view.KeyEvent.KEYCODE_BACK);
 result.putString("result","PASS: real Android Back returns messages, friends, leaderboard and more to home; next Back shows exit confirmation");finish(Activity.RESULT_OK,result);
 }catch(Exception e){result.putString("error",e.toString());finish(Activity.RESULT_CANCELED,result);}}
 private void identitySmoke(boolean before){Bundle result=new Bundle();try{
 Activity a=startActivitySync(getTargetContext().getPackageManager().getLaunchIntentForPackage("com.renkio.game"));WebView web=findWebView(a.getWindow().getDecorView());
 String id="";for(int i=0;i<100;i++){String raw=matchJs(web,"JSON.parse(localStorage.getItem('renkio-profile')||'null')?.id||''");id=(String)new JSONTokener(raw).nextValue();if(!id.isEmpty())break;Thread.sleep(1000);}if(id.isEmpty())throw new Exception("Guest identity did not load");
 android.content.SharedPreferences prefs=getContext().getSharedPreferences("identity-smoke",0);if(before){prefs.edit().putString("expected",id).commit();result.putString("result","PASS: pre-update guest identity saved "+id);}else{String expected=args.getString("expected",prefs.getString("expected",""));if(expected.isEmpty()||!expected.equals(id))throw new Exception("Guest identity changed: expected "+expected+", received "+id);result.putString("result","PASS: installed native update preserved guest identity "+id);}
 finish(Activity.RESULT_OK,result);
 }catch(Exception e){result.putString("error",e.toString());finish(Activity.RESULT_CANCELED,result);}}

 private void tutorialSmoke(){Bundle result=new Bundle();try{
 Activity a=startActivitySync(getTargetContext().getPackageManager().getLaunchIntentForPackage("com.renkio.game"));WebView web=findWebView(a.getWindow().getDecorView());
 matchWait(web,"typeof document.getElementById('moreRules')?.onclick==='function'&&!document.body.hasAttribute('data-starting')");
 String language=args.getString("language","tr");
 matchJs(web,"localStorage.setItem('renkio-language',"+JSONObject.quote(language)+");location.reload()");
 matchWait(web,"typeof document.getElementById('moreRules')?.onclick==='function'&&!document.body.hasAttribute('data-starting')");
 matchJs(web,"document.querySelector('dialog[open]')?.close();document.querySelector('[data-page=more]').click();document.getElementById('moreRules').click()");
 matchWait(web,"document.getElementById('guidedTutorial')?.open===true");captureMatch("tutorial-"+language+"-welcome.png");
 matchJs(web,"document.querySelector('.tutorial-welcome button').click()");
 for(int i=0;i<3;i++){
  matchWait(web,"document.getElementById('guidedTutorial').dataset.phase==='select'&&document.querySelector('.tutorial-kicker').textContent.startsWith('"+(i+1)+"')");
  matchJs(web,"document.querySelector('.tutorial-rack .tile:last-child').click()");if(!"true".equals(matchJs(web,"document.getElementById('guidedTutorial').dataset.phase==='select'")))throw new Exception("Wrong tile advanced lesson");

  if(!"true".equals(matchJs(web,"(()=>{const d=document.getElementById('guidedTutorial'),b=d.querySelector('.tutorial-play').getBoundingClientRect(),r=d.getBoundingClientRect();return d.scrollWidth<=d.clientWidth&&b.bottom<=r.bottom&&b.left>=r.left&&b.right<=r.right})()")))throw new Exception("Tutorial controls overflow phone");
  matchJs(web,"document.querySelector('.tutorial-choice').click()");captureMatch("tutorial-"+language+"-step"+(i+1)+".png");matchJs(web,"document.querySelector('.tutorial-target').click()");matchWait(web,"document.getElementById('guidedTutorial').dataset.phase==='review'");matchJs(web,"document.querySelector('.tutorial-play').click()");
 }
 matchWait(web,"document.getElementById('guidedTutorial').dataset.phase==='complete'");Thread.sleep(650);captureMatch("tutorial-"+language+"-complete.png");
 matchJs(web,"document.querySelector('.tutorial-play').click()");matchWait(web,"!document.getElementById('guidedTutorial').open");
 matchJs(web,"document.getElementById('moreRules').click();document.querySelector('.tutorial-skip').click()");matchWait(web,"!document.getElementById('guidedTutorial').open");
 matchJs(web,"localStorage.setItem('renkio-language','tr')");
 result.putString("result","PASS: three legal guided moves, wrong-choice guard, scripted bot, completion, manual replay and skip fit Android WebView; "+language+" "+matchJs(web,"innerWidth+'x'+innerHeight"));finish(Activity.RESULT_OK,result);
 }catch(Exception e){result.putString("error",e.toString());finish(Activity.RESULT_CANCELED,result);}}

 @Override public void onStart(){if("tutorial".equals(args.getString("mode"))){tutorialSmoke();return;}if("startup".equals(args.getString("mode"))){startupSmoke();return;}if("back".equals(args.getString("mode"))){backSmoke();return;}if("identity-before".equals(args.getString("mode"))){identitySmoke(true);return;}if("identity-after".equals(args.getString("mode"))){identitySmoke(false);return;}if("push".equals(args.getString("mode"))){PushSmoke.run(this);return;}if("offline".equals(args.getString("mode"))){super.onStart();return;}if("match".equals(args.getString("mode"))){matchSmoke();return;}Bundle result=new Bundle();try{
  Activity activity=startActivitySync(getTargetContext().getPackageManager().getLaunchIntentForPackage("com.renkio.game"));
  WebView web=findWebView(activity.getWindow().getDecorView());
  boolean loaded=false;for(int i=0;i<60;i++){
   CountDownLatch latch=new CountDownLatch(1);String[] value={""};runOnMainSync(()->web.evaluateJavascript("JSON.stringify({ready:typeof document.querySelector('#create')?.onclick==='function',title:document.title,hint:!!document.querySelector('#hint:not(.hidden)')})",v->{value[0]=v;latch.countDown();}));latch.await(2,TimeUnit.SECONDS);
   if(value[0].contains("ready\\\":true")&&value[0].contains("hint\\\":false")){loaded=true;break;}Thread.sleep(1000);
  }if(!loaded)throw new Exception("Updated WebView interface did not load");
  String room=args.getString("room");JSONObject joined=post("join",new JSONObject().put("room",room).put("name","Android QA"));String token=joined.getString("token");JSONObject state=null;
  for(int i=0;i<60;i++){state=post("state",auth(room,token));if(state.has("game")&&!state.isNull("game")&&state.getJSONObject("game").getInt("turn")==1)break;Thread.sleep(500);}
  JSONObject game=state.getJSONObject("game");if(game.getInt("turn")!=1)throw new Exception("Android turn never arrived");JSONArray players=game.getJSONArray("players");if(players.getJSONObject(0).has("hand"))throw new Exception("Opponent hand exposed");JSONArray hand=players.getJSONObject(1).getJSONArray("hand");JSONObject action=auth(room,token).put("revision",game.getInt("revision"));
  if(game.getJSONObject("board").length()==0)action.put("action","play").put("placements",opening(hand));else action.put("action","exchange").put("ids",new JSONArray().put(hand.getJSONObject(0).getString("id")));
  JSONObject played=post("action",action).getJSONObject("game");if(played.getInt("revision")!=game.getInt("revision")+1)throw new Exception("Revision did not advance");
  result.putString("result","PASS: WebView loaded without hints; Android joined desktop room; private hands and turn action verified");result.putInt("revision",played.getInt("revision"));finish(Activity.RESULT_OK,result);
 }catch(Exception e){result.putString("error",e.toString());finish(Activity.RESULT_CANCELED,result);}}
 private String matchJs(WebView web,String script)throws Exception{CountDownLatch latch=new CountDownLatch(1);String[] value={""};runOnMainSync(()->web.evaluateJavascript(script,v->{value[0]=v;latch.countDown();}));if(!latch.await(15,TimeUnit.SECONDS))throw new Exception("WebView timeout");return value[0];}
 private void matchWait(WebView web,String condition)throws Exception{for(int i=0;i<180;i++){if("true".equals(matchJs(web,condition)))return;Thread.sleep(500);}throw new Exception("Match UI timeout: "+condition);}
 private void captureMatch(String name)throws Exception{dismissSystemWait();android.graphics.Bitmap b=getUiAutomation().takeScreenshot();try(java.io.FileOutputStream out=new java.io.FileOutputStream(new java.io.File(getTargetContext().getExternalFilesDir(null),name))){b.compress(android.graphics.Bitmap.CompressFormat.PNG,100,out);}b.recycle();}
 private void matchSmoke(){Bundle result=new Bundle();try{dismissSystemWait();
  Activity activity=startActivitySync(getTargetContext().getPackageManager().getLaunchIntentForPackage("com.renkio.game"));WebView web=findWebView(activity.getWindow().getDecorView());
  matchWait(web,"typeof document.getElementById('findMatch')?.onclick==='function'&&document.getElementById('name').value.startsWith('Player ')");captureMatch("store-menu.png");
  matchJs(web,"document.getElementById('findMatch').click()");matchWait(web,"document.getElementById('matchDialog').open");captureMatch("store-search.png");
  matchJs(web,"document.getElementById('cancelMatch').click()");matchWait(web,"!document.getElementById('matchDialog').open&&!document.getElementById('findMatch').disabled");
  matchJs(web,"document.getElementById('findMatch').click()");matchWait(web,"document.getElementById('matchDialog').open");Bundle progress=new Bundle();progress.putString("stage","searching");sendStatus(1,progress);
  matchWait(web,"document.body.dataset.view==='game'&&!document.getElementById('connection').classList.contains('offline')");
  if(!"true".equals(matchJs(web,"document.getElementById('rack').children.length===6&&document.documentElement.scrollWidth<=innerWidth&&document.getElementById('gameCode').classList.contains('hidden')")))throw new Exception("Match UI or hand regression");
  String serialized=(String)new JSONTokener(matchJs(web,"sessionStorage.getItem('renkio-session')")).nextValue();JSONObject auth=new JSONObject(serialized),state=null;
  for(int i=0;i<120;i++){state=post("state",auth);if(state.getJSONObject("game").getInt("turn")==state.getInt("me"))break;Thread.sleep(500);}
  JSONObject game=state.getJSONObject("game");int me=state.getInt("me");if(game.getInt("turn")!=me)throw new Exception("Native turn did not arrive");JSONArray players=game.getJSONArray("players");if(players.getJSONObject(1-me).has("hand"))throw new Exception("Opponent hand exposed");JSONArray hand=players.getJSONObject(me).getJSONArray("hand");JSONObject action=new JSONObject(auth.toString()).put("revision",game.getInt("revision"));
  if(game.getJSONObject("board").length()==0)action.put("action","play").put("placements",opening(hand));else action.put("action","exchange").put("ids",new JSONArray().put(hand.getJSONObject(0).getString("id")));
  post("action",action);matchWait(web,"!document.getElementById('lastMove').classList.contains('hidden')");captureMatch("store-match.png");
  result.putString("result","PASS: release WebView Firebase guest ID, cancel and requeue, Android/browser matchmaking, private hands, live turn synchronization and compact layout");finish(Activity.RESULT_OK,result);
 }catch(Exception e){result.putString("error",e.toString());finish(Activity.RESULT_CANCELED,result);}}

}

