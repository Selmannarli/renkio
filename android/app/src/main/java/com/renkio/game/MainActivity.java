package com.renkio.game;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.Vibrator;
import android.os.VibrationEffect;
import android.media.AudioManager;
import android.media.ToneGenerator;
import android.os.Build;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.*;
import android.widget.*;
import java.io.*;
import java.util.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import org.json.*;
import android.util.Base64;
import java.util.concurrent.atomic.AtomicBoolean;

public final class MainActivity extends Activity {
 private static final String HOST="renkio.onrender.com", HOME="https://"+HOST+"/";
 private NativeAccounts nativeAccounts;private boolean restoringIdentity=false;private String restoreOrigin=null;private volatile boolean applyRequested=false;private volatile File activeClient;private ClientStore clientStore;private final AtomicBoolean checking=new AtomicBoolean();private boolean foreground=false;private final Handler uiHandler=new Handler(Looper.getMainLooper());private ValueCallback<Uri[]> photoCallback; private WebView web; private FrameLayout frame; private ProgressBar progress;
 private boolean trusted(Uri uri){return "https".equals(uri.getScheme())&&HOST.equals(uri.getHost())&&(uri.getPort()==-1||uri.getPort()==443);}
 private boolean page(Uri uri){String p=uri.getPath();return trusted(uri)&&(p.equals("/")||p.equals("/index.html")||p.equals("/privacy.html"));}
 public final class NativeUi {
  @JavascriptInterface public int accountProtocol(){return 2;}
  @JavascriptInterface public void accountRequest(String id,String action,String raw){if(id==null||!id.matches("[A-Za-z0-9-]{8,80}")||raw==null||raw.length()>40000)return;runOnUiThread(()->{if(web==null||!trusted(Uri.parse(web.getUrl()==null?HOME:web.getUrl())))return;try{nativeAccounts.request(id,action,new JSONObject(raw));}catch(Exception ignored){}});}

  @JavascriptInterface public String legacyIdentity(){return getSharedPreferences("identity-transfer",MODE_PRIVATE).getString("pending","");}
  @JavascriptInterface public void identityRestored(){getSharedPreferences("identity-transfer",MODE_PRIVATE).edit().remove("pending").putBoolean("done",true).apply();}
  @JavascriptInterface public void acceptIdentity(String raw){if(!restoringIdentity||raw==null||raw.length()>500000)return;try{JSONObject data=new JSONObject(raw);if(data.optString("refreshToken").length()<20)return;getSharedPreferences("identity-transfer",MODE_PRIVATE).edit().putString("pending",data.toString()).apply();runOnUiThread(()->finishIdentityRestore());}catch(Exception ignored){}}

  @JavascriptInterface public void shareGame(String value){runOnUiThread(()->{try{Uri link=Uri.parse(value);if(!foreground||!trusted(link)||!"/".equals(link.getPath())||!link.getQueryParameter("room").matches("[A-F0-9]{6}"))return;Intent send=new Intent(Intent.ACTION_SEND);send.setType("text/plain");send.putExtra(Intent.EXTRA_TEXT,"Renkio’da birlikte oynayalım.\n"+link.toString());startActivity(Intent.createChooser(send,"Oyuna davet et"));}catch(RuntimeException ignored){}});}

  @JavascriptInterface public String pushState(){try{JSONObject value=new JSONObject();boolean granted=Build.VERSION.SDK_INT<33||checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)==android.content.pm.PackageManager.PERMISSION_GRANTED;value.put("asked",getSharedPreferences("push",MODE_PRIVATE).getBoolean("permissionAsked",false));value.put("allowed",granted&&getSystemService(android.app.NotificationManager.class).areNotificationsEnabled());value.put("enabled",getSharedPreferences("push",MODE_PRIVATE).getBoolean("enabled",false));value.put("token",getSharedPreferences("push",MODE_PRIVATE).getString("token",""));return value.toString();}catch(Exception ignored){return "{}";}}
  @JavascriptInterface public void notificationPreferences(boolean audio,boolean haptics){getSharedPreferences("push",MODE_PRIVATE).edit().putBoolean("audio",audio).putBoolean("haptics",haptics).apply();}
  @JavascriptInterface public void enableNotifications(){runOnUiThread(()->{if(!foreground)return;if(Build.VERSION.SDK_INT>=33&&checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)!=android.content.pm.PackageManager.PERMISSION_GRANTED)requestPermissions(new String[]{android.Manifest.permission.POST_NOTIFICATIONS},402);else enablePush();});}
  @JavascriptInterface public void disconnectPush(){getSharedPreferences("push",MODE_PRIVATE).edit().putBoolean("enabled",false).remove("token").apply();com.google.firebase.messaging.FirebaseMessaging.getInstance().setAutoInitEnabled(false);com.google.firebase.messaging.FirebaseMessaging.getInstance().deleteToken();}
  @JavascriptInterface public void disableNotifications(){getSharedPreferences("push",MODE_PRIVATE).edit().putBoolean("enabled",false).apply();com.google.firebase.messaging.FirebaseMessaging.getInstance().setAutoInitEnabled(false);}

  @JavascriptInterface public void refresh(){runOnUiThread(()->{if(clientStore!=null){updateStatus("current");if(foreground)checkClient(true);}});}

  @JavascriptInterface public void notifyEvent(String kind,boolean audio,boolean haptics){if(!"turn".equals(kind)&&!"message".equals(kind))return;runOnUiThread(()->{if(!foreground)return;boolean turn="turn".equals(kind);if(audio){try{ToneGenerator tone=new ToneGenerator(AudioManager.STREAM_NOTIFICATION,55);tone.startTone(turn?ToneGenerator.TONE_PROP_ACK:ToneGenerator.TONE_PROP_BEEP,turn?240:130);uiHandler.postDelayed(tone::release,400);}catch(RuntimeException ignored){}}if(haptics){Vibrator vibrator=(Vibrator)getSystemService(VIBRATOR_SERVICE);if(vibrator!=null&&vibrator.hasVibrator())vibrator.vibrate(VibrationEffect.createWaveform(turn?new long[]{0,90,70,90}:new long[]{0,55},-1));}});}

  @JavascriptInterface public void theme(String theme){runOnUiThread(()->{
   boolean dark="night".equals(theme);int color=Color.parseColor(dark?"#111827":"#f5f6fa");frame.setBackgroundColor(color);web.setBackgroundColor(color);
   if(Build.VERSION.SDK_INT>=30){getWindow().getInsetsController().setSystemBarsAppearance(dark?0:android.view.WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS|android.view.WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS,android.view.WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS|android.view.WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS);}
   else getWindow().getDecorView().setSystemUiVisibility(dark?0:View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR|View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
   getWindow().setStatusBarColor(color);getWindow().setNavigationBarColor(color);
  });}
 }
 private void finishIdentityRestore(){if(!restoringIdentity)return;restoringIdentity=false;restoreOrigin=null;Uri link=getIntent().getData();web.loadUrl(link!=null&&page(link)?link.toString():HOME);if(clientStore!=null)checkClient(true);}
 private void startIdentityRestore(){restoringIdentity=true;if(getSharedPreferences("identity-transfer",MODE_PRIVATE).getBoolean("done",false)||!getSharedPreferences("identity-transfer",MODE_PRIVATE).getString("pending","").isEmpty()){finishIdentityRestore();return;}
  WebStorage.getInstance().getOrigins(origins->{if(!restoringIdentity)return;for(Object storedOrigin:origins.keySet()){String origin=String.valueOf(storedOrigin);Uri parsed=Uri.parse(origin);if("https".equals(parsed.getScheme())&&parsed.getHost()!=null&&parsed.getHost().endsWith(".onrender.com")&&!HOST.equals(parsed.getHost())){restoreOrigin=origin;break;}}if(restoreOrigin==null){File directory=new File(getApplicationInfo().dataDir,"app_webview/Default/IndexedDB");String[] names=directory.list();if(names!=null)for(String name:names){java.util.regex.Matcher match=java.util.regex.Pattern.compile("https_([A-Za-z0-9.-]+)_0[.]indexeddb[.]leveldb").matcher(name);if(match.matches()&&match.group(1).endsWith(".onrender.com")&&!HOST.equals(match.group(1))){restoreOrigin="https://"+match.group(1);break;}}}if(restoreOrigin==null){finishIdentityRestore();return;}
   String html="<!doctype html><meta name=viewport content='width=device-width'><body style='background:#21172f;color:#eee;font-family:sans-serif;padding:24px'>Renkio<script>const request=indexedDB.open('firebaseLocalStorageDb');request.onupgradeneeded=()=>request.transaction.abort();request.onsuccess=()=>{const db=request.result;if(!db.objectStoreNames.contains('firebaseLocalStorage'))return;const all=db.transaction('firebaseLocalStorage').objectStore('firebaseLocalStorage').getAll();all.onsuccess=()=>{const row=all.result.find(r=>r.value?.stsTokenManager?.refreshToken);if(row){const storage={};let bytes=0;for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i),v=localStorage.getItem(k);if(k.startsWith('renkio-')&&v.length<100000&&bytes+v.length<350000){storage[k]=v;bytes+=v.length}}RenkioNative.acceptIdentity(JSON.stringify({refreshToken:row.value.stsTokenManager.refreshToken,storage}))}}};</script>";
   web.loadDataWithBaseURL(restoreOrigin+"/",html,"text/html","UTF-8",null);uiHandler.postDelayed(()->finishIdentityRestore(),5000);
  });uiHandler.postDelayed(()->finishIdentityRestore(),7000);
 }
 private WebResourceResponse asset(WebResourceRequest request){
  Uri uri=request.getUrl();if(!trusted(uri)||!"GET".equals(request.getMethod())||uri.getPath().startsWith("/api/"))return null;
  String path=uri.getPath().equals("/")?"index.html":uri.getPath().substring(1);
  if(path.contains("..")||path.contains("\\"))return missing();
  String mime=path.endsWith(".html")?"text/html":path.endsWith(".mjs")?"text/javascript":path.endsWith(".css")?"text/css":path.endsWith(".svg")?"image/svg+xml":path.endsWith(".woff2")?"font/woff2":path.endsWith(".png")?"image/png":path.endsWith(".webp")?"image/webp":"application/octet-stream";
  try{File snapshot=activeClient;InputStream stream=snapshot==null?getAssets().open("game/"+path):clientStore.openVerified(snapshot,path);Map<String,String> headers=new HashMap<>();headers.put("Cache-Control","no-store");headers.put("X-Content-Type-Options","nosniff");headers.put("Content-Security-Policy","default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.googleusercontent.com; connect-src 'self' https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://renkio.firebaseapp.com; frame-src https://renkio.firebaseapp.com; base-uri 'none'; form-action 'self'");return new WebResourceResponse(mime,"UTF-8",200,"OK",headers,stream);}catch(IOException e){if(activeClient!=null)runOnUiThread(()->{if(activeClient!=null){activeClient=null;getSharedPreferences("client-runtime",MODE_PRIVATE).edit().remove("revision").apply();if(web!=null&&!isFinishing())web.loadUrl(HOME);}});return missing();}
 }
 private WebResourceResponse missing(){return new WebResourceResponse("text/plain","UTF-8",404,"Not Found",Collections.emptyMap(),new ByteArrayInputStream(new byte[0]));}
 private void updateStatus(String status){if(web!=null&&!isFinishing())web.evaluateJavascript("window.dispatchEvent(new CustomEvent('renkio-update',{detail:"+JSONObject.quote(status)+"}))",null);}
 private void activateClient(File installed){if(installed==null||web==null||isFinishing())return;if(installed.equals(activeClient)){updateStatus("current");return;}web.evaluateJavascript("document.body.hasAttribute('data-starting')&&document.body.dataset.view==='home'",home->{if("true".equals(home)){activeClient=installed;web.loadUrl(HOME);}else updateStatus("saved");applyRequested=false;});}
 private boolean compatibleClient(File file){android.content.SharedPreferences p=getSharedPreferences("client-runtime",MODE_PRIVATE);return file!=null&&p.getInt("nativeVersion",0)==BuildConfig.VERSION_CODE&&file.getName().equals(p.getString("revision",""));}
 private void recordClient(File file){getSharedPreferences("client-runtime",MODE_PRIVATE).edit().putInt("nativeVersion",BuildConfig.VERSION_CODE).putString("revision",file.getName()).apply();}
 private byte[] updateData(String endpoint,int limit,long deadline)throws IOException{
  long remaining=deadline-android.os.SystemClock.elapsedRealtime();if(remaining<=0)throw new IOException("Update deadline");HttpURLConnection connection=(HttpURLConnection)new URL(HOME+endpoint).openConnection();connection.setInstanceFollowRedirects(false);connection.setConnectTimeout((int)Math.min(8000,remaining));connection.setReadTimeout((int)Math.min(10000,remaining));
  try{if(connection.getResponseCode()!=200)throw new IOException("Update unavailable");ByteArrayOutputStream out=new ByteArrayOutputStream();try(InputStream in=connection.getInputStream()){byte[] buffer=new byte[16384];int n;while((n=in.read(buffer))!=-1){if(android.os.SystemClock.elapsedRealtime()>deadline||out.size()+n>limit)throw new IOException("Update limit");out.write(buffer,0,n);}}return out.toByteArray();}finally{connection.disconnect();}
 }
 private void checkClient(boolean requested){
  if(requested){applyRequested=true;updateStatus("current");}
  if(!checking.compareAndSet(false,true))return;
  new Thread(()->{try{
   final long deadline=android.os.SystemClock.elapsedRealtime()+30000;
   JSONObject manifest=new JSONObject(new String(updateData("api/client-manifest",65536,deadline),StandardCharsets.UTF_8));if(manifest.optInt("accountProtocol",0)!=2){runOnUiThread(()->{updateStatus("current");applyRequested=false;});return;}if(manifest.getInt("format")!=2)throw new IOException("Unsupported manifest");final String revision=manifest.getString("revision");if(!revision.matches("[a-f0-9]{64}"))throw new IOException("Invalid revision");
   final File previous=clientStore.current();if(previous!=null&&previous.getName().equals(revision)){recordClient(previous);runOnUiThread(()->{if(applyRequested)activateClient(previous);applyRequested=false;});return;}
   JSONArray files=manifest.getJSONArray("files");List<ClientUpdatePlan.Spec> specs=new ArrayList<>();for(int i=0;i<files.length();i++){JSONObject entry=files.getJSONObject(i);specs.add(new ClientUpdatePlan.Spec(entry.getString("path"),entry.getString("sha256"),entry.getLong("size")));}
   ClientUpdatePlan.Result plan=ClientUpdatePlan.assemble(specs,new ClientUpdatePlan.Source(){public byte[] local(String name)throws IOException{if(compatibleClient(previous))return java.nio.file.Files.readAllBytes(new File(previous,name).toPath());try(InputStream in=getAssets().open("game/"+name);ByteArrayOutputStream out=new ByteArrayOutputStream()){byte[] b=new byte[16384];int n;while((n=in.read(b))!=-1){if(out.size()+n>5*1024*1024)throw new IOException("Asset too large");out.write(b,0,n);}return out.toByteArray();}}public byte[] download(String name)throws IOException{return updateData("api/client-file?revision="+revision+"&path="+Uri.encode(name),5*1024*1024,deadline);}});
   if(previous==null&&plan.downloads==0){runOnUiThread(()->{updateStatus("current");applyRequested=false;});return;}
   File installed=clientStore.install(revision,plan.entries);recordClient(installed);runOnUiThread(()->{if(web==null||isFinishing())return;boolean apply=applyRequested;applyRequested=false;if(apply)activateClient(installed);else updateStatus("saved");});
  }catch(Exception error){runOnUiThread(()->{updateStatus("current");applyRequested=false;});}finally{checking.set(false);}},"Renkio-client-update").start();
 }

 @Override protected void onResume(){super.onResume();foreground=true;RenkioApplication.foreground=true;if(getSharedPreferences("push",MODE_PRIVATE).getBoolean("enabled",false))enablePush();}
 @Override protected void onPause(){foreground=false;RenkioApplication.foreground=false;super.onPause();}
 private void pushEvent(){if(web!=null&&trusted(Uri.parse(web.getUrl()==null?HOME:web.getUrl())))web.evaluateJavascript("window.dispatchEvent(new Event('renkio-push-state'))",null);}
 private void enablePush(){getSharedPreferences("push",MODE_PRIVATE).edit().putBoolean("enabled",true).apply();com.google.firebase.messaging.FirebaseMessaging.getInstance().setAutoInitEnabled(true);com.google.firebase.messaging.FirebaseMessaging.getInstance().getToken().addOnSuccessListener(token->{getSharedPreferences("push",MODE_PRIVATE).edit().putString("token",token).apply();pushEvent();}).addOnFailureListener(e->pushEvent());}
 @Override public void onRequestPermissionsResult(int requestCode,String[] permissions,int[] grantResults){super.onRequestPermissionsResult(requestCode,permissions,grantResults);if(requestCode==402){if(grantResults.length>0&&grantResults[0]==android.content.pm.PackageManager.PERMISSION_GRANTED)enablePush();else pushEvent();}}
 @Override public void onCreate(Bundle state){super.onCreate(state);
  try{clientStore=new ClientStore(new File(getFilesDir(),"client-snapshots"));File candidate=clientStore.currentHeader();activeClient=compatibleClient(candidate)&&new String(java.nio.file.Files.readAllBytes(new File(candidate,"firebase-config.mjs").toPath()),StandardCharsets.UTF_8).contains("renkio.firebaseapp.com")?candidate:null;}catch(IOException error){activeClient=null;}
  frame=new FrameLayout(this);frame.setBackgroundColor(Color.parseColor("#f5f6fa"));setContentView(frame);
  frame.setOnApplyWindowInsetsListener((v,insets)->{if(Build.VERSION.SDK_INT>=30){android.graphics.Insets bars=insets.getInsets(WindowInsets.Type.systemBars()|WindowInsets.Type.displayCutout()|WindowInsets.Type.ime());v.setPadding(bars.left,bars.top,bars.right,bars.bottom);}else v.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());return insets;});
  WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);web=new WebView(this);frame.addView(web,new FrameLayout.LayoutParams(-1,-1));
  nativeAccounts=new NativeAccounts(this,(id,value,code,message)->runOnUiThread(()->{if(web==null||isFinishing()||!trusted(Uri.parse(web.getUrl()==null?HOME:web.getUrl())))return;try{JSONObject result=new JSONObject().put("id",id);if(code!=null)result.put("error",new JSONObject().put("code",code).put("message",message));else result.put("value",value);web.evaluateJavascript("window.dispatchEvent(new CustomEvent('renkio-account-result',{detail:"+result.toString()+"}))",null);}catch(Exception ignored){}}));
  WebSettings settings=web.getSettings();settings.setTextZoom(100);settings.setUseWideViewPort(true);settings.setLoadWithOverviewMode(true);settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(true);settings.setAllowFileAccess(false);settings.setAllowContentAccess(false);settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);settings.setMediaPlaybackRequiresUserGesture(true);settings.setSafeBrowsingEnabled(true);settings.setSupportMultipleWindows(false);web.addJavascriptInterface(new NativeUi(),"RenkioNative");
  progress=new ProgressBar(this,null,android.R.attr.progressBarStyleHorizontal);frame.addView(progress,new FrameLayout.LayoutParams(-1,4));
  web.setWebChromeClient(new WebChromeClient(){@Override public boolean onShowFileChooser(WebView view,ValueCallback<Uri[]> callback,FileChooserParams params){if(photoCallback!=null)photoCallback.onReceiveValue(null);photoCallback=callback;Intent pick=new Intent(Intent.ACTION_OPEN_DOCUMENT);pick.setType("image/*");pick.addCategory(Intent.CATEGORY_OPENABLE);try{startActivityForResult(pick,301);}catch(Exception error){photoCallback.onReceiveValue(null);photoCallback=null;}return true;}@Override public void onProgressChanged(WebView view,int value){progress.setProgress(value);progress.setVisibility(value==100?View.GONE:View.VISIBLE);}});
  web.setWebViewClient(new WebViewClient(){
   @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request){return asset(request);}
   @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){Uri uri=request.getUrl();if(page(uri))return false;if("https".equals(uri.getScheme())||"mailto".equals(uri.getScheme()))try{startActivity(new Intent(Intent.ACTION_VIEW,uri));}catch(Exception ignored){}return true;}
   @Override public void onPageFinished(WebView view,String url){if(trusted(Uri.parse(url)))view.evaluateJavascript("(()=>{const sync=()=>RenkioNative.theme(document.body.dataset.theme||'day');sync();new MutationObserver(sync).observe(document.body,{attributes:true,attributeFilter:['data-theme']})})()",null);}
   @Override public boolean onRenderProcessGone(WebView view,RenderProcessGoneDetail detail){frame.removeView(view);view.destroy();new AlertDialog.Builder(MainActivity.this).setMessage("Oyun yeniden açılsın mı?").setPositiveButton("Yeniden aç",(d,w)->recreate()).setNegativeButton("Kapat",(d,w)->finish()).setCancelable(false).show();return true;}
  });
  startIdentityRestore();
  if(!getSharedPreferences("push",MODE_PRIVATE).getBoolean("permissionAsked",false)){getSharedPreferences("push",MODE_PRIVATE).edit().putBoolean("permissionAsked",true).apply();if(Build.VERSION.SDK_INT>=33&&checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)!=android.content.pm.PackageManager.PERMISSION_GRANTED)requestPermissions(new String[]{android.Manifest.permission.POST_NOTIFICATIONS},402);else enablePush();}
 }
 @Override protected void onActivityResult(int request,int result,Intent data){super.onActivityResult(request,result,data);if(request==301&&photoCallback!=null){photoCallback.onReceiveValue(result==RESULT_OK&&data!=null&&data.getData()!=null?new Uri[]{data.getData()}:null);photoCallback=null;}}
 @Override protected void onNewIntent(Intent intent){super.onNewIntent(intent);setIntent(intent);Uri link=intent.getData();if(link!=null&&page(link))web.loadUrl(link.toString());}
 @Override protected void onSaveInstanceState(Bundle state){web.saveState(state);super.onSaveInstanceState(state);}
 @Override public void onBackPressed(){web.evaluateJavascript("(()=>{const d=document.querySelector('dialog[open]');if(d){if(d.id==='matchDialog')document.getElementById('cancelMatch').click();else d.close();return 'handled'}if(document.body.dataset.view&&document.body.dataset.view!=='home'){document.getElementById('leave').click();return 'handled'}return document.body.dataset.view==='home'?'home':'page'})()",result->{if("\"page\"".equals(result)&&web.canGoBack())web.goBack();else if("\"home\"".equals(result)||"\"page\"".equals(result))new AlertDialog.Builder(this).setMessage("Renkio kapatılsın mı?").setNegativeButton("Oyunda kal",null).setPositiveButton("Kapat",(d,w)->finish()).show();});}
 @Override protected void onDestroy(){uiHandler.removeCallbacksAndMessages(null);if(photoCallback!=null){photoCallback.onReceiveValue(null);photoCallback=null;}if(web!=null){web.removeJavascriptInterface("RenkioNative");web.destroy();}super.onDestroy();}
}
