$ErrorActionPreference='Stop'
$taskRoot=Split-Path $PSScriptRoot -Parent
$toolRoot=Join-Path $env:LOCALAPPDATA 'TankTactics/tools'
$sdkRoot=Join-Path $env:LOCALAPPDATA 'TankTactics/android-sdk'
$jdkRoot=(Get-ChildItem $toolRoot -Directory -Filter 'jdk*' | Select-Object -First 1).FullName
$env:JAVA_HOME=$jdkRoot
$bt=Join-Path $sdkRoot 'build-tools/36.0.0'
$platform=Join-Path $sdkRoot 'platforms/android-36/android.jar'
$output=Join-Path $PSScriptRoot 'build'
foreach($dir in @($output,"$output/classes","$output/dex","$output/assets")){New-Item -ItemType Directory -Force $dir | Out-Null}
Copy-Item -LiteralPath "$taskRoot/dist/play.html","$taskRoot/dist/index.html" -Destination "$output/assets" -Force
Copy-Item -LiteralPath "$PSScriptRoot/native/LLAMA-LICENSE.txt","$PSScriptRoot/native/QWEN-LICENSE.txt" -Destination "$output/assets" -Force
function RunTool($exe,$toolArgs){ & $exe @toolArgs; if($LASTEXITCODE -ne 0){throw "Build failed: $exe"}}
RunTool "$jdkRoot/bin/javac.exe" @('-encoding','UTF-8','-source','8','-target','8','-classpath',$platform,'-d',"$output/classes","$PSScriptRoot/src/com/tanktactics/promptarena/MainActivity.java","$PSScriptRoot/src/com/tanktactics/promptarena/PhoneAI.java")
RunTool "$jdkRoot/bin/jar.exe" @('cf',"$output/classes.jar",'-C',"$output/classes",'.')
RunTool "$bt/d8.bat" @('--lib',$platform,'--output',"$output/dex","$output/classes.jar")
RunTool "$bt/aapt2.exe" @('compile','--dir',"$PSScriptRoot/res",'-o',"$output/resources.zip")
RunTool "$bt/aapt2.exe" @('link','-I',$platform,'--manifest',"$PSScriptRoot/AndroidManifest.xml",'-o',"$output/unsigned.apk",'-A',"$output/assets","$output/resources.zip")
RunTool "$jdkRoot/bin/jar.exe" @('uf',"$output/unsigned.apk",'-C',"$output/dex",'classes.dex')
if(Test-Path "$output/native/libtank_ai.so"){
 New-Item -ItemType Directory -Force "$output/libs/lib/arm64-v8a" | Out-Null
 Copy-Item "$output/native/libtank_ai.so" "$output/libs/lib/arm64-v8a/" -Force
 $oldRuntime=Join-Path $output 'libs/lib/arm64-v8a/libc++_shared.so'
 if(Test-Path -LiteralPath $oldRuntime){Remove-Item -LiteralPath $oldRuntime}
 RunTool "$jdkRoot/bin/jar.exe" @('uf',"$output/unsigned.apk",'-C',"$output/libs",'lib')
}
RunTool "$bt/zipalign.exe" @('-f','-P','16','4',"$output/unsigned.apk","$output/aligned.apk")
$key=Join-Path $env:USERPROFILE '.android/debug.keystore'
if(!(Test-Path -LiteralPath $key)){New-Item -ItemType Directory -Force (Split-Path $key) | Out-Null;RunTool "$jdkRoot/bin/keytool.exe" @('-genkeypair','-keystore',$key,'-storepass','android','-keypass','android','-alias','androiddebugkey','-dname','CN=Android Debug,O=Android,C=US','-keyalg','RSA','-keysize','2048','-validity','10000')}
RunTool "$bt/apksigner.bat" @('sign','--ks',$key,'--ks-pass','pass:android','--out',"$output/TankTactics-debug.apk","$output/aligned.apk")
RunTool "$bt/apksigner.bat" @('verify',"$output/TankTactics-debug.apk")
Write-Output "APK ready: $output/TankTactics-debug.apk"


