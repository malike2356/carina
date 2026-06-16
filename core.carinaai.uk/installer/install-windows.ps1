#Requires -Version 5.1
<#
.SYNOPSIS
  Native Windows install for Carina (no WSL, no Docker required for basic use).

.DESCRIPTION
  - Ensures Node.js 22+
  - Installs carina-agent globally via npm
  - Runs first-time setup when ~/.carina/.env is missing
  - Optionally registers CarinaGateway logon scheduled task
  - Creates a Start Menu shortcut

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File installer/install-windows.ps1
#>
param(
    [string]$Version = '',
    [switch]$SkipGateway,
    [switch]$SkipShortcut
)

$ErrorActionPreference = 'Stop'

function Write-Step([string]$Message) {
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Test-WindowsVersion {
    $build = [int](Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion').CurrentBuildNumber
    if ($build -lt 17763) {
        throw "Carina requires Windows 10 version 1809+ (build 17763+). Found build $build."
    }
}

function Ensure-Node {
    $node = Get-Command node -ErrorAction SilentlyContinue
    if ($node) {
        $ver = (& node --version).TrimStart('v')
        $major = [int]($ver.Split('.')[0])
        if ($major -ge 22) { return }
        Write-Host "Node $ver found; upgrading to Node 22 LTS..." -ForegroundColor Yellow
    }

  Write-Step 'Installing Node.js 22 LTS via winget'
    $winget = Get-Command winget -ErrorAction SilentlyContinue
    if ($winget) {
        winget install --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements --silent
    } else {
        throw 'Node.js 22+ is required. Install from https://nodejs.org or enable winget.'
    }

    $env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
                [System.Environment]::GetEnvironmentVariable('Path', 'User')
}

function Install-Carina {
    Write-Step 'Installing carina-agent'
    $pkg = if ($Version) { "carina-agent@$Version" } else { 'carina-agent@latest' }
    npm install -g $pkg --loglevel=error
    $env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
                [System.Environment]::GetEnvironmentVariable('Path', 'User')
}

function Resolve-CarinaExe {
    $cmd = Get-Command carina -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $npmPrefix = npm config get prefix 2>$null
    if ($npmPrefix) {
        $candidate = Join-Path $npmPrefix 'carina.cmd'
        if (Test-Path $candidate) { return $candidate }
    }
    throw 'carina CLI not found after install'
}

function Initialize-Carina {
    param([string]$CarinaExe)
    $configDir = Join-Path $env:USERPROFILE '.carina'
    $configFile = Join-Path $configDir '.env'
  New-Item -ItemType Directory -Force -Path $configDir | Out-Null
    if (-not (Test-Path $configFile)) {
        Write-Step 'Running first-time setup'
        & $CarinaExe setup
    }
    Write-Step 'Running doctor'
    & $CarinaExe doctor --quiet
}

function Register-Gateway {
    param([string]$CarinaExe)
    if ($SkipGateway) { return }
    Write-Step 'Installing gateway logon task (carina host install)'
    & $CarinaExe host install
}

function New-StartMenuShortcut {
    param([string]$CarinaExe)
    if ($SkipShortcut) { return }
    $launcher = Join-Path $PSScriptRoot 'nsis/launch-carina.ps1'
    if (-not (Test-Path $launcher)) { return }
    $programs = [Environment]::GetFolderPath('Programs')
    $folder = Join-Path $programs 'Carina'
    New-Item -ItemType Directory -Force -Path $folder | Out-Null
    $shortcut = (New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path $folder 'Carina Chat.lnk'))
    $shortcut.TargetPath = 'powershell.exe'
    $shortcut.Arguments = "-NoExit -ExecutionPolicy Bypass -File `"$launcher`""
    $shortcut.WorkingDirectory = $env:USERPROFILE
    $shortcut.Save()
}

Write-Step 'Carina Windows native install'
Test-WindowsVersion
Ensure-Node
Install-Carina
$carina = Resolve-CarinaExe
Initialize-Carina -CarinaExe $carina
Register-Gateway -CarinaExe $carina
New-StartMenuShortcut -CarinaExe $carina

Write-Host ''
Write-Host 'Done. Run: carina chat' -ForegroundColor Green
Write-Host 'Or open Start Menu > Carina > Carina Chat' -ForegroundColor Green
Write-Host 'Docs: docs/WINDOWS.md' -ForegroundColor Gray
