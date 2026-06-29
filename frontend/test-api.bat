@echo off
echo ============================================
echo GHOST-WORKER API - Test Commands
echo ============================================
echo.

echo [1] Health Check
curl -s http://localhost:3000/api
echo.
echo.

echo [2] Get Services
curl -s http://localhost:3000/api/spa/spa_demo_001/services
echo.
echo.

echo [3] Get Branches
curl -s http://localhost:3000/api/spa/spa_demo_001/branches
echo.
echo.

echo [4] Get Config
curl -s http://localhost:3000/api/spa/spa_demo_001/config
echo.
echo.

echo [5] Login (PIN: 1234)
curl -s -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d "{\"pin\":\"1234\"}"
echo.
echo.

echo [6] n8n Webhook - Log Chat
curl -s -X POST http://localhost:3000/api/n8n -H "Content-Type: application/json" -H "Authorization: Bearer ghost-worker-n8n-secret" -d "{\"action\":\"log_chat\",\"data\":{\"spaId\":\"spa_demo_001\",\"phone\":\"0909999888\",\"content\":\"Test message\",\"sender\":\"user\"}}"
echo.

echo ============================================
echo Done!
pause
