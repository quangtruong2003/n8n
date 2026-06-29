# Hướng dẫn kết nối n8n API

## Tổng quan

n8n cung cấp REST API để quản lý workflows, credentials, executions. API này hữu ích để:
- Import/Export workflows tự động
- Activate/Deactivate workflows
- Trigger workflows programmatically
- Quản lý credentials

## Cơ bản

cd d:/GHOST-WORKER/n8n && curl -c cookies.txt -s -X POST "http://localhost:5678/rest/login" -H "Content-Type: application/json" -d '{"emailOrLdapLoginId":"email@gmail.com","password":"password"}'

### 1. Cài đặt n8n

```bash
# Local
npm install n8n -g
n8n

# Docker
docker run -it --rm \
  --name n8n \
  -p 5678:5678 \
  -v ~/.n8n:/home/node/.n8n \
  n8nio/n8n
```

### 2. Bật API

Vào n8n UI → Settings → API → Generate API Key

Hoặc set environment variable:
```bash
export N8N_API_ENABLED=true
export N8N_API_KEY=your-api-key
```

## Authentication

### Method 1: Basic Auth (Username/Password)

```bash
# Login để lấy session cookie
curl -c cookies.txt -X POST "http://localhost:5678/rest/login" \
  -H "Content-Type: application/json" \
  -d '{"emailOrLdapLoginId":"EMAIL_CUA_BAN","password":"MAT_KHAU"}'
```

Response thành công:
```json
{
  "data": {
    "id": "user-id",
    "email": "user@example.com",
    "role": "global:owner"
  }
}
```

### Method 2: API Key (Bearer Token)

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  http://localhost:5678/rest/workflows
```

## Các API Endpoints thường dùng

### Workflows

| Method | Endpoint | Mô tả |
|--------|----------|--------|
| GET | `/rest/workflows` | Liệt kê tất cả workflows |
| GET | `/rest/workflows/:id` | Lấy workflow theo ID |
| POST | `/rest/workflows` | Tạo workflow mới |
| PUT | `/rest/workflows/:id` | Cập nhật workflow |
| DELETE | `/rest/workflows/:id` | Xóa workflow |
| POST | `/rest/workflows/:id/activate` | Bật workflow |
| POST | `/rest/workflows/:id/deactivate` | Tắt workflow |

### Credentials

| Method | Endpoint | Mô tả |
|--------|----------|--------|
| GET | `/rest/credentials` | Liệt kê credentials |
| POST | `/rest/credentials` | Tạo credential mới |

### Executions

| Method | Endpoint | Mô tả |
|--------|----------|--------|
| GET | `/rest/executions` | Liệt kê executions |
| POST | `/rest/executions/:id/retry` | Retry execution |

## Ví dụ thực tế

### Import Workflow từ file JSON

```bash
# 1. Login
curl -c cookies.txt -X POST "http://localhost:5678/rest/login" \
  -H "Content-Type: application/json" \
  -d '{"emailOrLdapLoginId":"nguyentruongk530042003@gmail.com","password":"MAT_KHAU"}'

# 2. Import workflow (file phải là object JSON, không phải array)
curl -b cookies.txt -X POST "http://localhost:5678/rest/workflows" \
  -H "Content-Type: application/json" \
  -d @workflow.json

# 3. Cleanup
rm cookies.txt
```

### Export Workflow ra file

```bash
# Lấy workflow ID trước
WORKFLOW_ID=$(curl -s -b cookies.txt "http://localhost:5678/rest/workflows" | \
  jq '.data[] | select(.name=="Tên Workflow") | .id')

# Export
curl -s -b cookies.txt "http://localhost:5678/rest/workflows/$WORKFLOW_ID" | \
  jq '{name: .data.name, nodes: .data.nodes, connections: .data.connections}' > workflow.json
```

### Activate/Deactivate Workflow

```bash
# Activate
curl -b cookies.txt -X POST \
  "http://localhost:5678/rest/workflows/WORKFLOW_ID/activate"

# Deactivate
curl -b cookies.txt -X POST \
  "http://localhost:5678/rest/workflows/WORKFLOW_ID/deactivate"
```

### Trigger Workflow

```bash
# Gửi test data đến webhook trigger
curl -X POST "http://localhost:5678/webhook/WEBHOOK_PATH" \
  -H "Content-Type: application/json" \
  -d '{"data":{"content":"Hello"}}'
```

## Script hoàn chỉnh (Node.js)

```javascript
// n8n-api.js
const https = require('https');
const fs = require('fs');

const N8N_URL = 'http://localhost:5678';
const EMAIL = 'your-email@example.com';
const PASSWORD = 'your-password';

class N8nAPI {
  constructor() {
    this.cookies = [];
  }

  async login() {
    const response = await this.request('/rest/login', {
      method: 'POST',
      body: { emailOrLdapLoginId: EMAIL, password: PASSWORD }
    });
    this.cookies = response.cookies;
    return response;
  }

  async getWorkflows() {
    return this.request('/rest/workflows');
  }

  async getWorkflow(id) {
    return this.request(`/rest/workflows/${id}`);
  }

  async createWorkflow(workflowData) {
    return this.request('/rest/workflows', {
      method: 'POST',
      body: workflowData
    });
  }

  async updateWorkflow(id, workflowData) {
    return this.request(`/rest/workflows/${id}`, {
      method: 'PUT',
      body: workflowData
    });
  }

  async deleteWorkflow(id) {
    return this.request(`/rest/workflows/${id}`, {
      method: 'DELETE'
    });
  }

  async activateWorkflow(id) {
    return this.request(`/rest/workflows/${id}/activate`, {
      method: 'POST'
    });
  }

  async request(path, options = {}) {
    // Implementation sử dụng http module
    // Trả về parsed JSON response
  }
}

// Sử dụng
async function main() {
  const api = new N8nAPI();
  
  // Login
  await api.login();
  
  // Import workflow
  const workflowData = JSON.parse(fs.readFileSync('workflow.json', 'utf8'));
  const result = await api.createWorkflow(workflowData);
  console.log('Created:', result.data.id);
}

main();
```

## PowerShell Examples

```powershell
# Login và lấy cookies
$body = @{
    emailOrLdapLoginId = "nguyentruongk530042003@gmail.com"
    password = "MAT_KHAU"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:5678/rest/login" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body `
    -SessionVariable session

# Import workflow
$workflow = Get-Content "workflow.json" -Raw | ConvertFrom-Json
Invoke-RestMethod -Uri "http://localhost:5678/rest/workflows" `
    -Method POST `
    -ContentType "application/json" `
    -Body ($workflow | ConvertTo-Json -Depth 100) `
    -WebSession $session

# Get all workflows
$workflows = Invoke-RestMethod -Uri "http://localhost:5678/rest/workflows" `
    -WebSession $session
$workflows.data | Format-Table id, name, active
```

## Troubleshooting

### Lỗi "Unauthorized"

1. Chưa login → Gọi login API trước
2. Session hết hạn → Login lại
3. Sai credentials → Kiểm tra email/password

### Lỗi "Expected object, received array"

Workflow JSON phải là object, không phải array:
```json
// ❌ Sai
[{"name": "Workflow 1", ...}]

// ✅ Đúng
{"name": "Workflow 1", ...}
```

### Lỗi validation

Kiểm tra JSON format:
```bash
# Validate JSON
cat workflow.json | jq . > /dev/null && echo "Valid JSON" || echo "Invalid"
```

## Environment Variables quan trọng

```bash
# Security
N8N_API_ENABLED=true
N8N_API_KEY=your-secret-key
N8N_BASIC_AUTH_ACTIVE=true
N8N_BASIC_AUTH_USER=admin
N8N_BASIC_AUTH_PASSWORD=secret

# Database
DB_TYPE=postgresdb
DB_POSTGRES_HOST=localhost
DB_POSTGRES_PORT=5432
DB_POSTGRES_DATABASE=n8n
DB_POSTGRES_USER=n8n
DB_POSTGRES_PASSWORD=n8n

# Webhook
N8N_WEBHOOK_URL=https://your-domain.com
```

## Best Practices

1. **Luôn cleanup cookies** sau khi sử dụng
2. **Validate JSON** trước khi import
3. **Backup workflows** định kỳ
4. **Sử dụng API Key** thay vì password trong production
5. **Rate limiting** - đừng spam API calls

## Tham khảo

- [n8n API Documentation](https://docs.n8n.io/api/)
- [n8n GitHub](https://github.com/n8n-io/n8n)
