# Trust wallet rotation

Use this when you rotate `TRUST_ATTESTER_PRIVATE_KEY`, change chain RPC settings, or redeploy Scout after an env change.

## Before you start

- Fund the new wallet on Base Sepolia before registration.
- Keep the old wallet available until on-chain identity migration is complete or you accept a new agent identity.
- Run `pnpm doctor` in `console.labyrinthscout.com` and confirm database and Redis are healthy.

## Rotation steps

1. **Generate or import a new attester wallet**
   - Store the private key only in the Scout VPS `.env` as `TRUST_ATTESTER_PRIVATE_KEY`.
   - Never commit the key to git or paste it into chat logs.

2. **Update Scout environment**
   ```bash
   # On the Scout VPS
   nano .env
   # Set TRUST_ATTESTER_PRIVATE_KEY=0x...
   # Confirm TRUST_CHAIN_ID, TRUST_CHAIN_RPC, TRUST_ERC8004_REGISTRY
   ```

3. **Restart Scout**
   ```bash
   docker compose restart scout
   # or your process manager equivalent
   ```

4. **Re-register ERC-8004 identity**
   ```bash
   cd console.labyrinthscout.com
   pnpm trust:register
   ```
   Confirm a new `agent_id` appears in the public trust API (`/api/public/trust`).

5. **Re-submit ERC-8126 verification**
   ```bash
   pnpm trust:verify
   ```
   Confirm `verification.on_chain.response_tx_hash` is populated.

6. **Verify public labels**
   - Open `https://labyrinthscout.com/trust/` or `GET /api/public/trust`.
   - `chain.wallet_configured` must be `true`.
   - ERC-8004 and ERC-8126 should show `live` only after on-chain rows exist.

7. **Record the rotation**
   - Date, operator, old wallet last tx, new wallet address, register tx, verify tx.
   - Keep this in your operator logbook (not in the repo).

## Rollback

If registration fails:

1. Restore the previous `TRUST_ATTESTER_PRIVATE_KEY` in `.env`.
2. Restart Scout.
3. Re-run `pnpm trust:register` and `pnpm trust:verify` with the restored wallet.

## Carina side

Carina does not hold the attester key. After Scout trust rotation, no Carina env change is required unless `LABYRINTH_API_KEY` or `LABYRINTH_URL` also changed.

Run `carina doctor` and `carina security audit` on Carina hosts after Scout rotation to confirm the deployment still talks to Scout correctly.
