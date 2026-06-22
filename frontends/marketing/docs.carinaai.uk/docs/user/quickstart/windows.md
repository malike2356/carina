# Windows quickstart

Carina runs on Windows with Node.js 22+. WSL2 is recommended for Docker-based sandboxing and parity with Linux deploy scripts.

## 1. Install Node.js

Install Node.js 22 LTS from [nodejs.org](https://nodejs.org/) or use `winget install OpenJS.NodeJS.LTS`.

## 2. Install Carina

```powershell
npm install -g carina-agent
carina --version
```

Native curl installer support may vary; npm is the most reliable path on Windows today.

## 3. Onboard

```powershell
carina onboard
```

Store API keys in `%USERPROFILE%\.carina\.env`, not in the repo.

## 4. WSL2 (recommended for tools)

For sandboxed `shell-exec` and `code-exec`:

1. Install WSL2 and Docker Desktop
2. Run Carina inside WSL for tool execution, or point Docker from Windows PowerShell

## 5. First chat

```powershell
carina "Confirm Windows install works."
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| `carina` not found | Re-open terminal after npm global install; check npm global bin path |
| Sandbox tools fail | Enable WSL2 + Docker Desktop |
| Line ending issues in `.env` | Save `.env` as UTF-8 LF |

## Next

- [Install](/docs/user/install)
- [Troubleshooting](/docs/user/troubleshooting)
