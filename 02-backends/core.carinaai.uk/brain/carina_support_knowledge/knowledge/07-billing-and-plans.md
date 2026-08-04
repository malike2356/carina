# Billing and Plans

## Carina AI Plans

### Free - GBP 0

The Free plan is for getting started and light personal use.

What is included:
- 50,000 tokens per day (resets at midnight UTC).
- All core features: chat, memory, skills, documents, calendar, tasks, research, files, email, cron jobs, webhooks.
- Bring your own API key (BYOK) required.
- 1 user.
- No Scout pairing.

Best for: individuals who want to try Carina before committing to a paid plan.

Limitation: the daily token limit is relatively low. If you are doing heavy research, long documents, or extended agent sessions, you will likely hit it within a few hours of moderate use.

---

### Starter - GBP 19 per month

The Starter plan is for regular personal or professional use.

What is included:
- 500,000 tokens per month (does not reset daily; it accumulates across the whole month).
- All features included in Free.
- Bring your own API key (BYOK) required.
- No Scout pairing.

Best for: individuals who use Carina daily for work and hit the free daily limit.

---

### Team - GBP 79 per month

The Team plan is for power users, professionals who rely heavily on Carina, and anyone who wants Scout pairing.

What is included:
- Unlimited tokens (no daily or monthly cap).
- All features, including Scout pairing on the Security page.
- Bring your own API key (BYOK) required.
- Optional Labyrinth Scout integration for AI security monitoring.

Best for: heavy users, businesses, developers running agents, and anyone who needs Scout.

---

## Understanding tokens

A token is roughly one word (more precisely, about four characters of text). Tokens are counted for both the input (your message plus any context Carina has loaded) and the output (Carina's response).

Rough guide:
- A short question and answer: 200-500 tokens.
- A medium conversation with context: 1,000-5,000 tokens.
- A long research task or document review: 10,000-50,000 tokens.

The Free plan's daily limit of 50,000 tokens supports several hours of normal use before resetting. The Starter plan's 500,000 monthly tokens is generous for daily individual use.

---

## Viewing your usage

Go to the Billing page from the sidebar. You will see a usage meter showing how many tokens you have used in the current period and how many you have left.

---

## Upgrading your plan

1. Open "Billing and plan" from the sidebar.
2. Click "Upgrade" on the plan you want.
3. You will be redirected to the payment page (Stripe).
4. Complete the payment.

Your new plan is activated immediately after payment. Your usage counter resets to the new plan's limits.

---

## Changing or cancelling your plan

To downgrade or cancel, go to the Billing page. For billing disputes, refund requests, or anything you cannot manage from the Billing page directly, email support@carinaai.uk.

---

## What is BYOK?

BYOK (bring your own key) means you use your own API key from an AI provider like Anthropic or OpenAI. Carina does not include AI credits in the plan price; the tokens are counted against your own API account, not a Carina-managed pool.

This has two advantages:
1. You pay the AI provider directly at their standard rates, which may be lower than bundled pricing.
2. You choose exactly which models and providers to use.

The Carina plan price (GBP 0, 19, or 79) covers access to the Carina workspace platform itself.

---

## Labyrinth Scout Plans

Scout is a separate product. It is priced and billed independently.

### Scout Monitor - GBP 49 per month

What is included:
- Live security dashboard showing your AI agent fleet.
- Prompt injection detection (catches attempts to make your AI behave in harmful or unintended ways).
- 14-day audit log.
- Browser alerts when the dashboard is open.

Best for: teams that want visibility into what their AI agents are doing, without full control features.

---

### Scout Govern - GBP 79 per month

What is included:
- Everything in Scout Monitor.
- Kill switch: stop any AI agent instantly with one click.
- Tool quarantine: block specific capabilities without shutting down the whole agent.
- Alerts via Telegram, email, and Slack (so you get notified even when the dashboard is not open).
- Exports for incident reporting.
- Honeypots (decoy lures to catch prompt injection and jailbreak attempts).
- Trust API for building your own security integrations.

Best for: production AI workflows where you need real-time control and incident-grade evidence.

---

### Enterprise - Custom pricing

What is included:
- Everything in Scout Govern.
- Contractual SLA (guaranteed response times for incidents).
- On-premise or VPC deployment (Scout runs in your own infrastructure, not our cloud).
- SOC 2 readiness export (evidence report for compliance or auditors; note: this is an operator-produced report, not a third-party audit).

To enquire about Enterprise: email contact@verlox.uk.

---

## Connecting Scout to Carina

To pair Scout with your Carina workspace:

1. You must be on the Carina Team plan.
2. You must have an active Scout account (Monitor or Govern).
3. In Carina, open "Security" from the sidebar.
4. Scroll down to "Scout pairing".
5. Enter your Scout console URL and the API key from your Scout account.
6. Click "Pair Scout".

Once paired, Carina's activity is reported to Scout automatically.
