# Carina Kernel: Windows one-click installer (carina-setup.exe)

## Goal

Ship a `carina-setup.exe` that bundles Node.js and installs Carina on Windows with a
single double-click. No terminal, no npm, no WSL required. After installation, a
"Carina" shortcut opens a PowerShell terminal running `carina chat`. This removes all
Windows friction.

## Context

VS Code, Docker Desktop, and Cursor all ship a Windows `.exe` installer that bundles their
runtime. Carina can do the same using the NSIS (Nullsoft Scriptable Install System) via
the `electron-builder` or a standalone NSIS wrapper around a bundled Node.js binary.

Two approaches:

| Approach | Effort | Output size | Pros |
|----------|--------|-------------|------|
| NSIS + bundled Node.js portable | Medium | ~60MB | Simple, no Electron required |
| Electron wrapper | High | ~120MB | Full GUI possible later |

This prompt implements the NSIS approach since Carina is a CLI tool and does not need a
GUI today. The installer bundles the Node.js LTS binary, installs `carina-agent` globally,
and creates a Windows shortcut.

## Dependencies

Prompts 25-30 complete (Carina must work on Windows before shipping the installer).

## Files to create

```
core.carinaai.uk/installer/
  build-installer.ps1            (PowerShell script to build the .exe)
  nsis/installer.nsi             (NSIS installer script)
  nsis/carina.ico                (application icon, 256x256 ICO format)
  nsis/launch-carina.ps1         (post-install launcher script)
  .github/workflows/release.yml  (build and attach installer to GitHub releases)
```

## Step-by-step

### 1. Understand the installer flow

The installer does the following:
1. Checks Windows version (10 1809+ required for ConPTY)
2. Installs Node.js 22 LTS if not already present (or if version is below 22)
3. Runs `npm install -g carina-agent@<version>` using the installed Node.js
4. Creates a Start Menu shortcut: "Carina" -> launches `carina.cmd chat` in a new PowerShell window
5. Creates a Desktop shortcut (optional, user can deselect)
6. Adds `carina` to the Windows PATH
7. Optionally runs `carina setup` to collect the first API key

### 2. NSIS installer script

`installer/nsis/installer.nsi`:

```nsis
!define APP_NAME "Carina"
!define APP_VERSION "0.2.0"
!define NODE_VERSION "22.0.0"
!define NODE_INSTALLER "node-v22.0.0-x64.msi"
!define NODE_URL "https://nodejs.org/dist/v22.0.0/node-v22.0.0-x64.msi"
!define PUBLISHER "VERLOX (verlox.uk)"
!define UNINSTALL_REG "Software\Microsoft\Windows\CurrentVersion\Uninstall\Carina"

Name "${APP_NAME} ${APP_VERSION}"
OutFile "carina-setup-${APP_VERSION}.exe"
InstallDir "$PROGRAMFILES64\Carina"
RequestExecutionLevel admin

!include MUI2.nsh

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "..\..\LICENSE"
!insertmacro MUI_PAGE_COMPONENTS
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "English"

Section "Carina (required)" SecCore
  SectionIn RO

; Check Windows version (need 10 1809+ for ConPTY)
  ReadRegStr $0 HKLM "SOFTWARE\Microsoft\Windows NT\CurrentVersion" "CurrentBuildNumber"
  IntCmp $0 17763 +2 +2 0
    MessageBox MB_OK|MB_ICONSTOP "Carina requires Windows 10 version 1809 or later (Build 17763+). Your build: $0"
    Abort

  SetOutPath "$INSTDIR"

; Copy launcher script
  File "launch-carina.ps1"

; Install Node.js if not already present at v22+
  nsExec::ExecToStack 'node --version'
  Pop $0
  Pop $1
  StrCmp $0 "0" node_ok

; Node.js not found or old version; download and install
  inetc::get "${NODE_URL}" "$TEMP\${NODE_INSTALLER}" /END
  ExecWait 'msiexec /i "$TEMP\${NODE_INSTALLER}" /quiet /norestart ADDLOCAL=ALL'
  Delete "$TEMP\${NODE_INSTALLER}"

  node_ok:

; Install carina-agent globally
  nsExec::ExecToStack 'npm install -g carina-agent@${APP_VERSION} --prefer-offline'
  Pop $0
  Pop $1
  IntCmp $0 0 install_ok
    MessageBox MB_OK|MB_ICONEXCLAMATION "npm install failed (exit code $0). Check your internet connection and try again.$\nError: $1"
    Abort
  install_ok:

; Write uninstall registry keys
  WriteRegStr HKLM "${UNINSTALL_REG}" "DisplayName" "${APP_NAME}"
  WriteRegStr HKLM "${UNINSTALL_REG}" "DisplayVersion" "${APP_VERSION}"
  WriteRegStr HKLM "${UNINSTALL_REG}" "Publisher" "${PUBLISHER}"
  WriteRegStr HKLM "${UNINSTALL_REG}" "UninstallString" "$INSTDIR\Uninstall.exe"
  WriteUninstaller "$INSTDIR\Uninstall.exe"

SectionEnd

Section "Start Menu shortcut" SecStartMenu
  CreateDirectory "$SMPROGRAMS\Carina"
  CreateShortcut "$SMPROGRAMS\Carina\Carina Chat.lnk" \
    "powershell.exe" \
    "-NoExit -ExecutionPolicy Bypass -File `"$INSTDIR\launch-carina.ps1`"" \
    "$INSTDIR\carina.ico"
  CreateShortcut "$SMPROGRAMS\Carina\Uninstall Carina.lnk" "$INSTDIR\Uninstall.exe"
SectionEnd

Section /o "Desktop shortcut" SecDesktop
  CreateShortcut "$DESKTOP\Carina Chat.lnk" \
    "powershell.exe" \
    "-NoExit -ExecutionPolicy Bypass -File `"$INSTDIR\launch-carina.ps1`"" \
    "$INSTDIR\carina.ico"
SectionEnd

Section "Uninstall"
  nsExec::ExecToStack 'npm uninstall -g carina-agent'
  Delete "$INSTDIR\launch-carina.ps1"
  Delete "$INSTDIR\Uninstall.exe"
  Delete "$SMPROGRAMS\Carina\Carina Chat.lnk"
  Delete "$SMPROGRAMS\Carina\Uninstall Carina.lnk"
  Delete "$DESKTOP\Carina Chat.lnk"
  RMDir "$SMPROGRAMS\Carina"
  RMDir "$INSTDIR"
  DeleteRegKey HKLM "${UNINSTALL_REG}"
SectionEnd
```

### 3. Launcher PowerShell script

`installer/nsis/launch-carina.ps1`:
```powershell
# Carina launcher - opens an interactive Carina chat session
# Runs carina setup if no API key is configured

$ErrorActionPreference = 'Stop'

# Refresh PATH so the freshly installed npm global bin is available
$env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
            [System.Environment]::GetEnvironmentVariable('Path', 'User')

# Check if carina is callable
$carinaCmd = Get-Command carina -ErrorAction SilentlyContinue
if (-not $carinaCmd) {
    Write-Host "Carina not found in PATH. Checking npm global bin..." -ForegroundColor Yellow
    $npmBin = (npm config get prefix) + '\carina.cmd'
    if (Test-Path $npmBin) {
        Set-Alias -Name carina -Value $npmBin
    } else {
        Write-Host "Could not find carina. Please run: npm install -g carina-agent" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
}

# Run setup if no config exists
$configDir = Join-Path $env:USERPROFILE '.carina'
$configFile = Join-Path $configDir 'config.json'
if (-not (Test-Path $configFile)) {
    Write-Host "Welcome to Carina! Let's set up your API keys." -ForegroundColor Cyan
    carina setup
}

Write-Host "Starting Carina chat..." -ForegroundColor Green
carina chat
```

### 4. Build script

`installer/build-installer.ps1`:
```powershell
param(
    [string]$Version = "0.2.0",
    [string]$NsisPath = "C:\Program Files (x86)\NSIS\makensis.exe"
)

$ErrorActionPreference = 'Stop'

# Verify NSIS is installed
if (-not (Test-Path $NsisPath)) {
    Write-Host "NSIS not found at $NsisPath" -ForegroundColor Red
    Write-Host "Download from: https://nsis.sourceforge.io/Download" -ForegroundColor Yellow
    exit 1
}

# Update version in installer script
$nsisScript = Get-Content "nsis\installer.nsi" -Raw
$nsisScript = $nsisScript -replace '!define APP_VERSION ".*"', "!define APP_VERSION `"$Version`""
$nsisScript | Set-Content "nsis\installer.nsi"

# Build
Write-Host "Building carina-setup-$Version.exe..." -ForegroundColor Cyan
& $NsisPath /V4 "nsis\installer.nsi"

if ($LASTEXITCODE -ne 0) {
    Write-Host "NSIS build failed" -ForegroundColor Red
    exit 1
}

Write-Host "Built: carina-setup-$Version.exe" -ForegroundColor Green
```

### 5. GitHub Actions release workflow

`.github/workflows/release.yml`:
```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build-windows-installer:
    runs-on: windows-latest
    permissions:
      contents: write

    steps:
      - uses: actions/checkout@v4

      - name: Install NSIS
        run: |
          choco install nsis --yes
        shell: powershell

      - name: Extract version from tag
        id: version
        run: |
          $tag = "${{ github.ref_name }}"
          $version = $tag.TrimStart('v')
          echo "version=$version" >> $env:GITHUB_OUTPUT
        shell: powershell

      - name: Build installer
        working-directory: core.carinaai.uk/installer
        run: |
          .\build-installer.ps1 -Version "${{ steps.version.outputs.version }}"
        shell: powershell

      - name: Attach installer to GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          files: core.carinaai.uk/installer/carina-setup-${{ steps.version.outputs.version }}.exe
          fail_on_unmatched_files: true
```

When a version tag (`v0.2.0`) is pushed, this workflow builds the `.exe` and attaches
it to the GitHub release automatically.

### 6. Icon file

Place a 256x256 ICO file at `installer/nsis/carina.ico`. ICO files can contain
multiple resolutions (16x16, 32x32, 48x48, 256x256). Use an online converter or
ImageMagick to create it from the Carina logo PNG:

```bash
# On Linux/macOS with ImageMagick:
convert logo-256.png -define icon:auto-resize=256,48,32,16 carina.ico
```

On Windows with GIMP: File > Export As > .ico, enable all sizes.

## Expected behavior

Windows user experience:
1. Downloads `carina-setup-0.2.0.exe` from the GitHub release page
2. Double-clicks the file
3. Windows Defender SmartScreen may prompt: "More info" > "Run anyway" (expected for new publishers; code signing removes this)
4. Installer runs: installs Node.js if needed, installs carina-agent, creates shortcuts
5. Clicks "Carina Chat" from the Start Menu
6. PowerShell window opens, `carina setup` runs if first time, then `carina chat` starts
7. User types a question and Carina responds

Total install time: 2-3 minutes (mostly Node.js download if not already installed).

## Optional: code signing

Without a code signing certificate, Windows Defender SmartScreen shows a warning. For
production:
1. Purchase an Extended Validation (EV) Code Signing certificate (~$200-400/year)
2. Or use a Standard Code Signing certificate (warning still shows for new publishers)
3. Sign with: `signtool sign /f cert.pfx /p password /t http://timestamp.digicert.com carina-setup.exe`

This can be done in the GitHub Actions workflow using a certificate stored as a GitHub secret.

## Pitfalls

- NSIS `inetc::get` (downloading Node.js) requires the `INetC` NSIS plugin which must
  be installed alongside NSIS; install with: `choco install nsis-inetc-plugin`
- The Node.js MSI installer requires admin rights; the NSIS script uses
  `RequestExecutionLevel admin` so Windows will prompt for UAC elevation
- `npm install -g` inside the NSIS installer runs during install, not as the logged-in
  user. PATH differences may prevent the installed `carina.cmd` from being found by the
  launcher. The launcher script includes a PATH refresh to handle this
- Windows Defender may flag the `.exe` as a false positive on first upload to GitHub.
  If this happens, submit the file to Microsoft for analysis at
  `www.microsoft.com/en-us/wdsi/filesubmission`
- The NSIS-based installer does not support automatic updates. For auto-update, consider
  migrating to Electron + `electron-updater` in a future version. The NSIS installer is
  fine for V1
