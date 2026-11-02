package com.renkio.game;
import java.io.*;import java.util.*;
/** Reuses only hash-verified local files; never commits a partial update. */
public final class ClientUpdatePlan {
 public static final class Spec {public final String path,hash;public final long size;public Spec(String path,String hash,long size){this.path=path;this.hash=hash;this.size=size;}}
 public interface Source {byte[] local(String path)throws IOException;byte[] download(String path)throws IOException;}
 public static final class Result {public final List<ClientStore.Entry> entries;public final int downloads;public final long bytes;Result(List<ClientStore.Entry> entries,int downloads,long bytes){this.entries=entries;this.downloads=downloads;this.bytes=bytes;}}
 public static Result assemble(List<Spec> specs,Source source)throws IOException{
  if(specs.size()>100)throw new IOException("Invalid manifest");Set<String> paths=new HashSet<>();long total=0,bytes=0;int downloads=0;List<ClientStore.Entry> entries=new ArrayList<>();
  for(Spec spec:specs){if(!ClientStore.allowed(spec.path)||!paths.add(spec.path)||!spec.hash.matches("[a-f0-9]{64}")||spec.size<0||spec.size>5*1024*1024||(total+=spec.size)>12*1024*1024)throw new IOException("Invalid manifest file");byte[] data=null;try{data=source.local(spec.path);}catch(IOException ignored){}if(data==null||data.length!=spec.size||!ClientStore.hash(data).equals(spec.hash)){data=source.download(spec.path);downloads++;bytes+=data.length;}if(data.length!=spec.size||!ClientStore.hash(data).equals(spec.hash))throw new IOException("Invalid update file");entries.add(new ClientStore.Entry(spec.path,spec.hash,data));}
  return new Result(entries,downloads,bytes);
 }
}
