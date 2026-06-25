#!/bin/sh
set -e

echo "Installing Carina..."

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 22+ is required. Install from https://nodejs.org then re-run."
  exit 1
fi

NODE_MAJOR=$(node --version | cut -d. -f1 | tr -d 'v')
if [ "$NODE_MAJOR" -lt 22 ]; then
  echo "Node.js 22+ required. Current: $(node --version)"
  exit 1
fi

npm install -g carina-agent

echo ""
echo "Carina installed."
echo ""
echo "  carina          start chat (first-run setup if needed)"
echo "  carina setup    configure API keys"
echo "  carina onboard  guided setup and health check"
echo "  carina doctor   check install health"
echo ""
echo "Full docs: https://docs.carinaai.uk"
echo "Docker stack: https://docs.carinaai.uk/docs/user/self-hosting"
echo "Managed Aiva (no install): https://aiva.carinaai.uk"
