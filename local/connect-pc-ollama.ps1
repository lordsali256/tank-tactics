$ErrorActionPreference='Stop'
$tunnelMutex=[Threading.Mutex]::new($false,'Local\TankTacticsOllamaTunnel')
if(!$tunnelMutex.WaitOne(0)){exit}
try {
 $sshPath=(Get-Command ssh.exe).Source
 while($true){
  $tunnelProcess=Start-Process -FilePath $sshPath -ArgumentList @('-N','-T','-o','BatchMode=yes','-o','ConnectTimeout=8','-o','ExitOnForwardFailure=yes','-o','ServerAliveInterval=30','-o','ServerAliveCountMax=3','-R','127.0.0.1:11435:127.0.0.1:11434','192.168.1.10') -WindowStyle Hidden -PassThru
  $tunnelProcess.WaitForExit()
  Start-Sleep -Seconds 10
 }
} finally {$tunnelMutex.ReleaseMutex();$tunnelMutex.Dispose()}
