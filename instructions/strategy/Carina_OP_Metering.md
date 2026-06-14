This is a much better shape. It finally sells Carina Ops as an addon to Carina AI, not as a separate abstract admin product.

  A few fixes I would make before you use it:

  1. Change Free agent for personal use to Free agent for personal use and small projects
     It reads a bit more complete and less toy-like.

  2. Tighten Ops Starter
     BYOK vault and workbench is fine, but 14-day audit retention sounds light if you are trying to sell trust and control. If you keep the price at £19/mo, that is okay, but the wording should make it feel deliberately limited, not
     underpowered.

  3. Make Ops Team clearly the real team plan
     Deployments and CSV exports is good, but you may want role-based access or member admin in there if that is actually included. That is what makes the upgrade feel like a team product.

  4. Keep Scout separate, exactly as you have done
     That line is correct. It prevents product blur.

  A cleaner version would be:

  Carina AI and Carina Ops
  Free agent for personal use. Paid ops plans for teams that need BYOK, audit, and spend controls.

  Free
  Free
  Personal Carina AI agent
  Chat on app.carinaai.uk
  Limited history
  Self-host option (MIT)
  Start free

  Ops Starter
  £19/mo
  Up to 3 members
  BYOK vault and workbench
  14-day audit retention
  500K tokens / month
  Start trial

  Ops Team
  £49/mo
  Up to 50 members
  Deployments, exports, and member admin
  90-day audit retention
  2M tokens / month
  Start trial

  Need agent governance and protection? See Labyrinth Scout at labyrinthscout.com

  My blunt view: this is sellable. It gives you a clear free-to-paid path and it separates Ops from Scout properly. The only real risk is underpricing Ops Team if deployments, audit, and vaults are genuinely central features.


› am i paying for the tokens usage when people are using ops? an why?


• Short answer: yes, unless you design Ops as pure BYOK.

  If Carina Ops is running prompts through your managed Carina stack, then you are paying the model/provider bill for those calls. The customer is paying you a subscription, and your job is to make that subscription cover:

  - model usage
  - infrastructure
  - storage
  - audit logs
  - support
  - margin

  That is why your tiers include token caps. They are there to stop a flat monthly plan from becoming open-ended cost leakage.

  If you want the customer to pay their own token usage directly, then the product needs to be:

  - BYOK-first
  - keys stored in their vault
  - requests routed through their provider account
  - your fee covering the ops layer, not inference

  That is a valid model too, and it is usually better for margin. But it is less frictionless, because customers have to bring and manage keys.

  My recommendation:

  1. Free Carina AI: you absorb nothing, or almost nothing, because it is personal/free.
  2. Carina Ops Starter/Team: include a reasonable usage allowance in the subscription.
  3. Offer BYOK as the default for teams when possible, so heavy usage does not eat your margin.
  4. Reserve bundled tokens for convenience, not unlimited consumption.

  So the reason is simple: if you run the models on their behalf, you carry the variable cost. If they run it on their own keys, they do.


› how do i make profit on the tokens if i am buying and selling to them, what is the best metering approach?


• Searching the web

• Searched the web for site:openai.com pricing tokens official

• Searching the web

• Searched the web for https://openai.com/api/pricing/

• Searching the web

• Searched the web for 'per million tokens' in https://www.anthropic.com/pricing

──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

• Yes. The safest way to make profit is not to think in terms of “sell raw tokens”; think in terms of sell a subscription with a metered allowance.

  Why: provider costs vary a lot by model and direction. OpenAI’s API pricing ranges from low-cost mini models to much higher output pricing on frontier models, and Anthropic’s pricing also varies sharply between Sonnet and Opus tiers.
  That means a single flat token resale rate will either crush margin on expensive calls or overprice cheap ones. OpenAI also explicitly offers usage dashboards and spend controls, and Stripe supports usage-based billing, overage, and
  credit burndown models. Sources: OpenAI API pricing (https://openai.com/api/pricing/), Claude pricing (https://www.anthropic.com/pricing), Stripe usage-based pricing
  (https://docs.stripe.com/products-prices/pricing-models#usage-based-pricing).

  My recommendation:

  1. Use a monthly base fee
     This pays for support, platform, storage, auth, logs, and your fixed overhead.

  2. Include monthly credits
     Sell 500K, 2M, etc. credits, not raw tokens. That gives you a clean commercial unit.

  3. Normalize usage internally
     Track:
      - input tokens
      - output tokens
      - cached input tokens
      - tool calls if they have real cost
      - model name / tier

  4. Apply model multipliers
     One credit should not equal one token. Convert each model into a weighted internal cost unit, then price credits above your blended cost.

  5. Charge overages or auto top-ups
     This is where margin improves. If usage exceeds the included allowance, bill extra credits at a higher rate than the included bundle.

  6. Offer BYOK for heavy users
     This is the best margin protection. Your paid ops fee covers the control plane; the customer pays provider costs directly.

  Best metering shape for Carina Ops:

  - Starter: fixed fee + included credits + overage
  - Team: higher fixed fee + larger included credits + overage
  - Enterprise: BYOK or negotiated committed spend

  What I would avoid:

  - a single flat unlimited plan for model usage
  - selling “tokens” the same way across every model
  - bundling expensive models into a low-price plan without hard caps

  If you want a practical rule, price the included credits so your blended gross margin stays healthy after provider cost, support, and infra. Then use overages to keep heavy users from eating the plan.

  The cleanest commercial answer is:

  - Carina AI: free
  - Carina Ops: subscription plus included credits, with overages
  - Heavy team use: BYOK or committed spend

  That gives you profit, control, and a reason to keep the free product free.

what about model switching? some models are more expensive, others are not. are we using the openrouter business model?


• Searching the web

• Searched the web for OpenRouter pricing site:openrouter.ai business model official

──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

• Yes, but only at the billing abstraction level, not necessarily the whole business model.

  OpenRouter-style model switching means:

  - one customer wallet or credit balance
  - many models behind it
  - routing based on price, quality, or policy
  - you take a fee on the spread or on usage
  - customer does not care which provider is upstream, only that the request succeeds

  That is a valid model, and it is close to what OpenRouter does publicly: customers buy credits, usage is billed by model, and the platform keeps a fee. But I would not copy it exactly unless you are ready to be a model marketplace. That
  becomes a routing business, not just a Carina Ops addon.

  For Carina Ops, I would do this instead:

  1. Expose model switching in the product
     Let users choose cheap, balanced, premium, or a specific model.

  2. Normalize internal cost units
     Each model gets a cost weight based on your upstream cost and your margin target.

  3. Bill customers in your own credits
     One credit is your commercial unit, not a literal token.

  4. Route to the cheapest acceptable model by default
     Use premium models only when needed or when the customer explicitly selects them.

  5. Make the plan include a model budget
     Example: 2M standard credits, with higher weights for expensive models.

  6. Add markup by model class
     You can make more margin on expensive models by charging a higher internal multiplier.

  This gives you the commercial upside of model switching without turning you into a general-purpose OpenRouter clone.

  The key distinction:

  - OpenRouter model: marketplace for many models, usage-priced routing business
  - Carina Ops model: operations platform with metered AI usage and optional routing

  My recommendation:

  - support model switching
  - bill through weighted credits
  - keep the UI simple
  - do not expose raw provider economics to most customers
  - reserve explicit provider choice for power users and BYOK plans

  That gives you flexibility, margin control, and a clear product story.

do this for me. scope out the implementation plan, the model pricing and meterng and the technical speccing to do this. it must be econiomically viable so my business will not loose.


• I’m checking the current model routing and billing code first, because the pricing and metering plan has to fit the system you already have rather than invent a parallel one.

• Explored
  └ Search model routing|model selector|provider|cost|meter|usage|credits|token in core.carinaai.uk
    Search model|tokens_in|tokens_out|cost_estimate|usage in ops.carinaai.uk

• Context compacted

──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

• I’m checking the current provider pricing so the plan is grounded in actual costs, not stale assumptions.

• Searching the web

• Searched the web for site:openai.com/api/pricing OpenAI API pricing

• Searching the web

• Searched the web for https://openai.com/api/pricing/

• Searching the web

• Searched the web for 'Opus' in https://www.anthropic.com/pricing

• Searching the web

• Searched the web for 'usage-based pricing' in https://docs.stripe.com/products-prices/pricing-models

──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

• Yes. Here is the plan I would use if the goal is to sell Carina Ops without creating a cost leak.

  Bottom line

  Do not sell raw tokens as a flat unlimited feature. Sell a subscription plus weighted credits, with model classes and hard caps. If a customer wants expensive models, they either pay more or use BYOK. That is the only way to keep
  margins predictable.

  Current provider pricing shows why. OpenAI’s API spans from GPT-5.4 mini at $0.75 input and $4.50 output per 1M tokens up to GPT-5.5 at $5 input and $30 output per 1M tokens. Anthropic’s Sonnet 4.6 is $3 input and $15 output per MTok,
  while Opus 4.7 is $5 input and $25 output per MTok. Usage-based billing with fixed fee, overage, and credit burndown is a standard pattern in Stripe. Sources: OpenAI pricing (https://openai.com/api/pricing/), Claude pricing
  (https://claude.com/pricing), Stripe usage-based pricing (https://docs.stripe.com/products-prices/pricing-models#usage-based-pricing).

  Commercial model

  1. Carina AI
      - Free
      - Personal use
      - No meaningful managed inference cost exposure unless you deliberately give a trial quota

  2. Carina Ops Starter
      - Low monthly fee
      - Small member count
      - Included managed credits
      - BYOK vault and workbench
      - Limited audit retention
      - No premium model access by default

  3. Carina Ops Team
      - Higher monthly fee
      - More members
      - Included credits plus overage packs
      - Deployments, exports, audit, spend controls
      - Balanced models allowed
      - Premium models only by plan rule or top-up

  4. Enterprise
      - BYOK first
      - SSO, SCIM, retention, limits, custom routing
      - Mostly control plane revenue, not inference revenue

  My direct recommendation: do not offer 50 members for £49/mo with broad managed model access. That is too much surface area for too little revenue unless usage is tightly capped or BYOK-only.

  Pricing structure

  Use this shape:

  - Base fee pays for platform, auth, storage, logs, support, and margin.
  - Credits pay for model usage.
  - Overage packs are priced above the included-rate average.
  - Premium models consume credits faster.
  - BYOK customers can have lower platform fees because they carry model cost themselves.

  A safe starting shape:

  - Ops Starter at £19/mo
      - up to 3 members
      - 1 included credit bundle
      - BYOK vault and workbench
      - 14-day audit retention
      - balanced models only, premium blocked unless topped up

  - Ops Team at £49/mo
      - up to 10 members, not 50 unless BYOK-only
      - bigger credit bundle
      - deployments, exports, audit retention
      - balanced default
      - premium allowed only with explicit higher burn rate

  - Top-up packs
      - small pack for burst usage
      - larger pack for heavier teams
      - sold at a better margin than the included bundle

  If you want a more aggressive growth play, keep the base fees low and force BYOK earlier. That protects margin better than trying to subsidize inference.

  Metering model

  Do not meter by raw tokens alone. Meter by weighted, billable usage.

  Track these per request:

  - input tokens
  - output tokens
  - cached input tokens
  - provider
  - model
  - tool calls
  - batch flag
  - request latency
  - actual provider spend
  - billable credits
  - org balance before and after

  Then apply a rate card:

  - mini class: low multiplier
  - balanced class: medium multiplier
  - premium class: high multiplier
  - frontier class: highest multiplier or disallowed on lower tiers

  A clean internal formula is:

  billable_credits =
    input_tokens * input_weight(model)
    + output_tokens * output_weight(model)
    + cached_input_tokens * cache_weight(model)
    + tool_calls * tool_weight

  Then convert that to plan credits using a fixed exchange rate.

  My recommendation:

  - define one standard credit as a reference-unit, not a token
  - make the reference class roughly equivalent to a cheap or balanced model
  - make expensive models burn 3x to 7x more credits than the reference class
  - keep the weights in a DB rate card, not hardcoded

  That gives you margin control when model prices move.

  Routing policy

  Use this order:

  1. Default to the cheapest acceptable model for the task.
  2. Escalate to balanced only when the task needs it.
  3. Allow premium only if the plan permits it and the account has credits.
  4. If the estimate is above the allowed burn threshold, downgrade or ask for top-up.
  5. If the customer is BYOK, let them choose more freely because you are not carrying inference cost.

  Practical routing classes:

  - cheap
  - balanced
  - premium
  - frontier

  Do not expose every model as a first-class commercial promise. Expose classes, then let advanced users override specific models within their allowance.

  Margin guardrails

  Hard rules I would enforce:

  - target gross margin on managed inference: at least 65 percent, ideally higher
  - no unlimited managed usage
  - per-org monthly hard cap
  - soft cap at 75 percent of allowance
  - warning at 50, 80, 95 percent
  - auto-downgrade to cheaper model when margin forecast falls below threshold
  - premium models require either:
      - a higher tier
      - a top-up
      - or BYOK

  If a plan cannot maintain margin with a given model class, the system must refuse or downgrade. That is the part that keeps the business from losing money.

  Technical spec

  I would implement this in core.carinaai.uk as a billing and routing layer, not as a separate marketplace.

  Core tables:

  - ops_plans
  - ops_org_subscriptions
  - ops_model_rate_cards
  - ops_usage_events
  - ops_credit_ledger
  - ops_routing_policies
  - ops_plan_entitlements
  - ops_usage_aggregates

  Key fields:

  - plan price
  - included credits
  - credit unit value
  - member limit
  - allowed model classes
  - cached-input rate
  - batch discount rate
  - overage pack rate
  - effective_from / effective_to on rate cards

  API flow:

  1. POST /api/ops/estimate
      - estimates tokens and cost before the call
      - returns expected credits, provider cost, and margin impact

  2. POST /api/ops/execute
      - reserves credits
      - executes the model call
      - writes actual usage
      - finalizes ledger entry

  3. GET /api/ops/usage
      - shows spend, burn, margins, and model mix

  4. GET /api/ops/models
      - shows allowed model classes and effective burn rate

  5. POST /api/ops/topup
      - sells more credits

  Technical rules:

  - rate cards must be versioned
  - pricing changes must not rewrite historical usage
  - every call should store provider cost and billable credits
  - store both estimated and actual usage
  - keep a reconciliation job that checks ledger totals against provider invoices

  Implementation plan

  Phase 1:

  - add rate-card tables and ledger tables
  - add estimate and finalize steps
  - add credit balance checks
  - add usage dashboard

  Phase 2:

  - add model classes and routing policy
  - add tier limits and top-up packs
  - add plan-based model restrictions
  - add alerts and throttles

  Phase 3:

  - add BYOK default for heavier teams
  - add premium model gating
  - add margin reporting per org and per model
  - add admin controls for rate card updates

  Phase 4:

  - add checkout and recurring billing
  - add overage packs
  - add customer-facing pricing page and plan comparison

  What I would actually sell

  Keep it simple:

  - Free
  - Ops Starter
  - Ops Team
  - Enterprise

  And for usage:

  - credits, not raw tokens
  - weighted by model class
  - BYOK for bigger customers
  - premium access as an upsell, not a default

  Non-negotiables

  - no unlimited managed inference
  - no flat price with unrestricted premium models
  - no 50-member plan without strong usage caps
  - no pricing without a rate card
  - no model switching without per-model cost accounting


