#Requires -Version 5.1
<#
.SYNOPSIS
  Validate Windows prerequisites and Carina install assumptions.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts/validate-windows.ps1
  powershell -ExecutionPolicy Bypass -File scripts/validate-windows.ps1 -Json
#>
param([switch]$Json)

$ErrorActionPreference = 'Continue'
$issues = @()

function Add-Issue([string]$Message) { $script:issues += $Message }

$build = try {
    [int](Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion').CurrentBuildNumber
} catch { $null }

if ($null -eq $build -or $build -lt 17763) {
    Add-Issue "Windows build 17763+ required (found: $build)"
}

$nodeVersion = $null
try { $nodeVersion = (& node --version).Trim() } catch { Add-Issue 'Node.js not found on PATH' }
if ($nodeVersion) {
    $major = [int]($nodeVersion.TrimStart('v').Split('.')[0])
    if ($major -lt 22) { Add-Issue "Node.js 22+ required (found $nodeVersion)" }
}

$carinaOnPath = $false
try {
    $null = Get-Command carina -ErrorAction Stop
    $carinaOnPath = $true
} catch {
    Add-Issue 'carina CLI not on PATH'
}

$carinaHome = Join-Path $env:USERPROFILE '.carina'
$envExists = Test-Path (Join-Path $carinaHome '.env')

try {
    $null = Get-Command powershell.exe -ErrorAction Stop
} catch {
    Add-Issue 'powershell.exe not available'
}

$taskInstalled = $false
try {
    schtasks /Query /TN CarinaGateway /FO LIST | Out-Null
    $taskInstalled = $true
} catch {
    # optional
}

$report = [ordered]@{
    platform = 'win32'
    buildNumber = $build
    conptySupported = ($null -eq $build) -or ($build -ge 17763)
    nodeVersion = $nodeVersion
    carinaOnPath = $carinaOnPath
    carinaHome = $carinaHome
    carinaEnvExists = $envExists
    gatewayTaskInstalled = $taskInstalled
  ok = ($issues.Count -eq 0)
    issues = $issues
}

if ($Json) {
    $report | ConvertTo-Json -Depth 4
} else {
    Write-Host 'Carina Windows validation'
    Write-Host "  build: $build"
    Write-Host "  node:  $nodeVersion"
    Write-Host "  carina on PATH: $carinaOnPath"
    Write-Host "  ~/.carina/.env: $envExists"
    Write-Host "  CarinaGateway task: $taskInstalled"
    if ($issues.Count -eq 0) {
        Write-Host 'OK: Windows environment ready' -ForegroundColor Green
    } else {
        Write-Host 'Issues:' -ForegroundColor Yellow
        foreach ($issue in $issues) { Write-Host "  - $issue" -ForegroundColor Yellow }
        exit 1
    }
}

if (-not $report.ok) { exit 1 }
