# n8n Backup System

## Quick Start

```powershell
cd D:\GHOST-WORKER\n8n\scripts

# 1. Chạy backup ngay
.\backup.ps1

# 2. Setup backup tự động hàng ngày (3 AM)
.\schedule-backup.ps1
```

## Backup Files Location
```
D:\GHOST-WORKER\n8n\backups\
  n8n-backup-20250624-030000.tar.gz
  n8n-backup-20250623-030000.tar.gz
  ...
```

## Restore from Backup

```powershell
# Xem danh sách backup
.\restore.ps1

# Restore backup cụ thể
.\restore.ps1 20250624-030000
```

## Backup Contents
- `database.sqlite` - Database chính
- `workflow-import.json` - Workflow exports
- Credentials (encrypted)
- Settings & logs

## Rules BẮT BUỘC

1. **TRƯỚC KHI** chạy lệnh destructive (delete, drop, reset):
   ```powershell
   .\backup.ps1 "pre-change-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
   ```

2. **ĐỂ** n8n container đang chạy khi backup

3. **KHÔNG BAO GIỜ** xóa manual volume hoặc database

## Tự động xóa backups cũ
Giữ 7 backups gần nhất, tự động xóa backups cũ hơn.
