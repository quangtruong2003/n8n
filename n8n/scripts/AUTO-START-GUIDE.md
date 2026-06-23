# Hướng dẫn setup Auto-Start cho n8n

## Cách 1: Tạo Windows Startup Shortcut (Đơn giản nhất)

1. Mở **PowerShell** với quyền **Administrator**:
   - Search "PowerShell" → Right-click → "Run as administrator"

2. Chạy lệnh tạo shortcut:
```powershell
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("$env:USERPROFILE\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\n8n-GHOST-WORKER.lnk")
$Shortcut.TargetPath = "powershell.exe"
$Shortcut.Arguments = "-ExecutionPolicy Bypass -File `"" + (Resolve-Path "d:\GHOST-WORKER\n8n\scripts\auto-start.ps1").Path + "`""
$Shortcut.WorkingDirectory = "d:\GHOST-WORKER\n8n"
$Shortcut.Description = "GHOST-WORKER n8n Auto-Start"
$Shortcut.Save()
```

## Cách 2: Windows Task Scheduler (Chuyên nghiệp hơn)

1. Mở **Task Scheduler** (search "Task Scheduler")
2. Click **Create Basic Task**
3. Name: `GHOST-WORKER n8n`
4. Trigger: **When I log on**
5. Action: **Start a program**
   - Program: `powershell.exe`
   - Arguments: `-ExecutionPolicy Bypass -File "d:\GHOST-WORKER\n8n\scripts\auto-start.ps1"`
6. Finish

## Cách 3: Docker Desktop Auto-start (Khuyến nghị)

1. Mở **Docker Desktop**
2. Settings → **General**
3. ✅ Tick **Start Docker Desktop when you sign in**
4. ✅ Tick **Start containers after starting Docker Desktop**

Điều này đảm bảo Docker chạy khi login, và n8n container với `restart: unless-stopped` sẽ tự khởi động lại.

## Kiểm tra

Sau khi setup, restart máy và kiểm tra:
```powershell
docker ps --filter "name=ghost-worker-n8n"
```

Container phải có Status "Up".
