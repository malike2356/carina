# Trust platform

Labyrinth Scout adopts **Agent Trust on Base** for on-chain agent reputation. Scout remains the security attestation oracle; Agent Trust provides the shared trust infrastructure.

## Decision

| Choice | Verdict |
|---|---|
| Build custom trust platform | No — network effects and Sybil resistance already solved |
| Agent Trust (`@open-agent-economy/trust-sdk`) on Base | Yes — production SDK, low fees, ERC-8004 aligned |
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
pnpm trust:register
```

This calls ERC-8004 `register(agentURI)` on Base Sepolia and stores the result in `trust_identities`.

## Public API

`GET /api/public/trust` includes an `identity` block when a reference agent is registered. See [Public Trust API](/api/public-trust).
