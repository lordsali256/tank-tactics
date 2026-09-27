package com.tanktactics.promptarena;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.content.Context;
import org.json.JSONObject;
import java.io.File;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
public class PhoneAI {
 private static boolean loaded=false;static{try{System.loadLibrary("tank_ai");loaded=true;}catch(UnsatisfiedLinkError e){}}
 private final File model;private final WebView web;private final ExecutorService worker=Executors.newSingleThreadExecutor();
 public PhoneAI(Context context,WebView view){model=new File(context.getFilesDir(),"qwen-phone.gguf");web=view;}
 private static native String infer(String path,String instruction);
 @JavascriptInterface public boolean available(){return loaded&&model.isFile();}
 @JavascriptInterface public String modelName(){return "Qwen2.5-0.5B-Instruct Q4_K_M · On this phone";}
 private void progress(String text){web.post(()->web.evaluateJavascript("window.onPhoneDownload&&window.onPhoneDownload("+JSONObject.quote(text)+")",null));}
 @JavascriptInterface public void installModel(){worker.execute(()->{
  if(available()){progress("Phone model ready");return;}
  File temp=new File(model.getParentFile(),"qwen-download.tmp");
  try{
   java.net.HttpURLConnection connection=(java.net.HttpURLConnection)new java.net.URL("https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf").openConnection();
   connection.setConnectTimeout(30000);connection.setReadTimeout(30000);
   java.security.MessageDigest hash=java.security.MessageDigest.getInstance("SHA-256");long total=0;int last=-1;
   try(java.io.InputStream in=connection.getInputStream();java.io.FileOutputStream out=new java.io.FileOutputStream(temp)){
    byte[] buffer=new byte[65536];int n;while((n=in.read(buffer))!=-1){out.write(buffer,0,n);hash.update(buffer,0,n);total+=n;if(total>491400032L)throw new Exception("Unexpected model size");int percent=(int)(total*100/491400032L);if(percent!=last){progress("Downloading phone model · "+percent+"%");last=percent;}}
   }finally{connection.disconnect();}
   StringBuilder digest=new StringBuilder();for(byte b:hash.digest())digest.append(String.format("%02x",b));
   if(total!=491400032L||!digest.toString().equals("74a4da8c9fdbcd15bd1f6d01d621410d31c6fc00986f5eb687824e7b93d7a9db"))throw new Exception("Model integrity check failed");
   if(!temp.renameTo(model))throw new Exception("Unable to save phone model");progress("Phone model ready · Compile an instruction");
  }catch(Exception e){temp.delete();progress("Download failed: "+e.getMessage()+". Tap to retry.");}
 });}
 @JavascriptInterface public void compile(String instruction,int id){worker.execute(()->{String result;try{if(!available())throw new Exception("Phone model is not installed");if(instruction.length()>(instruction.startsWith("__SQUAD_CHAT__")?12000:2500))throw new Exception("Instruction too long");String raw=infer(model.getAbsolutePath(),instruction);JSONObject plan=new JSONObject(raw);JSONObject out=new JSONObject();if(plan.has("error"))throw new Exception(plan.getString("error"));if(instruction.startsWith("__SQUAD_CHAT__")){out.put("script",plan.getString("script"));}else out.put("plan",plan);out.put("model",modelName());result=out.toString();}catch(Exception e){result="{\"error\":"+JSONObject.quote(e.getMessage())+"}";}final String response=result;if(id==-1){android.util.Log.i("TANK_AI_TEST",response);return;}web.post(()->web.evaluateJavascript("window.onPhonePlan("+id+","+response+")",null));});}
 public void close(){worker.shutdownNow();}
}
