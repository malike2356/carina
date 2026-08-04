# Sales claims

## Approved claim

Trusted channel kill switch control is available only when:

- the operator link is present in the engine
- the Telegram e2e flow passes in staging or production-shaped tests
- WhatsApp is explicitly enabled

## Disallowed claim

Do not claim WhatsApp emergency control as live if `SCOUT_WHATSAPP_ENABLED` is false or if the e2e script has not passed.

## Safe wording

- "Operators can manage Scout emergency controls from linked daily channels"
- "Telegram kill and resume are audited and confirmed"
- "WhatsApp support is gated behind an explicit feature flag"
- "The channel kill flow is validated by `scripts/e2e-channel-kill.sh` before rollout"
