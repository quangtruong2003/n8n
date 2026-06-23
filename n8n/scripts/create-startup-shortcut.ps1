$WshShell = New-Object -ComObject WScript.Shell
$StartupPath = [Environment]::GetFolderPath('Startup')
$Shortcut = $WshShell.CreateShortcut("$StartupPath\n8n-GHOST-WORKER.lnk")
$Shortcut.TargetPath = "powershell.exe"
$Shortcut.Arguments = "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"d:\GHOST-WORKER\n8n\scripts\auto-start.ps1`""
$Shortcut.WorkingDirectory = "d:\GHOST-WORKER\n8n"
$Shortcut.Description = "GHOST-WORKER n8n Auto-Start"
$Shortcut.Save()
Write-Host "Shortcut created in $StartupPath"
