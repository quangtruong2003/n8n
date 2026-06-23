# n8n Setup Complete - Waiting for Docker Desktop

## Setup đã hoàn tất!

Tôi đã tạo xong cấu trúc n8n portable tại `d:\GHOST-WORKER\n8n\`

### Cấu trúc đã tạo:
```
n8n/
├── docker-compose.yml      # Docker configuration
├── .env                    # Credentials (password: GhostWorker2026!)
├── README.md               # Hướng dẫn
├── scripts/
│   ├── start.ps1           # Khởi động Windows
│   ├── start.sh            # Khởi động Linux/macOS
│   ├── backup.ps1          # Backup Windows
│   ├── backup.sh          # Backup Linux/macOS
│   ├── restore.ps1         # Restore Windows
│   └── restore.sh         # Restore Linux/macOS
└── .gitignore             # Ignore sensitive files
```

## Hướng dẫn khi Docker Desktop đã chạy

Mở **PowerShell** và chạy:

```powershell
cd d:\GHOST-WORKER\n8n
.\scripts\start.ps1
```

Sau 1-2 phút, truy cập: **http://localhost:5678**

## Nếu Docker Desktop không chạy được

Kiểm tra:
1. System tray → Click Docker icon → "Start Docker Desktop"
2. Hoặc search "Docker Desktop" trong Start menu

Nếu vẫn lỗi, Docker có thể cần WSL2 backend. Chạy terminal với quyền Admin:
```powershell
wsl --update
```

## Lưu ý bảo mật

Password mặc định đang là: `GhostWorker2026!`
**Đổi password này sau khi login lần đầu!**
