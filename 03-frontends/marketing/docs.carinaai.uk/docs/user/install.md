# Install Carina

This page covers every supported install path for the self-hosted Carina agent. For the hosted browser app, see [Carina Cloud](/docs/user/carina-cloud) instead. Scout is separate and does not change the install path here.

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Node.js | 22+ | Required for npm and source installs |
| pnpm | 9+ | Required for source builds only |
| PostgreSQL | 16+ | Optional but recommended for episodic memory and RAG |
| Redis | 7+ | Optional; used for session persistence and Scout kill-switch |
| Docker | Latest | Optional; required for sandboxed shell and code execution |

You also need at least one model provider API key before your first chat.

## Option 1: Quick install (macOS and Linux)

```bash
curl -fsSL https://get.carinaai.uk | bash
```

The installer downloads the latest CLI, places the `carina` binary on your PATH, and creates `~/.carina/` for config and data.

Verify:

```bash
carina --version
carina doctor
```

## Option 2: npm global install

```bash
npm install -g carina-agent
carina --version
```

Package: [carina-agent on npm](https://www.npmjs.com/package/carina-agent). Requires Node.js 22+.

On first run, Carina can walk you through setup with `carina onboard`.

## Option 3: Docker

```bash
docker pull ghcr.io/verlox/carina:latest
docker run -d \
  --name carina \
  -p 3333:3333 \
  -v ~/.carina:/home/node/.carina \
  -e ANTHROPIC_API_KEY=your-key \
  ghcr.io/verlox/carina:latest
```

Mount `~/.carina` so sessions, memory, and config survive container restarts. Point your client or gateway at port `3333`.

Check health from inside the container or host:

```bash
carina doctor
curl -s http://localhost:3333/health
```

## Option 4: Build from source

```bash
git clone https://github.com/verlox/carina.git
cd carina/backends/servers/core.carinaai.uk
pnpm install
pnpm build
pnpm link --global
carina --version
```

Use this path for contributors or when you need unreleased features from `main`.

## Verification checklist

| Step | Command | Expected |
|---|---|---|
| CLI present | `carina --version` | Prints semver |
| Health | `carina doctor` | No critical failures |
| First chat | `carina` or `carina onboard` | Guided setup or TUI launcher |
| Gateway (optional) | `carina gateway start` | Listens on configured port |

## Next steps

- [Onboarding walkthrough](/docs/user/onboarding)
- [Platform quickstarts](/docs/user/quickstart/macos)
- [Configuration](/docs/user/configuration)
- [Getting started](/docs/user/getting-started)
