#!/usr/bin/env bash
# setup-trust.sh - Configure Labyrinth Scout on-chain trust (ERC-8004 + ERC-8126)
# Usage: bash scripts/setup-trust.sh [local|vps]
#
# Never commit TRUST_ATTESTER_PRIVATE_KEY.

set -euo pipefail

TARGET="${1:-vps}"
VPS_HOST="${VPS_HOST:-80.190.81.208}"
VPS_USER="${VPS_USER:-malike}"
SCOUT_REMOTE="/home/malike/apps/console.labyrinthscout.com"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCOUT_LOCAL="$(dirname "$SCRIPT_DIR")/console.labyrinthscout.com"
REMOTE_SCRIPT="/tmp/labyrinth-scout-setup-trust.sh"

log()  { echo "[setup-trust] $*"; }
die()  { echo "ERROR: $*" >&2; exit 1; }

cat > /tmp/labyrinth-scout-setup-trust-inner.sh <<'INNER'
#!/usr/bin/env bash
set -euo pipefail
cd "${SCOUT_DIR:?}"

log() { echo "[setup-trust] $*"; }

if ! grep -q '^TRUST_ATTESTER_PRIVATE_KEY=' .env 2>/dev/null; then
  log "Generating attestation wallet..."
  WALLET_JSON=$(node --input-type=module -e "
    import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
    const pk = generatePrivateKey();
    const acc = privateKeyToAccount(pk);
    console.log(JSON.stringify({ address: acc.address, privateKey: pk }));
  ")
  ADDRESS=$(echo "$WALLET_JSON" | node -e "process.stdout.write(JSON.parse(require('fs').readFileSync(0,'utf8')).address)")
  PRIVATE_KEY=$(echo "$WALLET_JSON" | node -e "process.stdout.write(JSON.parse(require('fs').readFileSync(0,'utf8')).privateKey)")
  if ! grep -q '^TRUST_PUBLIC_ENABLED=' .env 2>/dev/null; then
    cat >> .env <<'EOF'

# --- Public trust / on-chain attestation ---
TRUST_PUBLIC_ENABLED=true
TRUST_PLATFORM=agent-trust-on-base
TRUST_CHAIN_ID=84532
TRUST_CHAIN_RPC=https://sepolia.base.org
TRUST_ERC8004_STATUS=registering
TRUST_ERC8126_STATUS=enterprise
TRUST_ATTESTATION_ENABLED=true
TRUST_ATTESTATION_INTERVAL_DAYS=7
TRUST_VERIFICATION_ENABLED=true
TRUST_VERIFICATION_INTERVAL_DAYS=7
TRUST_WAV_ENDPOINTS=https://core.carinaai.uk,https://console.labyrinthscout.com/api/public/trust
TRUST_ERC8126_VALIDATION_REGISTRY=0x8004B663056A597Dffe9eCcC1965A193B7388713
EOF
  fi
  echo "TRUST_ATTESTER_PRIVATE_KEY=$PRIVATE_KEY" >> .env
  log "New attestation wallet: $ADDRESS"
  log "Fund with Base Sepolia ETH: https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet"
else
  log "TRUST_ATTESTER_PRIVATE_KEY already in .env"
fi

ADDRESS=$(node --input-type=module -e "
  import 'dotenv/config';
  import { privateKeyToAccount } from 'viem/accounts';
  const raw = process.env.TRUST_ATTESTER_PRIVATE_KEY ?? '';
  if (!raw) { console.error('missing key'); process.exit(1); }
  const pk = raw.startsWith('0x') ? raw : '0x' + raw;
  console.log(privateKeyToAccount(pk).address);
")
log "Attestation wallet: $ADDRESS"

BALANCE_WEI=$(node --input-type=module -e "
  import 'dotenv/config';
  import { createPublicClient, http } from 'viem';
  import { privateKeyToAccount } from 'viem/accounts';
  import { baseSepolia } from 'viem/chains';
  const raw = process.env.TRUST_ATTESTER_PRIVATE_KEY ?? '';
  const pk = raw.startsWith('0x') ? raw : '0x' + raw;
  const account = privateKeyToAccount(pk);
  const client = createPublicClient({
    chain: baseSepolia,
    transport: http(process.env.TRUST_CHAIN_RPC || 'https://sepolia.base.org'),
  });
  const bal = await client.getBalance({ address: account.address });
  console.log(bal.toString());
")

if [[ "$BALANCE_WEI" == "0" ]]; then
  log "Wallet has 0 ETH on Base Sepolia."
  log "Send testnet ETH to: $ADDRESS"
  log "Faucet: https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet"
  log "Then re-run: bash scripts/setup-trust.sh ${TARGET:-vps}"
  exit 2
fi

log "Balance OK. Registering ERC-8004 identity..."
npm run trust:register

log "Submitting security attestation..."
npm run trust:attest || log "Attestation skipped (see output)"

log "Submitting ERC-8126 verification..."
npm run trust:verify || log "Verification skipped (see output)"

npm run doctor || true
curl -sS "http://127.0.0.1:${SCOUT_PORT:-4444}/api/public/trust" | head -c 1500 || true
echo ""
INNER

chmod +x /tmp/labyrinth-scout-setup-trust-inner.sh

run_local() {
  [[ -f "$SCOUT_LOCAL/.env" ]] || cp "$SCOUT_LOCAL/.env.example" "$SCOUT_LOCAL/.env"
  SCOUT_DIR="$SCOUT_LOCAL" TARGET=local bash /tmp/labyrinth-scout-setup-trust-inner.sh
}

run_vps() {
  scp -q /tmp/labyrinth-scout-setup-trust-inner.sh "${VPS_USER}@${VPS_HOST}:${REMOTE_SCRIPT}"
  ssh "${VPS_USER}@${VPS_HOST}" "SCOUT_DIR='$SCOUT_REMOTE' TARGET=vps bash $REMOTE_SCRIPT"
  log "Restarting Scout..."
  ssh "${VPS_USER}@${VPS_HOST}" bash <<'REMOTE'
cd /home/malike/apps/console.labyrinthscout.com
pkill -f "/home/malike/apps/console.labyrinthscout.com/dist/server.js" 2>/dev/null || true
sleep 2
nohup /usr/bin/node dist/server.js >> scout.out.log 2>> scout.err.log &
sleep 3
curl -sS -m 8 http://127.0.0.1:4444/api/public/trust | head -c 1500
echo ""
REMOTE
}

case "$TARGET" in
  local) run_local ;;
  vps)   run_vps ;;
  *)     die "Usage: bash scripts/setup-trust.sh [local|vps]" ;;
esac

log "Done."
