package com.renkio.game;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.MessageDigest;
import java.util.*;

/** Complete immutable client snapshots; the current pointer changes only after validation. */
public final class ClientStore {
 public static final class Entry {
  public final String path,hash; public final byte[] data;
  public Entry(String path,String hash,byte[] data){this.path=path;this.hash=hash;this.data=data;}
 }
 private final File root;
 public ClientStore(File root)throws IOException{this.root=root;if(!root.isDirectory()&&!root.mkdirs())throw new IOException("Client storage unavailable");}
 public static boolean allowed(String path){return path!=null&&(path.matches("[A-Za-z0-9_-]+\\.(html|mjs|css|svg)")||path.matches("assets/[A-Za-z0-9_-]+\\.(png|webp|woff2|txt)"));}
 public static String hash(byte[] data)throws IOException{try{byte[] digest=MessageDigest.getInstance("SHA-256").digest(data);StringBuilder s=new StringBuilder();for(byte b:digest)s.append(String.format(Locale.ROOT,"%02x",b&255));return s.toString();}catch(Exception e){throw new IOException(e);}}
 private static void move(File from,File to)throws IOException{try{Files.move(from.toPath(),to.toPath(),StandardCopyOption.ATOMIC_MOVE,StandardCopyOption.REPLACE_EXISTING);}catch(AtomicMoveNotSupportedException e){Files.move(from.toPath(),to.toPath(),StandardCopyOption.REPLACE_EXISTING);}}
 private final Map<String,Map<String,String>> manifests=new HashMap<>();
 private synchronized Map<String,String> checkedManifest(File dir)throws IOException{
  Map<String,String> cached=manifests.get(dir.getName());if(cached!=null)return cached;File marker=new File(dir,"complete");if(marker.length()>20000)throw new IOException("Invalid manifest");Map<String,String> files=new HashMap<>();List<String> digest=new ArrayList<>();for(String line:Files.readAllLines(marker.toPath(),StandardCharsets.UTF_8)){String[] p=line.split(" ",2);if(p.length!=2||!p[0].matches("[a-f0-9]{64}")||!allowed(p[1])||files.put(p[1],p[0])!=null||files.size()>100)throw new IOException("Invalid manifest");digest.add(p[1]+":"+p[0]);}if(!files.keySet().containsAll(Arrays.asList("index.html","app.mjs","engine.mjs","board.mjs","ui.mjs","style.css")))throw new IOException("Incomplete manifest");Collections.sort(digest);if(!hash(String.join("\n",digest).getBytes(StandardCharsets.UTF_8)).equals(dir.getName()))throw new IOException("Invalid manifest revision");Map<String,String> result=Collections.unmodifiableMap(files);manifests.put(dir.getName(),result);return result;
 }
 /** Resolve only the small, authenticated manifest on the UI thread. */
 public synchronized File currentHeader(){try{String revision=new String(Files.readAllBytes(new File(root,"active").toPath()),StandardCharsets.UTF_8).trim();if(!revision.matches("[a-f0-9]{64}"))return null;File dir=new File(root,revision);checkedManifest(dir);return dir;}catch(IOException error){return null;}}
 /** WebView calls this on its request worker; no bytes execute before verification. */
 public InputStream openVerified(File dir,String path)throws IOException{String expected=checkedManifest(dir).get(path);if(expected==null)throw new IOException("File not in manifest");File file=new File(dir,path);if(file.length()>5*1024*1024)throw new IOException("File too large");byte[] bytes=Files.readAllBytes(file.toPath());if(!hash(bytes).equals(expected))throw new IOException("File integrity error");return new ByteArrayInputStream(bytes);}
 public synchronized File current(){try{String revision=new String(Files.readAllBytes(new File(root,"active").toPath()),StandardCharsets.UTF_8).trim();if(!revision.matches("[a-f0-9]{64}"))return null;File dir=new File(root,revision);return valid(dir)?dir:null;}catch(IOException e){return null;}}
 public static boolean valid(File dir){try{List<String> lines=Files.readAllLines(new File(dir,"complete").toPath(),StandardCharsets.UTF_8);Set<String> names=new HashSet<>();for(String line:lines){String[] p=line.split(" ",2);if(p.length!=2||!p[0].matches("[a-f0-9]{64}")||!allowed(p[1])||!names.add(p[1])||!hash(Files.readAllBytes(new File(dir,p[1]).toPath())).equals(p[0]))return false;}return names.containsAll(Arrays.asList("index.html","app.mjs","engine.mjs","board.mjs","ui.mjs","style.css"));}catch(IOException e){return false;}}
 public synchronized File install(String revision,List<Entry> entries)throws IOException{
  if(!revision.matches("[a-f0-9]{64}")||entries.size()>100)throw new IOException("Invalid client revision");
  List<String> manifest=new ArrayList<>();Set<String> paths=new HashSet<>();long total=0;
  for(Entry entry:entries){if(!allowed(entry.path)||!paths.add(entry.path)||entry.data.length>5*1024*1024||(total+=entry.data.length)>12*1024*1024||!hash(entry.data).equals(entry.hash))throw new IOException("Client validation failed");manifest.add(entry.hash+" "+entry.path);}
  if(!paths.containsAll(Arrays.asList("index.html","app.mjs","engine.mjs","board.mjs","ui.mjs","style.css")))throw new IOException("Incomplete client");
  List<String> digestLines=new ArrayList<>();for(Entry entry:entries)digestLines.add(entry.path+":"+entry.hash);Collections.sort(digestLines);if(!hash(String.join("\n",digestLines).getBytes(StandardCharsets.UTF_8)).equals(revision))throw new IOException("Client revision mismatch");
  File target=new File(root,revision),previous=current();
  if(!valid(target)){
   if(target.exists())erase(target);
   File stage=new File(root,"stage-"+UUID.randomUUID());if(!stage.mkdirs())throw new IOException("Cannot stage update");
   try{for(Entry entry:entries){File file=new File(stage,entry.path),parent=file.getParentFile();if(!parent.isDirectory()&&!parent.mkdirs())throw new IOException("Cannot create asset folder");Files.write(file.toPath(),entry.data);}Files.write(new File(stage,"complete").toPath(),manifest,StandardCharsets.UTF_8);if(!valid(stage))throw new IOException("Incomplete update");move(stage,target);}finally{if(stage.exists())erase(stage);}
  }
  File pointer=new File(root,"active-next");Files.write(pointer.toPath(),revision.getBytes(StandardCharsets.UTF_8));move(pointer,new File(root,"active"));
  // Keep the preceding complete snapshot for a page that is still using it.
  File[] old=root.listFiles();if(old!=null)for(File file:old)if(file.isDirectory()&&!file.equals(target)&&!file.equals(previous)&&file.getName().matches("[a-f0-9]{64}|stage-[a-f0-9-]+"))erase(file);
  return target;
 }
 private void erase(File file)throws IOException{String base=root.getCanonicalPath()+File.separator;if(!file.getCanonicalPath().startsWith(base))throw new IOException("Invalid cache path");if(file.isDirectory()){File[] children=file.listFiles();if(children!=null)for(File child:children)erase(child);}if(!file.delete()&&file.exists())throw new IOException("Cannot clean update");}
}
