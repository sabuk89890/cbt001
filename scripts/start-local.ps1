param(
    [switch]$Install,
    [switch]$Migrate
)

$Root = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $Root

Write-Host "Starting automated local startup in:`n  $Root" -ForegroundColor Cyan

Write-Host "\n1) Checking Node and npm..." -ForegroundColor Yellow
try {
    $nodeVer = (& node -v) 2>$null
    $npmVer = (& npm -v) 2>$null
} catch {
    $nodeVer = $null
    $npmVer = $null
}
if (-not $nodeVer) {
    Write-Error "Node.js not found in PATH. Install Node >=16 and try again."
    exit 1
}
Write-Host "Node: $nodeVer  |  npm: $npmVer"

Write-Host "\n2) Checking .env.local..." -ForegroundColor Yellow
if (Test-Path "$Root\.env.local") {
    Write-Host ".env.local found. Listing required keys (no values):"
    Get-Content "$Root\.env.local" | Select-String -Pattern "NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_ANON_KEY|SUPABASE_SERVICE_ROLE_KEY|DATABASE_URL|SUPABASE_DB_URL" | ForEach-Object { $_.Line -replace "=.*","=<redacted>"; Write-Host $_.Line }
} else {
    Write-Host ".env.local not found. Create it from .env.example and fill values." -ForegroundColor Red
}

Write-Host "\n3) Checking port 3000..." -ForegroundColor Yellow
$net = netstat -ano | findstr ":3000" 2>$null
if ($net) {
    $lines = $net -split "`n" | Where-Object { $_ -match '\S' }
    $pids = @()
    foreach ($l in $lines) {
        $parts = $l -split '\s+' | Where-Object { $_ -ne '' }
        $pid = $parts[-1]
        if ($pid -and ($pid -as [int])) { $pids += $pid }
    }
    $pids = $pids | Select-Object -Unique
    if ($pids.Count -gt 0) {
        Write-Host "Found processes using port 3000: $($pids -join ', ')" -ForegroundColor Red
        Write-Host "Killing them in 5 seconds (press Ctrl+C to cancel)..." -ForegroundColor Magenta
        Start-Sleep -Seconds 5
        foreach ($pid in $pids) {
            try {
                taskkill /PID $pid /F | Out-Null
                Write-Host "Killed PID $pid"
            } catch {
                Write-Warning "Failed to kill PID $pid"
            }
        }
    }
} else { Write-Host "Port 3000 is free." }

Write-Host "\n4) Ensure dependencies are installed..." -ForegroundColor Yellow
if ($Install -or -not (Test-Path "$Root\node_modules")) {
    Write-Host "Running npm ci..." -ForegroundColor Cyan
    $r = npm ci
    if ($LASTEXITCODE -ne 0) { Write-Error "npm ci failed"; exit $LASTEXITCODE }
} else { Write-Host "node_modules exists — skipping install." }

if ($Migrate) {
    Write-Host "\n5) Running migrations: npm run migrate:supabase" -ForegroundColor Yellow
    npm run migrate:supabase
    if ($LASTEXITCODE -ne 0) { Write-Error "Migration failed"; exit $LASTEXITCODE }
}

Write-Host "\n6) Launching Next dev server in a new window..." -ForegroundColor Yellow
$cmd = "cd `"$Root`"; npm run dev"
Start-Process -FilePath powershell -ArgumentList '-NoExit','-Command',$cmd

Start-Sleep -Seconds 2
Write-Host "Opening http://localhost:3000 in default browser..." -ForegroundColor Cyan
Start-Process "http://localhost:3000"

Write-Host "All done — check the new PowerShell window for server logs." -ForegroundColor Green
