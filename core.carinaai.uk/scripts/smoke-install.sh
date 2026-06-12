#!/usr/bin/env bash
# Smoke-test a clean npm install of carina-agent (no monorepo checkout required at runtime).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

cd "${ROOT}"

echo "==> build"
pnpm build >/dev/null

echo "==> npm pack"
TGZ_NAME="$(npm pack --pack-destination "${WORK}" 2>/dev/null | tail -1)"
TGZ_PATH="${WORK}/${TGZ_NAME}"
test -f "${TGZ_PATH}"

mkdir -p "${WORK}/home"
export HOME="${WORK}/home"
export CARINA_HOME="${WORK}/home/.carina"

echo "==> npm install ${TGZ_NAME}"
mkdir -p "${WORK}/install"
cd "${WORK}/install"
npm init -y >/dev/null 2>&1
npm install "${TGZ_PATH}" >/dev/null

BIN="${WORK}/install/node_modules/.bin/carina"
test -x "${BIN}"

VERSION="$("${BIN}" --version)"
echo "==> version: ${VERSION}"
echo "${VERSION}" | grep -q 'carina-agent'

echo "==> non-interactive setup"
"${BIN}" setup </dev/null
test -f "${CARINA_HOME}/.env"
test -f "${CARINA_HOME}/config.yaml"

echo "==> CLI help"
HELP="$("${BIN}" help 2>&1)"
echo "${HELP}" | grep -q 'setup'

echo "==> TUI startup banner (no API key yet)"
TUI_OUT="$(timeout 12 env CARINA_LOCAL_MODE=true CARINA_SKIP_POSTGRES=true "${BIN}" tui 2>&1 || true)"
echo "${TUI_OUT}" | grep -q 'CARINA'

echo "==> doctor"
DOC="$("${BIN}" doctor 2>&1 || true)"
echo "${DOC}" | grep -q 'Carina doctor'

echo "==> npx entry"
NPX_OUT="$(cd "${WORK}/install" && npx --yes carina-agent --version 2>/dev/null)"
echo "${NPX_OUT}" | grep -q 'carina-agent'

echo "smoke-install: ok"
