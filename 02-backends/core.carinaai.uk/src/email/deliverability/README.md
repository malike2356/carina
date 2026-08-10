# Shared email authentication and deliverability

Canonical policy and helpers for Carina, Keprix, and future products.

| File | Role |
| --- | --- |
| `policy.json` | Thresholds, warm-up, domain role names, DMARC ladder |
| `dns-configurator.ts` | SPF/DKIM/DMARC generate + validate |
| `domain-separation.ts` | Transactional vs marketing domains + warm-up |
| `delivery-monitor.ts` | Event store, rates, bounce classes, health alerts |
| `CLAUDE.md` | Agent hard rules |

## Vendor rule

Products must not import each other. Carina vendors TypeScript under `core.carinaai.uk/src/email/deliverability/`. Keprix implements Python parity under `keprix/email/deliverability_auth.py` using the same `policy.json` values.

## Tests

```bash
cd /opt/lampp/htdocs/verlox/carina/02-backends/core.carinaai.uk
pnpm exec vitest run src/email/deliverability/
```

Shared source tests can also be run after vendoring (preferred) so CI stays inside product git roots.
