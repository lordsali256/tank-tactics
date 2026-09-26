package com.tanktactics.promptarena;
import android.app.Activity;
import android.os.Bundle;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebResourceRequest;
import android.view.View;
import android.graphics.Color;
import android.widget.FrameLayout;
import java.io.InputStream;
import java.io.ByteArrayOutputStream;
public class MainActivity extends Activity {
 private WebView web;
 @Override public void onCreate(Bundle state){
  super.onCreate(state); web=new WebView(this);web.setBackgroundColor(Color.rgb(13,21,16));
  web.getSettings().setJavaScriptEnabled(true);web.getSettings().setDomStorageEnabled(true);
  web.getSettings().setAllowFileAccess(false);web.getSettings().setAllowContentAccess(false);
  web.setWebViewClient(new WebViewClient(){
   @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){
    String path=request.getUrl().getPath();
    if("127.0.0.1".equals(request.getUrl().getHost())){loadPage(path!=null&&path.contains("play")?"play.html":"index.html");return true;}
    return true;
   }
  });
  FrameLayout frame=new FrameLayout(this);frame.setBackgroundColor(Color.rgb(13,21,16));frame.addView(web,new FrameLayout.LayoutParams(-1,-1));setContentView(frame);
  frame.setOnApplyWindowInsetsListener((v,insets)->{v.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());return insets;});frame.requestApplyInsets();
  loadPage("play.html");
 }
 private void loadPage(String name){try(InputStream in=getAssets().open(name);ByteArrayOutputStream out=new ByteArrayOutputStream()){
  byte[] buf=new byte[8192];int n;while((n=in.read(buf))!=-1)out.write(buf,0,n);
  web.loadDataWithBaseURL("http://127.0.0.1:8878/",out.toString("UTF-8"),"text/html","UTF-8",null);
 }catch(Exception e){web.loadData("Unable to load Tank Tactics.","text/html","UTF-8");}}
 @Override protected void onPause(){super.onPause();web.onPause();}
 @Override protected void onResume(){super.onResume();if(web!=null)web.onResume();}
 @Override protected void onDestroy(){web.destroy();super.onDestroy();}
}
