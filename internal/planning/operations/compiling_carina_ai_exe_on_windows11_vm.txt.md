 Everything is ready. Here is the build plan.
    
    Current state:
    - NSIS script: complete (164 lines, production quality)
    - Build script: complete (58 lines, auto-downloads Node.js MSI)
    - Launcher: complete (62 lines)
    - Icon: valid .ico file (1 icon, 16x16)
    - GitHub Actions release workflow: ready
    - VM share: /home/malike mapped, auto-mount, writable
    
    One issue: The .ico has only 16x16 resolution. For production, it should have 16x16, 32x32, 48x48, and 256x256. Windows uses different sizes for taskbar, desktop, and Start Menu. Not a blocker for a first build, but will look pixelated in some places.
    
    Build steps for your Windows 11 VM:
    
    
    1. Start the Windows 11 VM
    2. Open PowerShell as Administrator
    3. Navigate to the installer via the shared folder:
    
       cd \\VBOXSVR\malike\opt\lampp\htdocs\verlox\carina\core.carinaai.uk\installer
    
    4. Install NSIS if not already present:
    
       winget install NSIS.NSIS
    
    5. Run the build:
    
       powershell -ExecutionPolicy Bypass -File .\build-installer.ps1
    
    6. The .exe will be at:
    
       carina-setup-0.2.0.exe
    
    
    What build-installer.ps1 does:
    - Downloads node-v22.14.0-x64.msi into nsis/staging/
    - Generates a placeholder .ico if missing
    - Runs makensis.exe with the version defines
    - Outputs the .exe one directory up
    
    The resulting carina-setup-0.2.0.exe (~70MB, mostly the bundled Node.js MSI) will:
    1. Check Windows 10 build 17763+
    2. Install Node.js 22 if missing (detects via registry)
    3. Run npm install -g carina-agent@0.2.0
    4. Create Start Menu shortcut "Carina Chat"
    5. Create optional Desktop shortcut
    6. Register in Add/Remove Programs with uninstaller
    
    Want me to prepare anything else before you spin up the VM?

