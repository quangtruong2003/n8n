# ============================================
# GHOST-WORKER API - Test Script (PowerShell)
# ============================================

$BASE_URL = "http://localhost:3000/api"
$N8N_KEY = "ghost-worker-n8n-secret"
$SPA_ID = "spa_demo_001"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "GHOST-WORKER API Test Script" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Helper function
function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Url,
        [string]$Method = "GET",
        [string]$Body = $null,
        [string]$Token = $null
    )
    
    Write-Host "[$Name]" -ForegroundColor Yellow
    Write-Host "  URL: $Method $Url"
    
    $headers = @{"Content-Type" = "application/json"}
    if ($Token) { $headers["Authorization"] = "Bearer $Token" }
    
    try {
        if ($Method -eq "POST") {
            $result = Invoke-RestMethod -Uri $Url -Method Post -ContentType "application/json" -Headers $headers -Body $Body -ErrorAction Stop
        } else {
            $result = Invoke-RestMethod -Uri $Url -Method Get -Headers $headers -ErrorAction Stop
        }
        $result | ConvertTo-Json -Depth 5
        Write-Host "  Status: OK" -ForegroundColor Green
    } catch {
        Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
    }
    Write-Host ""
}

Write-Host "=== 1. Health Check ===" -ForegroundColor Magenta
Test-Endpoint -Name "Health" -Url "$BASE_URL"

Write-Host "=== 2. Auth - Login ===" -ForegroundColor Magenta
$loginBody = '{"pin":"1234"}'
$loginResult = Invoke-RestMethod -Uri "$BASE_URL/auth/login" -Method Post -ContentType "application/json" -Body $loginBody
$TOKEN = $loginResult.token
Write-Host "  Token: $($loginResult.token.Substring(0, 50))..." -ForegroundColor Green
Write-Host "  Spa: $($loginResult.spa.name)" -ForegroundColor Green
Write-Host ""

Write-Host "=== 3. Spa Data (requires token) ===" -ForegroundColor Magenta
$headers = @{"Authorization" = "Bearer $TOKEN"}
Test-Endpoint -Name "Services" -Url "$BASE_URL/spa/$SPA_ID/services" -Token $TOKEN
Test-Endpoint -Name "Branches" -Url "$BASE_URL/spa/$SPA_ID/branches" -Token $TOKEN
Test-Endpoint -Name "Config" -Url "$BASE_URL/spa/$SPA_ID/config" -Token $TOKEN
Test-Endpoint -Name "Dashboard" -Url "$BASE_URL/spa/$SPA_ID/dashboard" -Token $TOKEN
Test-Endpoint -Name "Customers" -Url "$BASE_URL/spa/$SPA_ID/customers" -Token $TOKEN
Test-Endpoint -Name "Bookings" -Url "$BASE_URL/spa/$SPA_ID/bookings" -Token $TOKEN
Test-Endpoint -Name "Chat Logs" -Url "$BASE_URL/spa/$SPA_ID/chat-logs" -Token $TOKEN

Write-Host "=== 4. n8n Webhook ===" -ForegroundColor Magenta
$n8nHeaders = @{"Authorization" = "Bearer $N8N_KEY"; "Content-Type" = "application/json"}

Write-Host "[Create Customer]"
$body = '{"action":"create_customer","data":{"spaId":"spa_demo_001","name":"Test User","phone":"0909999000"}}'
$result = Invoke-RestMethod -Uri "$BASE_URL/n8n" -Method Post -Headers $n8nHeaders -Body $body
Write-Host "  Result: $($result | ConvertTo-Json)" -ForegroundColor Green
Write-Host ""

Write-Host "[Log Chat]"
$body = '{"action":"log_chat","data":{"spaId":"spa_demo_001","phone":"0909999000","content":"Hello from test","sender":"user"}}'
$result = Invoke-RestMethod -Uri "$BASE_URL/n8n" -Method Post -Headers $n8nHeaders -Body $body
Write-Host "  Result: $($result | ConvertTo-Json)" -ForegroundColor Green
Write-Host ""

Write-Host "[Get Services]"
$body = '{"action":"get_services","data":{"spaId":"spa_demo_001"}}'
$result = Invoke-RestMethod -Uri "$BASE_URL/n8n" -Method Post -Headers $n8nHeaders -Body $body
Write-Host "  Services count: $($result.services.Count)" -ForegroundColor Green
Write-Host ""

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "All tests completed!" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
