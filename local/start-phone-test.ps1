$ErrorActionPreference='Stop'
$taskRoot=Split-Path $PSScriptRoot -Parent
$adb=Join-Path $env:LOCALAPPDATA 'TankTactics/tools/platform-tools/adb.exe'
if(!(Test-Path $adb)){throw 'Android platform tools are missing.'}
try {Invoke-RestMethod http://127.0.0.1:8878/api/status -TimeoutSec 3 | Out-Null} catch {
 Start-Process -FilePath (Get-Command node).Source -ArgumentList @('local/bridge.mjs') -WorkingDirectory $taskRoot -WindowStyle Hidden -RedirectStandardOutput "$PSScriptRoot/bridge.log" -RedirectStandardError "$PSScriptRoot/bridge-error.log"
}
& $adb reverse tcp:8878 tcp:8878
if($LASTEXITCODE -ne 0){throw 'Unlock the phone and authorize USB debugging.'}
& $adb shell am start -n com.tanktactics.promptarena/.MainActivity
Write-Output 'Tank Tactics is ready. Keep the USB cable connected for local AI.'
