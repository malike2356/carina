#!/usr/bin/env bash
# trust-e2e-demo.sh - Verify Carina -> Scout -> public trust dashboard pipeline
# Usage: bash scripts/trust-e2e-demo.sh [SCOUT_URL]
# Example: bash scripts/trust-e2e-demo.sh https://console.labyrinthscout.com

set -euo pipefail

SCOUT_URL="${1:-https://console.labyrinthscout.com}"
TRUST_API="${SCOUT_URL}/api/public/trust"

log() { echo "[trust-e2e] $*"; }

log "Fetching baseline trust metrics..."
BASELINE=$(curl -sf "$TRUST_API")
echo "$BASELINE" | python3 -m json.tool 2>/dev/null | head -30 || echo "$BASELINE"

EVENTS_BEFORE=$(echo "$BASELINE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('metrics',{}).get('events_today',0))" 2>/dev/null || echo "?")
SCOUT_ACTIVE=$(echo "$BASELINE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('monitoring',{}).get('scout_active',False))" 2>/dev/null || echo "false")

log "events_today before: $EVENTS_BEFORE"
log "scout_active: $SCOUT_ACTIVE"

if [[ "$SCOUT_ACTIVE" != "True" && "$SCOUT_ACTIVE" != "true" ]]; then
  log "WARNING: No active Scout agents. Pair Carina and send a heartbeat first."
fi

log ""
log "To complete the live demo manually:"
log "  1. Run Carina with LABYRINTH_ENABLED=true"
log "  2. Trigger any tool call (triggers Scout event)"
log "  3. Re-run: curl -s $TRUST_API | jq '.metrics.events_today'"
log "  4. Open https://carinaai.uk/trust and confirm score/attestations update"
log ""
log "Register ERC-8004 identity (requires TRUST_ATTESTER_PRIVATE_KEY on Scout):"
log "  cd internal/servers/console.labyrinthscout.com && pnpm trust:register"
