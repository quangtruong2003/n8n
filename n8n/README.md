# n8n Setup - GHOST-WORKER

## Mục tiêu

n8n chạy trong Docker với **data persistence** qua Docker volume.
Khi move sang máy khác, chỉ cần copy folder `n8n/` + backup volume = không mất data.

## Cấu trúc

```
n8n/
├── docker-compose.yml   # Docker configuration
├── .env                 # Credentials (KHÔNG commit)
├── data/                # (optional) Local data mount
├── backups/             # Backup files
├── scripts/
│   ├── start.ps1        # Windows: Khởi động
│   ├── start.sh         # Linux/macOS: Khởi động
│   ├── backup.ps1       # Windows: Backup
│   ├── backup.sh        # Linux/macOS: Backup
│   ├── restore.ps1      # Windows: Restore
│   └── restore.sh       # Linux/macOS: Restore
└── README.md
```

## Setup lần đầu

### 1. Cấu hình credentials

```powershell
# Mở file .env và đổi password
notepad n8n\.env
```

Đổi `N8N_PASSWORD=CHANGE_THIS_PASSWORD_NOW` thành password mạnh.

### 2. Khởi động n8n

```powershell
cd d:\GHOST-WORKER\n8n
.\scripts\start.ps1
```

Sau vài phút, truy cập: **http://localhost:5678**

## Di chuyển sang máy khác

### Cách 1: Backup & Restore (Khuyến nghị)

**Trên máy cũ:**
```powershell
cd d:\GHOST-WORKER\n8n
.\scripts\backup.ps1 "pre-move"
```

Copy toàn bộ folder `n8n/` (trừ backups/) sang máy mới.

**Trên máy mới:**
```powershell
cd n8n
.\scripts\restore.ps1 "pre-move"
.\scripts\start.ps1
```

### Cách 2: Export Docker Volume

```powershell
# Export volume
docker run --rm -v ghost-worker-n8n_n8n_data:/data -v d:/ghost-worker-backup:/backup alpine tar czf /backup/n8n-data.tar.gz -C /data .

# Import trên máy mới
docker volume create ghost-worker-n8n_n8n_data
docker run --rm -v ghost-worker-n8n_n8n_data:/data -v d:/ghost-worker-backup:/backup alpine tar xzf /backup/n8n-data.tar.gz -C /data
```

## Các lệnh thường dùng

```powershell
# Xem logs
docker compose -f d:\GHOST-WORKER\n8n\docker-compose.yml logs -f

# Stop
docker compose -f d:\GHOST-WORKER\n8n\docker-compose.yml down

# Restart
docker compose -f d:\GHOST-WORKER\n8n\docker-compose.yml restart

# Update n8n
docker compose -f d:\GHOST-WORKER\n8n\docker-compose.yml pull
docker compose -f d:\GHOST-WORKER\n8n\docker-compose.yml up -d
```

## Lưu ý bảo mật

- **KHÔNG BAO GIỜ** commit file `.env` lên git
- Backup file `.env` riêng ở nơi an toàn
- Thay đổi password mặc định ngay lần đầu
