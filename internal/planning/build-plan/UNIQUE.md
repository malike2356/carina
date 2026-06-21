# UNIQUE.md; What Makes Carina Different

These are the features that make Carina genuinely better than any other agent. Not marketing; actual technical differentiation.

## 1. Domain knowledge at framework level

Current agents (including Hermes) store domain knowledge in prompts and skills. This means:
- Every session reloads the same knowledge from text files
- The agent "knows" property law only as well as it remembers the prompt
- No live data; everything is static text

Carina does it differently:
- UK property law database queried directly by the agent (not through a prompt)
- HMO regulations looked up by postcode (different councils, different rules)
- Live Rightmove/Zoopla/OnTheMarket price feeds via API
- Mortgage rate feeds from comparison sites
- Land Registry sold prices indexed locally

This means Carina KNOWS property data. It doesn't remember it from a prompt.

## 2. Offline-first with local models

Current agents burn API credits on every turn. A typical Hermes session costs $0.50-$2.00 in API calls. Over a month of heavy use, that's $50-200.

Carina routes intelligently:
- Simple queries ("What's my portfolio summary?") → bundled local Mistral/Llama model (free, instant)
- Complex reasoning ("Analyze this deal pack and compare scenarios") → cloud model ($0.02-0.10)
- Property-specific ("Is this HMO compliant in Portsmouth?") → fine-tuned local model (free, instant)

Result: 70-80% cost reduction vs cloud-only agents.

Technical requirements:
- Ollama or llama.cpp integration
- Task classifier (simple vs complex vs domain-specific)
- Bundled fine-tuned model for property
- Graceful fallback when offline

## 3. Tool result caching with TTL

Current agents re-execute identical operations across sessions:
- Same web search → hits the API again
- Same property lookup → queries the DB again
- Same compliance check → calls the model again

Carina caches with intelligent TTL:
- Web searches → 1 hour
- Property data → 24 hours
- Compliance status → until expiry date changes
- Market data → configurable per source

Result: 40% latency reduction for repeat queries. Lower API costs. Faster responses.

## 4. Event-driven alerting from DB state

Current agents are poll-based:
- Cron job runs every X minutes
- Checks "is anything wrong?"
- Reports findings

Carina is event-driven:
- "Tenant X is 3 days late on rent" → notification fires immediately
- "HMO licence expires in 30 days" → alert scheduled for that date
- "New Rightmove listing matching criteria" → push notification
- "Email from property manager marked urgent" → Telegram alert

The difference: poll-based means you find out at the next check. Event-driven means you find out when it happens.

Implementation:
- Database triggers or change-data-capture
- Event bus (simple: Redis pub/sub or file-based)
- Alert routing: push notification, Telegram, email, SMS based on severity

## 5. Model routing with cost awareness

No agent currently routes between local and cloud models automatically based on task type AND cost.

Carina's router:
1. Classifies the incoming task
2. Checks if a local model can handle it (accuracy threshold)
3. If yes: routes to local (free, fast)
4. If no: routes to cheapest cloud model that can handle it
5. Tracks cost per task per model
6. Reports: "You saved $47 this month by routing 73% of queries locally"

This is not just "pick a model." This is cost optimization as a feature.

## Why these matter together

Separately, each feature is an improvement. Together, they create a fundamentally different agent:

- Domain knowledge means Carina IS the expert, not just a chatbot that read about property
- Offline-first means Carina works without internet and costs almost nothing to run
- Caching means Carina gets faster the more you use it
- Event-driven means Carina finds problems before you do
- Model routing means you pay for intelligence, not for every question

No other agent combines these. Not Hermes. Not OpenClaw. Not ChatGPT. Not any enterprise platform.
