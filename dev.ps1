<#
.SYNOPSIS
  Starts the backend (Laravel API on :8000) and the frontend (React/Vite on :5173)
  together in ONE terminal. Press Ctrl+C once to stop BOTH.

.EXAMPLE
  .\dev.ps1              # uses the REAL database (backend/.env)
.EXAMPLE
  .\dev.ps1 -Testing     # uses the TESTING database (sample users, password "password")

.NOTES
  You don't need to restart for code changes:
    - React files: Vite updates the browser instantly when you save (Hot Module Replacement).
    - PHP files:   Laravel reads your PHP code fresh on every request.
  Restart (Ctrl+C, then run again) only after changing .env, or to switch database.
  Full guide: docs/DEV_SERVERS_GUIDE.md
#>
param(
  [switch]$Testing,
  [int]$StopAfterSeconds = 0   # for quick automatic checks only: stop by itself after N seconds
)

$root = $PSScriptRoot
$ports = @{ backend = 8000; frontend = 5173 }

# "Is something already listening on this port?" We actually try to connect,
# on both 127.0.0.1 (IPv4) and ::1 (IPv6), because Vite listens on ::1.
function Test-PortInUse([int]$port) {
  foreach ($address in '127.0.0.1', '::1') {
    $client = New-Object System.Net.Sockets.TcpClient($(if ($address -eq '::1') { 'InterNetworkV6' } else { 'InterNetwork' }))
    try {
      if ($client.ConnectAsync($address, $port).Wait(300) -and $client.Connected) { return $true }
    } catch {
      # connection refused = nothing listening there
    } finally {
      $client.Dispose()
    }
  }
  return $false
}

# Wait (up to ~5s) for a port to become free after stopping a server
function Wait-PortFree([int]$port) {
  for ($i = 0; $i -lt 20 -and (Test-PortInUse $port); $i++) { Start-Sleep -Milliseconds 250 }
  -not (Test-PortInUse $port)
}

# Stops a process AND everything it started (php artisan serve starts a second php process, npm starts node)
function Stop-ProcessTree([int]$processId) {
  & taskkill.exe /PID $processId /T /F 2>&1 | Out-Null
}

# 1) Make sure nothing else is already using our ports
foreach ($name in 'backend', 'frontend') {
  if (Test-PortInUse $ports[$name]) {
    Write-Host "Port $($ports[$name]) ($name) is already in use." -ForegroundColor Red
    Write-Host "Another server is still running (maybe an old 'php artisan serve' or 'npm run dev')." -ForegroundColor Red
    Write-Host "Stop it first: press Ctrl+C in its terminal, or close that terminal. Then run .\dev.ps1 again." -ForegroundColor Red
    exit 1
  }
}

$database = if ($Testing) { 'TESTING database (sample data)' } else { 'REAL database (.env)' }
Write-Host ''
Write-Host '  AI-Driven Voucher Monitoring System: dev servers' -ForegroundColor Cyan
Write-Host "  App:      http://localhost:$($ports.frontend)" -ForegroundColor Cyan
Write-Host "  API:      http://localhost:$($ports.backend)" -ForegroundColor Cyan
Write-Host "  Database: $database" -ForegroundColor $(if ($Testing) { 'Yellow' } else { 'Cyan' })
Write-Host '  Press Ctrl+C to stop both.' -ForegroundColor Cyan
Write-Host ''

# 2) Start each server as a background job. "2>&1" merges error output so we see everything.
$backend = Start-Job -Name backend -ArgumentList (Join-Path $root 'backend'), $Testing.IsPresent, $ports.backend -ScriptBlock {
  param($dir, $testing, $port)
  Set-Location $dir
  if ($testing) { $env:APP_ENV = 'testing' }
  php artisan serve --port=$port 2>&1 | ForEach-Object { "$_" }
}
$frontend = Start-Job -Name frontend -ArgumentList (Join-Path $root 'frontend') -ScriptBlock {
  param($dir)
  Set-Location $dir
  npm run dev 2>&1 | ForEach-Object { "$_" }   # port 5173 + strictPort are set in vite.config.js
}

$colors = @{ backend = 'Magenta'; frontend = 'Green' }
$started = Get-Date

try {
  # 3) Show both servers' output, each line labelled [backend] or [frontend]
  while ($true) {
    foreach ($job in $backend, $frontend) {
      foreach ($line in (Receive-Job $job)) {
        if ("$line".Trim() -eq '') { continue }
        Write-Host ("[{0}] " -f $job.Name.PadRight(8)) -NoNewline -ForegroundColor $colors[$job.Name]
        Write-Host $line
      }
      if ($job.State -ne 'Running') {
        Write-Host "The $($job.Name) server stopped. Its last messages are above." -ForegroundColor Red
        return
      }
    }
    if ($StopAfterSeconds -gt 0 -and ((Get-Date) - $started).TotalSeconds -ge $StopAfterSeconds) { return }
    Start-Sleep -Milliseconds 300
  }
}
finally {
  # 4) Runs on Ctrl+C too: stop both servers and everything they started
  Write-Host ''
  Write-Host 'Stopping servers...' -ForegroundColor Cyan
  Get-CimInstance Win32_Process -Filter "ParentProcessId=$PID" |
    Where-Object { $_.Name -eq 'powershell.exe' } |
    ForEach-Object { Stop-ProcessTree $_.ProcessId }
  Stop-Job $backend, $frontend -ErrorAction SilentlyContinue
  Remove-Job $backend, $frontend -Force -ErrorAction SilentlyContinue

  foreach ($name in 'backend', 'frontend') {
    $state = if (Wait-PortFree $ports[$name]) { 'stopped' } else { 'STILL RUNNING (close it manually)' }
    Write-Host "  $name (:$($ports[$name])): $state"
  }
}
