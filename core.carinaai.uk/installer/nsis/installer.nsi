!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "x64.nsh"

!ifndef APP_VERSION
  !define APP_VERSION "0.2.0"
!endif

!ifndef NODE_VERSION
  !define NODE_VERSION "22.14.0"
!endif

!define APP_NAME "Carina"
!define NODE_INSTALLER "node-v${NODE_VERSION}-x64.msi"
!define PUBLISHER "VERLOX (verlox.uk)"
!define UNINSTALL_REG "Software\Microsoft\Windows\CurrentVersion\Uninstall\Carina"
!define NODEJS_DIR "$PROGRAMFILES64\nodejs"

Name "${APP_NAME} ${APP_VERSION}"
OutFile "..\carina-setup-${APP_VERSION}.exe"
InstallDir "$PROGRAMFILES64\Carina"
RequestExecutionLevel admin
Unicode true

!define MUI_ICON "carina.ico"
!define MUI_UNICON "carina.ico"
!define MUI_ABORTWARNING

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "..\..\LICENSE"
!insertmacro MUI_PAGE_COMPONENTS
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "English"

LangString DESC_SecCore ${LANG_ENGLISH} "Install Carina CLI and bundled Node.js runtime when needed."
LangString DESC_SecStartMenu ${LANG_ENGLISH} "Create Start Menu shortcuts for Carina Chat and uninstall."
LangString DESC_SecDesktop ${LANG_ENGLISH} "Create a Desktop shortcut for Carina Chat."

Function CheckWindowsVersion
  ReadRegStr $0 HKLM "SOFTWARE\Microsoft\Windows NT\CurrentVersion" "CurrentBuildNumber"
  IntOp $1 $0 + 0
  ${If} $1 < 17763
    MessageBox MB_OK|MB_ICONSTOP "Carina requires Windows 10 version 1809 or later (Build 17763+).$\nYour build: $0"
    Abort
  ${EndIf}
FunctionEnd

Function NodeMajorAtLeast22
  Push $R0
  Push $R1
  ClearErrors
  ReadRegStr $R0 HKLM "SOFTWARE\Node.js" "Version"
  ${If} $R0 == ""
    Pop $R1
    Pop $R0
    Push 0
    Return
  ${EndIf}
  StrCpy $R1 $R0 2
  IntOp $R1 $R1 + 0
  Pop $R0
  ${If} $R1 >= 22
    Push 1
  ${Else}
    Push 0
  ${EndIf}
FunctionEnd

Function InstallBundledNode
  SetOutPath "$PLUGINSDIR"
  File "staging\${NODE_INSTALLER}"
  ExecWait 'msiexec /i "$PLUGINSDIR\${NODE_INSTALLER}" /quiet /norestart ADDLOCAL=ALL' $0
  Delete "$PLUGINSDIR\${NODE_INSTALLER}"
  ${If} $0 != 0
    MessageBox MB_OK|MB_ICONEXCLAMATION "Node.js installation failed (exit code $0)."
    Abort
  ${EndIf}
FunctionEnd

Function InstallCarinaPackage
  Push $0
  ClearErrors
  IfFileExists "${NODEJS_DIR}\npm.cmd" 0 missing_npm
    nsExec::ExecToStack '"${NODEJS_DIR}\npm.cmd" install -g carina-agent@${APP_VERSION} --loglevel=error'
    Pop $0
    Pop $1
    ${If} $0 != 0
      MessageBox MB_OK|MB_ICONEXCLAMATION "npm install failed (exit code $0).$\nCheck your internet connection and try again.$\n$1"
      Abort
    ${EndIf}
    Goto done
  missing_npm:
    MessageBox MB_OK|MB_ICONEXCLAMATION "npm was not found after Node.js installation."
    Abort
  done:
  Pop $0
FunctionEnd

Section "!Carina (required)" SecCore
  SectionIn RO
  Call CheckWindowsVersion
  SetOutPath "$INSTDIR"
  File "launch-carina.ps1"
  File "carina.ico"

  Call NodeMajorAtLeast22
  Pop $0
  ${If} $0 == 0
    Call InstallBundledNode
  ${EndIf}

  Call InstallCarinaPackage

  WriteRegStr HKLM "${UNINSTALL_REG}" "DisplayName" "${APP_NAME}"
  WriteRegStr HKLM "${UNINSTALL_REG}" "DisplayVersion" "${APP_VERSION}"
  WriteRegStr HKLM "${UNINSTALL_REG}" "Publisher" "${PUBLISHER}"
  WriteRegStr HKLM "${UNINSTALL_REG}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKLM "${UNINSTALL_REG}" "UninstallString" "$INSTDIR\Uninstall.exe"
  WriteUninstaller "$INSTDIR\Uninstall.exe"
SectionEnd

Section "Start Menu shortcut" SecStartMenu
  CreateDirectory "$SMPROGRAMS\Carina"
  CreateShortcut "$SMPROGRAMS\Carina\Carina Chat.lnk" \
    "$WINDIR\System32\WindowsPowerShell\v1.0\powershell.exe" \
    '-NoExit -ExecutionPolicy Bypass -File "$INSTDIR\launch-carina.ps1"' \
    "$INSTDIR\carina.ico"
  CreateShortcut "$SMPROGRAMS\Carina\Uninstall Carina.lnk" "$INSTDIR\Uninstall.exe" \
    "" "$INSTDIR\carina.ico"
SectionEnd

Section /o "Desktop shortcut" SecDesktop
  CreateShortcut "$DESKTOP\Carina Chat.lnk" \
    "$WINDIR\System32\WindowsPowerShell\v1.0\powershell.exe" \
    '-NoExit -ExecutionPolicy Bypass -File "$INSTDIR\launch-carina.ps1"' \
    "$INSTDIR\carina.ico"
SectionEnd

!insertmacro MUI_FUNCTION_DESCRIPTION_BEGIN
  !insertmacro MUI_DESCRIPTION_TEXT ${SecCore} $(DESC_SecCore)
  !insertmacro MUI_DESCRIPTION_TEXT ${SecStartMenu} $(DESC_SecStartMenu)
  !insertmacro MUI_DESCRIPTION_TEXT ${SecDesktop} $(DESC_SecDesktop)
!insertmacro MUI_FUNCTION_DESCRIPTION_END

Section "Uninstall"
  IfFileExists "${NODEJS_DIR}\npm.cmd" 0 skip_npm
    nsExec::ExecToStack '"${NODEJS_DIR}\npm.cmd" uninstall -g carina-agent --loglevel=error'
  skip_npm:
  Delete "$INSTDIR\launch-carina.ps1"
  Delete "$INSTDIR\carina.ico"
  Delete "$INSTDIR\Uninstall.exe"
  Delete "$SMPROGRAMS\Carina\Carina Chat.lnk"
  Delete "$SMPROGRAMS\Carina\Uninstall Carina.lnk"
  Delete "$DESKTOP\Carina Chat.lnk"
  RMDir "$SMPROGRAMS\Carina"
  RMDir "$INSTDIR"
  DeleteRegKey HKLM "${UNINSTALL_REG}"
SectionEnd
