# Trust platform

Labyrinth Scout adopts **Agent Trust on Base** for on-chain agent reputation. Scout remains the security attestation oracle; Agent Trust provides the shared trust infrastructure.

## Decision

| Choice | Verdict |
|---|---|
| Build custom trust platform | No; network effects and Sybil resistance already solved |
| Agent Trust (`@open-agent-economy/trust-sdk`) on Base | Yes; production SDK, low fees, ERC-8004 aligned |
| Labyrinth Scout role | Security telemetry source → on-chain attestations (`labyrinth-scout.v1`) |

## ERC-8004 registries (Base Sepolia)

| Registry | Address |
|---|---|
| Identity | `0x8004A818BFB912233c491871b3d84c89A494BD9e` |
| Reputation | `0x8004B663056A597Dffe9eCcC1965A193B7388713` |

Base mainnet uses `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` (identity).

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `TRUST_CHAIN_ID` | No (default `84532`) | Base Sepolia or `8453` mainnet |
| `TRUST_CHAIN_RPC` | No | RPC URL (default `https://sepolia.base.org`) |
| `TRUST_ATTESTER_PRIVATE_KEY` | For registration | Scout wallet that registers identity and posts attestations |
| `TRUST_ERC8004_REGISTRY` | No | Override identity registry address |
| `TRUST_ERC8004_STATUS` | No | Public dashboard label until DB shows `live` |
| `TRUST_ERC8126_STATUS` | No | ERC-8126 rollout status label |

Never commit `TRUST_ATTESTER_PRIVATE_KEY`. Store only in production `.env`.

## Register reference Carina agent

```bash
cd console.labyrinthscout.com
# Set TRUST_ATTESTER_PRIVATE_KEY in .env first
pnpm trust:register          # Base Sepolia (testnet)
pnpm trust:register:mainnet  # Base mainnet (after testnet validation)
```

This calls ERC-8004 `register(agentURI)` and stores the result in `trust_identities`.

`TRUST_ERC8004_STATUS` flips to `live` automatically on the public API when a registered identity exists in the database (no manual env flip required after registration).

## Submit weekly security attestation

After identity registration, Scout can post Agent Trust attestations on a weekly schedule:

```bash
cd console.labyrinthscout.com
# TRUST_ATTESTER_PRIVATE_KEY must be set
pnpm trust:attest
```

The adapter uses namespace `labyrinth-scout.v1` with fields:

- `securityScore` (0-100, inverse of Scout risk score)
- `runtimeHours` (hours without critical incident)
- `threatsDetected` (30d count)
- `injectionBlocks` (30d count)
- `sandboxViolations` (30d count)

Attestations are only submitted when there are active agents and zero critical/breach incidents in the last 30 days. Results are stored in `trust_attestations` and exposed on `GET /api/public/trust`.

| Variable | Default | Purpose |
|---|---|---|
| `TRUST_ATTESTATION_ENABLED` | `true` | Disable scheduler + manual submit |
| `TRUST_ATTESTATION_INTERVAL_DAYS` | `7` | Minimum days between on-chain posts |
| `TRUST_SUBJECT_AGENT_WALLET` | identity wallet | Agent Trust `toAgent` wallet |

## Submit ERC-8126 verification (WAV + WV)

Scout computes ERC-8126 verification scores and posts them to the ERC-8004 Validation Registry:

```bash
cd console.labyrinthscout.com
# TRUST_ATTESTER_PRIVATE_KEY + registered ERC-8004 agent required
pnpm doctor
pnpm trust:verify
```

| Verification | Source |
|---|---|
| WAV (Web Application) | HTTPS endpoint probes + Scout vulnerability signals (30d) |
| WV (Wallet) | On-chain tx history + Scout threat telemetry |

Unified risk score = mean of applicable WAV and WV scores (0-100, lower is better). See [ERC-8126 specification](https://erc8126.ai/specification).

| Variable | Default | Purpose |
|---|---|---|
| `TRUST_VERIFICATION_ENABLED` | `true` | Disable scheduler + manual submit |
| `TRUST_VERIFICATION_INTERVAL_DAYS` | `7` | Minimum days between on-chain verifications |
| `TRUST_WAV_ENDPOINTS` | Carina + Scout API | Comma-separated HTTPS URLs to probe |
| `TRUST_ERC8126_VALIDATION_REGISTRY` | Base Sepolia `0x8004B663…` | Override validation registry address |

## Enterprise trust APIs (operator key)

| Endpoint | Purpose |
|---|---|
| `GET /api/trust/history` | Attestation + ERC-8126 verification history |
| `GET /api/trust/incidents?type=type3` | Classified incident timeline |
| `GET /api/trust/compliance-report?format=pdf` | SOC2 / ISO27001 / EU AI Act readiness pack |
| `GET /api/public/trust/verify/:agentId` | Third-party trust gating (public, no key) |

Account holders configure enterprise attestation frequency at `PUT /account/api/trust-settings`.

## Public API

`GET /api/public/trust` includes an `identity` block when a reference agent is registered. See [Public Trust API](/api/public-trust).
