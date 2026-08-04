#!/bin/sh
set -e

echo "Installing Carina..."

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required. Install it from nodejs.org then re-run this script."
  exit 1
fi

NODE_MAJOR=$(node --version | cut -d. -f1 | tr -d 'v')
if [ "$NODE_MAJOR" -lt 22 ]; then
  echo "Node.js 22+ required. Current: $(node --version)"
  exit 1
fi

npm install -g carina-agent

echo ""
echo "Carina installed. Run: carina"
