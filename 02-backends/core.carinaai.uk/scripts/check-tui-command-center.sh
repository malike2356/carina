#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "Carina TUI Command Center checks"
echo

pnpm exec vitest run src/tui

echo
pnpm exec tsx -e "import { getCommandCenterContractReport } from './src/tui/command-center/contract-report.ts'; console.log(getCommandCenterContractReport());"
