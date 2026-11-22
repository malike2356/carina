# Carina kernel

Self-hosted AI agent kernel: tools, memory, model routing, channels, and CLI.

MIT licensed. Public npm package: **`carina-agent`**. Scoped package name **`@verlox/carina-core`** is reserved for a future split and is not the live install path yet.

See [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md).

## Install

### Windows

Install Node.js 22+, then:

```powershell
npm install -g carina-agent
carina setup
```

PowerShell direct shell mode works on Windows. Docker Desktop is required for stronger shell isolation and Python code execution. Installer source lives in `installer/`; to build it locally on Windows, install [NSIS](https://nsis.sourceforge.io/Download), then run `installer/build-installer.ps1`.

### macOS / Linux

```bash
npm install -g carina-agent
carina setup
```

Domain packs are optional; enable with `carina packs enable property-uk` or install from Hub.

## Monorepo development

From this directory:

```bash
pnpm install
pnpm carina
pnpm test
```

The full platform (ops, clients, docs) lives at the repository root. See the root `README.md`.

## Contact

Verlox Ltd: [contact@verlox.uk](mailto:contact@verlox.uk)
