@echo off
setlocal

echo Installing Carina...

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required. Install Node.js 22+ from https://nodejs.org then re-run.
  exit /b 1
)

for /f "tokens=1 delims=." %%a in ('node --version') do set NODE_VER=%%a
set NODE_MAJOR=%NODE_VER:v=%
if %NODE_MAJOR% LSS 22 (
  echo Node.js 22+ required. Current: 
  node --version
  exit /b 1
)

call npm install -g carina-agent
if errorlevel 1 exit /b 1

echo.
echo Carina installed.
echo.
echo   carina          start chat (first-run setup if needed)
echo   carina setup    configure API keys
echo   carina onboard  guided setup + doctor
echo   carina doctor   check install health
echo.
echo Hosted option (no install): https://app.carinaai.uk
echo Docker option: see docs/self-hosting.md
echo.

endlocal
