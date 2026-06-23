# Operator trust and security log

Keep this file outside git (copy to your password manager or private ops wiki). Do not commit real keys or wallet material.

## Wallet funding

| Date (UTC) | Operator | Wallet address | Source (faucet/exchange) | Tx hash | Notes |
|------------|----------|----------------|--------------------------|---------|-------|
| YYYY-MM-DD | name     | 0x...          | Coinbase Base Sepolia    | 0x...   |       |

## ERC-8004 registration

| Date (UTC) | Operator | Agent ID | Register tx | Explorer URL | Notes |
|------------|----------|----------|-------------|--------------|-------|
| YYYY-MM-DD | name     | #123     | 0x...       | https://...  |       |

## Attestations

| Date (UTC) | Operator | Tx hash | Score | Notes |
|------------|----------|---------|-------|-------|
| YYYY-MM-DD | name     | 0x...   | 12    | weekly job |

## ERC-8126 verification

| Date (UTC) | Operator | Request tx | Response tx | Unified risk score | Notes |
|------------|----------|------------|-------------|-------------------|-------|
| YYYY-MM-DD | name     | 0x...      | 0x...       | 20                |       |

## Secret rotation

| Date (UTC) | Operator | Rotated keys | Backup path | Carina restarted | Scout restarted |
|------------|----------|--------------|-------------|------------------|-----------------|
| YYYY-MM-DD | name     | SCOUT_API_KEY, SCOUT_SESSION_SECRET | .env.bak-... | yes | yes |

## Incident review

| Date (UTC) | Event type | Severity | Reviewed by | Within SLA | Action taken |
|------------|------------|----------|-------------|------------|--------------|
| YYYY-MM-DD | honeypot_triggered | breach | name | yes | suspended instance |
