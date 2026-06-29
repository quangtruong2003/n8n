# ============================================
# GHOST-WORKER API - CURL Test Commands
# ============================================
# Base URL: http://localhost:3000/api
# Spa ID: spa_demo_001

# ============================================
# 1. Health Check
# ============================================
curl -X GET http://localhost:3000/api

# ============================================
# 2. Dashboard Stats
# ============================================
curl -X GET "http://localhost:3000/api/spa/spa_demo_001/dashboard"

# ============================================
# 3. Services
# ============================================
# Get all services
curl -X GET http://localhost:3000/api/spa/spa_demo_001/services

# Create a new service
curl -X POST http://localhost:3000/api/spa/spa_demo_001/services \
  -H "Content-Type: application/json" \
  -d '{"name":"Massage Full Body","price":500000,"duration":90,"description":"Massage toàn thân 90 phút"}'

# Update service
curl -X PUT http://localhost:3000/api/spa/spa_demo_001/services/svc_001 \
  -H "Content-Type: application/json" \
  -d '{"name":"Massage Body Pro","price":400000,"active":true}'

# ============================================
# 4. Bookings
# ============================================
# Get all bookings
curl -X GET "http://localhost:3000/api/spa/spa_demo_001/bookings"

# Get bookings by status
curl -X GET "http://localhost:3000/api/spa/spa_demo_001/bookings?status=pending"

# Update booking status
curl -X PATCH http://localhost:3000/api/spa/spa_demo_001/bookings \
  -H "Content-Type: application/json" \
  -d '{"bookingId":"book_xxx","status":"confirmed"}'

# ============================================
# 5. Customers
# ============================================
# Get all customers
curl -X GET "http://localhost:3000/api/spa/spa_demo_001/customers"

# Search customers
curl -X GET "http://localhost:3000/api/spa/spa_demo_001/customers?search=0909"

# Get customer detail
curl -X GET http://localhost:3000/api/spa/spa_demo_001/customers/cust_xxx

# ============================================
# 6. Branches
# ============================================
# Get all branches
curl -X GET http://localhost:3000/api/spa/spa_demo_001/branches

# Create a new branch
curl -X POST http://localhost:3000/api/spa/spa_demo_001/branches \
  -H "Content-Type: application/json" \
  -d '{"name":"Chi nhánh 2","address":"456 Lê Lợi, Q3, HCM"}'

# ============================================
# 7. Config
# ============================================
# Get config
curl -X GET http://localhost:3000/api/spa/spa_demo_001/config

# Update config
curl -X PUT http://localhost:3000/api/spa/spa_demo_001/config \
  -H "Content-Type: application/json" \
  -d '{"name":"Spa Quang Truong","botActive":true,"botGreeting":"Xin chào!","botName":"Bot CS"}'

# ============================================
# 8. Chat Logs
# ============================================
# Get all chat logs
curl -X GET "http://localhost:3000/api/spa/spa_demo_001/chat-logs"

# Get chat logs by sender
curl -X GET "http://localhost:3000/api/spa/spa_demo_001/chat-logs?sender=user"

# Get chat logs by date
curl -X GET "http://localhost:3000/api/spa/spa_demo_001/chat-logs?date=2026-06-28"

# ============================================
# 9. n8n Webhook API
# ============================================
# API Key: ghost-worker-n8n-secret

# Create customer
curl -X POST http://localhost:3000/api/n8n \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ghost-worker-n8n-secret" \
  -d '{
    "action": "create_customer",
    "data": {
      "spaId": "spa_demo_001",
      "name": "Nguyễn Văn A",
      "phone": "0909123456"
    }
  }'

# Log chat message
curl -X POST http://localhost:3000/api/n8n \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ghost-worker-n8n-secret" \
  -d '{
    "action": "log_chat",
    "data": {
      "spaId": "spa_demo_001",
      "phone": "0909123456",
      "content": "Tôi muốn đặt lịch massage",
      "sender": "user"
    }
  }'

# Create booking
curl -X POST http://localhost:3000/api/n8n \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ghost-worker-n8n-secret" \
  -d '{
    "action": "create_booking",
    "data": {
      "spaId": "spa_demo_001",
      "phone": "0909123456",
      "name": "Nguyễn Văn A",
      "serviceId": "svc_001",
      "branchId": "branch_001",
      "bookingTime": "2026-06-29T10:00:00Z",
      "note": "Yêu cầu phòng riêng"
    }
  }'

# Get services (for n8n workflow)
curl -X POST http://localhost:3000/api/n8n \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ghost-worker-n8n-secret" \
  -d '{
    "action": "get_services",
    "data": {
      "spaId": "spa_demo_001"
    }
  }'

# Get branches (for n8n workflow)
curl -X POST http://localhost:3000/api/n8n \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ghost-worker-n8n-secret" \
  -d '{
    "action": "get_branches",
    "data": {
      "spaId": "spa_demo_001"
    }
  }'
