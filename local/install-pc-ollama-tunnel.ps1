$ErrorActionPreference='Stop'
$helperPath=Join-Path $PSScriptRoot 'connect-pc-ollama.ps1'
$shellPath=Join-Path $PSHOME 'powershell.exe'
if(!(Test-Path $shellPath)){$shellPath=(Get-Command powershell.exe).Source}
$arguments='-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "'+$helperPath+'"'
$shortcutPath=Join-Path ([Environment]::GetFolderPath('Startup')) 'Tank Tactics PC Ollama.lnk'
$shortcut=(New-Object -ComObject WScript.Shell).CreateShortcut($shortcutPath)
$shortcut.TargetPath=$shellPath;$shortcut.Arguments=$arguments;$shortcut.WorkingDirectory=Split-Path $PSScriptRoot -Parent;$shortcut.WindowStyle=7;$shortcut.Save()
Start-Process -FilePath $shellPath -ArgumentList $arguments -WindowStyle Hidden
Write-Output 'Private Ollama tunnel installed for this Windows user. Keep this PC and Ollama running.'
