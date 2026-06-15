# Carina launcher - opens an interactive Carina chat session
# Runs carina setup if no API key is configured

$ErrorActionPreference = 'Stop'

# Refresh PATH so the freshly installed npm global bin is available
$env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
            [System.Environment]::GetEnvironmentVariable('Path', 'User')

function Resolve-CarinaCommand {
    $carinaCmd = Get-Command carina -ErrorAction SilentlyContinue
    if ($carinaCmd) {
        return $carinaCmd.Source
    }

    $npmPrefix = npm config get prefix 2>$null
    if ($npmPrefix) {
        $npmCarina = Join-Path $npmPrefix 'carina.cmd'
        if (Test-Path $npmCarina) {
            return $npmCarina
        }
    }

    $fallback = Join-Path ${env:ProgramFiles} 'nodejs\carina.cmd'
    if (Test-Path $fallback) {
        return $fallback
    }

    return $null
}

$carinaExe = Resolve-CarinaCommand
if (-not $carinaExe) {
    Write-Host 'Carina not found in PATH. Try reinstalling or run: npm install -g carina-agent' -ForegroundColor Red
    Read-Host 'Press Enter to exit'
    exit 1
}

$configDir = Join-Path $env:USERPROFILE '.carina'
$configFile = Join-Path $configDir '.env'
if (-not (Test-Path $configFile)) {
    Write-Host 'Welcome to Carina! Let us set up your API keys.' -ForegroundColor Cyan
    & $carinaExe setup
}

Write-Host 'Starting Carina chat...' -ForegroundColor Green
& $carinaExe chat
