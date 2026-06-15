param(
    [string]$Version = '0.2.0',
    [string]$NodeVersion = '22.14.0',
    [string]$NsisPath = "${env:ProgramFiles(x86)}\NSIS\makensis.exe"
)

$ErrorActionPreference = 'Stop'
$Root = $PSScriptRoot
$NsisDir = Join-Path $Root 'nsis'
$StagingDir = Join-Path $NsisDir 'staging'
$NodeInstaller = "node-v$NodeVersion-x64.msi"
$NodeUrl = "https://nodejs.org/dist/v$NodeVersion/$NodeInstaller"

if (-not (Test-Path $NsisPath)) {
    Write-Host "NSIS not found at $NsisPath" -ForegroundColor Red
    Write-Host 'Install NSIS: https://nsis.sourceforge.io/Download' -ForegroundColor Yellow
    Write-Host 'Or: choco install nsis --yes' -ForegroundColor Yellow
    exit 1
}

New-Item -ItemType Directory -Force -Path $StagingDir | Out-Null
$NodeMsiPath = Join-Path $StagingDir $NodeInstaller
if (-not (Test-Path $NodeMsiPath)) {
    Write-Host "Downloading $NodeUrl ..." -ForegroundColor Cyan
    Invoke-WebRequest -Uri $NodeUrl -OutFile $NodeMsiPath
}

Write-Host "Building carina-setup-$Version.exe ..." -ForegroundColor Cyan
& $NsisPath /V4 `
    "/DAPP_VERSION=$Version" `
    "/DNODE_VERSION=$NodeVersion" `
    (Join-Path $NsisDir 'installer.nsi')

if ($LASTEXITCODE -ne 0) {
    Write-Host 'NSIS build failed' -ForegroundColor Red
    exit 1
}

$Output = Join-Path $Root "carina-setup-$Version.exe"
Write-Host "Built: $Output" -ForegroundColor Green
