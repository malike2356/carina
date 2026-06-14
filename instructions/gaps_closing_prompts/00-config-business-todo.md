# Config and Business Gaps: Step-by-Step Todo List

These items cannot be closed by code alone. Work through them in order.

---

## 1. Stripe live price IDs

1. Log in to Stripe Dashboard (live mode, not test).
2. Create or verify the three Carina Ops products: Starter, Growth, Enterprise.
3. Copy each price ID (format `price_...`).
4. In `core.carinaai.uk/.env` (and on the VPS in `/srv/carina/core.carinaai.uk/.env`), set:
   - `CARINA_OPS_STARTER_PRICE_ID=price_...`
   - `CARINA_OPS_GROWTH_PRICE_ID=price_...`
   - `CARINA_OPS_ENTERPRISE_PRICE_ID=price_...`
5. Set `CARINA_OPS_PRODUCT_ENABLED=true` in both `.env` files.
6. Restart the VPS process (`bash deploy.sh` or restart the service).
7. Test: sign up for a plan via the billing UI at `core.carinaai.uk/ops/billing` and confirm Stripe receives a checkout session.

---

## 2. Scout alert channel credentials

Channel credentials for Labyrinth Scout alert routing. Set these in the Scout server's `.env` on the VPS:

- **Email alerts**: `SCOUT_ALERT_EMAIL_TO=...`, `RESEND_API_KEY=...` (already used by invite-email - reuse the same key)
- **Telegram alerts**: `SCOUT_TELEGRAM_BOT_TOKEN=...`, `SCOUT_TELEGRAM_CHAT_ID=...`
- **Slack alerts**: `SCOUT_SLACK_WEBHOOK_URL=...`
- **Discord alerts**: `SCOUT_DISCORD_WEBHOOK_URL=...`

Only configure the channels you actually want to receive alerts on; leave others blank and Scout will skip them.

---

## 3. Trust/blockchain registration

These steps require `pnpm` commands from `core.carinaai.uk/`:

1. Run the first weekly attestation (generates your initial trust hash):
   ```
   pnpm trust:attest
   ```
2. Once the attestation is confirmed, register on Base mainnet:
   ```
   pnpm trust:register:mainnet
   ```
3. Record the transaction hash and contract address in `.documentations/` for future reference.
4. Confirm the registration is visible on Basescan before marking done.

---

## 4. Docs site deployment

1. `cd docs.carinaai.uk`
2. `pnpm build` - confirm Docusaurus builds without errors.
3. `bash scripts/deploy-marketing.sh` - deploys to `docs.carinaai.uk`.
4. Verify at `https://docs.carinaai.uk` that pages load and links resolve.
5. Add the docs URL to the Carina marketing site nav (`carinaai.uk/index.html`).

---

## 5. Privacy policy and Terms of Service

1. Write or adapt a privacy policy covering: data collected, retention, GDPR rights, contact address.
2. Write or adapt ToS covering: acceptable use, liability limits, payment terms.
3. Publish at `carinaai.uk/privacy` and `carinaai.uk/terms` (static HTML pages are fine).
4. Add links to both in the footer of the Carina Ops signup flow (`src/gateway/web/ops/`).
5. Add links in the footer of the marketing site.

---

## 6. Beta program launch

1. Decide the beta cohort size (suggested: 10-20 workspaces).
2. Add a "Join Beta" form to `carinaai.uk` (email capture only - a simple HTML form posting to a Resend-backed PHP or Node handler is sufficient).
3. Send onboarding emails to early testers using the existing Resend integration.
4. Create a private Discord or Slack channel for beta feedback.
5. Set a close date for beta (suggested: 6-8 weeks from launch).

---

## 7. Enterprise pilot identification and outreach

1. List 5-10 target companies that match Carina's ICP (property management, legal, finance - sectors where autonomous agents deliver clear ROI).
2. Draft a one-page enterprise pitch doc (PDF) covering: what Carina does, deployment model, pricing, SLA.
3. Reach out via LinkedIn or email to the technical decision-maker at each company.
4. Track responses in a simple spreadsheet or Linear board.
5. Offer a 30-day free pilot with a dedicated Slack channel for support.

---

## 8. Marketing pricing page

1. Update `carinaai.uk` pricing section with the final plan names, limits, and prices from the Stripe setup (step 1 above).
2. Add a clear CTA button on each plan that links to the Carina Ops signup flow.
3. Deploy: `bash scripts/deploy-marketing.sh`.

---

## 9. Clean install smoke test

Run this on a machine that has never had Carina installed:

1. `npm install -g carina-agent` (or the published package name).
2. Run `carina` - confirm the first-run wizard starts.
3. Complete the wizard with a test API key.
4. Send one message and confirm a response arrives.
5. Run `carina --version` and confirm the version string is correct.
6. If any step fails, document it as a bug and fix before public launch.
