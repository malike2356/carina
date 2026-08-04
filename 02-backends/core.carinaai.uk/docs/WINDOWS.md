# Carina on Windows (native, no WSL)

Carina runs natively on Windows 10 version 1809 (build 17763) or later. You do not need WSL or Docker for basic chat, tools, file work, memory, channels, or the local web UI.

## Quick install (recommended)

### Option A: One-click installer (release)

1. Download `carina-setup-<version>.exe` from the [GitHub release](https://github.com/malike2356/carina-agent/releases).
2. Run the installer (UAC prompt is expected).
3. Open **Carina Chat** from the Start Menu.
4. Complete `carina setup` on first launch, then chat.

The installer bundles Node.js 22 when needed, runs `npm install -g carina-agent@<version>`, and creates Start Menu shortcuts.

### Option B: PowerShell script (from source or dev)

From `core.carinaai.uk`:

```powershell
powershell -ExecutionPolicy Bypass -File installer/install-windows.ps1
```

This installs Node 22 via winget when missing, installs `carina-agent` globally, runs first-time setup, and registers an optional gateway task.

## After install

| Goal | Command |
|------|---------|
| Interactive chat | `carina chat` or Start Menu **Carina Chat** |
| First-time API keys | `carina setup` |
| Health check | `carina doctor` |
| Local web UI + gateway | `carina host install` then `carina host start` |
| Check for updates | `carina update check` |
| Apply update | `carina update run` |

Default gateway URL: `http://127.0.0.1:7430`

## Windows service model

Carina does not install a Windows Service (services.msc). It uses:

- **Foreground:** `carina chat`, `carina serve`, `carina host supervise`
- **Background gateway:** `carina host start` (detached supervisor)
- **Logon task (optional):** `carina host install` creates scheduled task `CarinaGateway` via `schtasks`

Task details are logged to `%USERPROFILE%\.carina\daemon.log`.

## Shell and tools

- `shell-exec` uses **PowerShell** on Windows (`pwsh.exe` when available).
- File tools use `path.join` and `%USERPROFILE%\.carina` for state.
- `code-exec` sandbox prefers Docker when present; otherwise returns a clear message (no silent WSL requirement).
- PTY mode requires Windows 10 1809+ (ConPTY).

## Environment

| Variable | Default on Windows |
|----------|-------------------|
| `CARINA_HOME` | `%USERPROFILE%\.carina` |
| Config file | `%USERPROFILE%\.carina\.env` |
| Gateway port | `7430` (`WEB_PORT` / `CARINA_PORT`) |

Set `CARINA_DIRECT_SHELL=true` in `.env` for host shell execution (required for npm, git, pip on the host).

## Updates

```powershell
carina update check
carina update run
```

Or reinstall the latest `carina-setup.exe` from GitHub releases.

## Validation

Run the Windows validation script after install or when debugging:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/validate-windows.ps1
```

From the repo (developers):

```bash
pnpm vitest run src/windows/
pnpm vitest run src/tools/shell-exec.windows.test.ts
```

CI runs the full test suite on `windows-latest` with `FORCE_PLATFORM=win32`.

## Recovery

| Symptom | Fix |
|---------|-----|
| `carina` not found | Open a new terminal; or `npm install -g carina-agent@latest` |
| Setup incomplete | `carina setup` |
| Gateway not running | `carina host status`; `carina host restart` |
| Scheduled task stuck | `schtasks /End /TN CarinaGateway`; `carina host uninstall`; reinstall with `carina host install` |
| Corrupt local state | `carina doctor`; `carina reset --scope soft` (keeps CLI) |
| Full reset | `carina uninstall --purge-state` then reinstall |

Logs: `%USERPROFILE%\.carina\daemon.log`

## Building the NSIS installer

On a Windows machine with NSIS installed:

```powershell
cd core.carinaai.uk/installer
.\build-installer.ps1 -Version 0.2.0
```

Output: `installer/carina-setup-0.2.0.exe`

GitHub Actions attaches this artifact on version tags (`v*`).

## What is not required

- WSL or Linux subsystem
- Docker (optional for sandboxed code-exec only)
- Hyper-V Linux VMs

## Related docs

- [CARINA_WINDOWS.md](../../instructions/CARINA_WINDOWS.md) (platform friction notes)
- `carina doctor` for runtime diagnostics
- `carina capabilities audit` for installed tool/skill/channel inventory
