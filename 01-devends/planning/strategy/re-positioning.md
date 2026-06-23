 Customer-facing:
    - carinaai.uk; Carina marketing
    - labyrinthscout.com; Scout marketing  
    - app.carinaai.uk; The product (one web UI, npm install target)
    - console.labyrinthscout.com; Scout paid console
    
    Yours:
    - core.carinaai.uk; private operator
    - ops.carinaai.uk; tenancy/SaaS admin


The disconnect is a positioning problem, not a code problem. The sites don't tell the story you described.
    
    Three ways to fix it:
    
    A) Single funnel site
    carinaai.uk tells the full story top to bottom: "Start free with Carina → grow into Scout." Scout section is a major section, not buried. Pricing page shows the upgrade path. labyrinthscout.com becomes a redirect or a lightweight Scout-specific landing page that clearly pois ints back.
    
    B) Unified domain family
    Move Scout under scout.carinaai.uk and console.scout.carinaai.uk. One root domain. Parent-child relationship is obvious from URLs alone. Same visual language with different accent colors (green for Carina, red/amber for Scout).
    
    C) Keep separate domains, fix the narrative
    Both sites stay on their own domains but cross-link with explicit funnel language. Carina nav has "Upgrade to Scout." Scout header says "Powered by Carina" with a link back. Each site makes the relationship impossible to miss.
    
    Which direction do you want?


 Good. Here's the audit and the plan.
    
    Current state:
    
    Surface: carinaai.uk
    Nav: Use cases, Security, Pricing
    Carina↔Scout connection: Scout is a buried section, not in nav. Shows "£79/mo" (wrong price)
    ────────────────────────────────────────
    Surface: labyrinthscout.com
    Nav: Kill Switch, Trust Passport, Governance, Pricing, Docs, Carina
    Carina↔Scout connection: Has "Carina" nav link back. Has ecosystem section. But nothing says "Scout is the paid
      tier of Carina"
    
    What needs to change on carinaai.uk:
    
    1. Nav: Add "Scout" as a visible item between Security and Pricing
    2. Scout section: Fix pricing to £49 Basic / £99 Pro / Enterprise custom. Replace "Explore Labyrinth Scout" CTA with something that makes the upgrade path explicit ("Add Scout to Carina" or "Upgrade to Scout")
    3. Pricing page: Show the three-tier Carina→Scout journey: Free (Carina) → Monitor £49/mo → Pro £99/mo → Enterprise. Make the funnel visible in one table.
    
    What needs to change on labyrinthscout.com:
    
    1. Header: Add "Scout by Carina" or a small Carina wordmark so it's clear this is part of the same product family
    2. Hero: Mention Carina. "Scout is the governance layer for Carina. Start free, upgrade when you need control."
    3. Ecosystem section: Already partially there; make the flow explicit: Carina free → Scout £49 → Pro £99 → Enterprise
    
    Total changes: ~6 paragraphs of copy and a handful of nav/CSS tweaks across 2 static HTML sites. Nothing architectural.Corrected. Carina and Scout are sibling Verlox products. Carina depends on Scout, not the reverse. Scout is agent-agnostic.
    
    Revised plan:
    
    carinaai.uk changes:
    
    1. Nav: Add "Scout" item. Links to labyrinthscout.com. Label it as a separate product, not a feature.
    
    2. Scout section rewrite: Instead of "Scout is how you stop it" (reads like a Carina add-on), reframe as: "Carina integrates with Scout; Verlox's security and governance layer for autonomous agents. Scout monitors any agent. If you run Carina in production, you need Scout."
    
    3. Self-host section: Add a Scout banner. "Self-hosting Carina is free. Running it in production? Scout gives you kill switch, audit trails, and compliance. £49/mo."
    
    4. Pricing page: Show Carina Cloud pricing with Scout as the clear next tier. Self-host = free. Cloud = paid. Cloud + Scout = paid + £49.
    
    labyrinthscout.com changes:
    
    1. Header: Add "by Verlox" to clarify parent company. Keep "Carina" nav link.
    
    2. Hero: "Scout monitors any autonomous agent; Carina, OpenClaw, Hermes, AutoGPT. Designed by Verlox. Built for production."
    
    3. Ecosystem section: Show the full picture: Scout monitors multiple agents. Carina is the primary/packaged integration. Other agents connect via API.
    
    4. Pricing: Standalone Scout pricing. Note that Carina Cloud users get bundled Scout pricing.
    

     not need to save ther are 2 upper tiers of pricing scout montinor only observe/monitor and its the £49 and then scou
t govern which is £99 and it the one that give the actions - kill swithc etc. one - you see, the other you act on what
 you see



Got it. The tiers:
    
    | Tier          | Price  | What it does                                                 |
    |---------------|--------|--------------------------------------------------------------|
    | Scout Monitor | £49/mo | Observe. Monitoring, threat detection, audit logs            |
    | Scout Govern  | £99/mo | Act. Kill switch, governance, intervention, injection shield |
    | Enterprise    | Custom | SOC2, custom retention, dedicated infra                      |
    
    "One you see. The other you act on what you see." That's the pitch.
    
    Here's the copy plan for Cursor. Tell me what to adjust:
    
    
    
    carinaai.uk; Nav change:
    
    Add between Security and Pricing:
    html
    <a href="https://labyrinthscout.com">Scout</a>
    
    
    carinaai.uk; Scout section rewrite:
    
    Current: "Production Security. Your agent can email, execute, and reach client data..."
    
    Replace headline with:
    
    Scout monitors every agent decision. Scout Govern stops the bad ones.
    
    Body:
    
    Scout is Verlox's security and governance layer for autonomous agents. 
    It works with Carina, OpenClaw, Hermes; any agent. Two tiers.
    
    Scout Monitor (£49/mo) watches everything. Live feed, threat detection, 
    audit logs. You see what your agents are doing.
    
    Scout Govern (£99/mo) acts on what it sees. Kill switch, injection shield, 
    human-in-the-loop approvals, egress controls. You stop incidents before 
    they become breaches.
    
    
    carinaai.uk; Self-host banner (new section before footer):
    
    
    Self-hosting Carina is free. Forever. MIT licensed.
    
    Running it in production with client data? You need Scout Monitor. 
    One rogue tool call is all it takes.
    
    Scout Monitor; £49/mo. See everything your agents do.
    Scout Govern; £99/mo. Stop anything that goes wrong.
    
    
    labyrinthscout.com; Hero change:
    
    Current: "Mission Control for Autonomous Agents. Autonomous agents are powerful. Who's in control?"
    
    Add: Scout is agent-agnostic. Carina, OpenClaw, Hermes, AutoGPT; monitor any agent from one console.
    
    labyrinthscout.com; Pricing section:
    
    Make the two tiers explicit:
    
    Scout Monitor; £49/mo    |  Observe
    Scout Govern; £99/mo     |  Act
    Enterprise; Custom        |  Comply
    
    
    
    
    Does this match what you want?



     now you have the full picture. is it clear to you
────────────────────────────────────────


╭─  Hermes ─────────────────────────────────────────────────────────────────────────────────────────────────────────╮
    Yes. Clear.
    
    Two Verlox products. Siblings. Carina = free MIT workspace. Scout = paid security, agent-agnostic, two tiers (Monitor £49/see, Govern £99/act). Carina depends on Scout for compliance. Carina markets with Scout as the natural upgrade. Scout sells standalone too.
    
    Four customer surfaces. Two private operator surfaces. The sites don't tell this story yet.



 carina is the only autonomous agent platform that comes with security, governance and trust. you can sill download t
he self-hostable carina. but the one on our platform (the cloude version) is not free, using on app.carinaai.uk alone
attract a fee starting from £20/mo (this covers mostly for plaftorm maintenance and metered token usage) you can also
bring you own keys (byok) - you can upgrade to carina+scout monitor at £49/mo and even higher to carina+scout govern a
t £79/mo. we also have enterprise rates to big teams. Got it. Here's the corrected pricing:

    
    |                 | Standalone | With Carina Cloud                        |
    |-----------------|------------|------------------------------------------|
    | Carina Cloud    |; | £20/mo (platform + metered tokens, BYOK) |
    | + Scout Monitor | £49/mo     | £49/mo (bundled)                         |
    | + Scout Govern  | £79/mo     | £79/mo (bundled)                         |
    
    Self-hosted Carina = free, MIT. Scout banner in-app for production users.
    
    Let me rewrite the copy. Here's the updated prompt for Cursor:
    
    
    
    carinaai.uk; Nav change:
    
    Add between Security and Pricing:
    html
    <a href="https://labyrinthscout.com">Scout</a>
    
    
    carinaai.uk; Scout section (replace current):
    
    Headline: The only autonomous agent platform with security built in
    
    Body:
    
    Carina is the only agent workspace that ships with governance, 
    compliance and trust verification. No bolt-ons. No separate vendors.
    
    Scout Monitor watches every agent decision. Live feed, threat 
    detection, audit logs. Scout Govern acts on what it sees; kill 
    switch, injection shield, human approvals.
    
    Carina Cloud starts at £20/mo. Add Scout Monitor at £49/mo. 
    Add Scout Govern at £79/mo. Self-host Carina for free.
    
    
    carinaai.uk; Self-host section:
    
    
    Self-host Carina for free. MIT licensed. Forever.
    
    Running in production with client data? Scout Monitor is not optional.
    One rogue tool call is all it takes. £49/mo. See everything.
    £79/mo with Scout Govern. Stop anything.
    
    
    carinaai.uk; Pricing page:
    
    Remove "£79/mo" and "£99/mo" references. Replace with:
    
    Carina Cloud          £20/mo    Platform + metered tokens, BYOK
    + Scout Monitor       £49/mo    Observe everything
    + Scout Govern        £79/mo    Act on threats
    Enterprise            Custom    SOC2, dedicated infra, custom retention
    
    
    labyrinthscout.com; Hero:
    
    Add line: Scout is agent-agnostic. Monitor Carina, OpenClaw, Hermes, AutoGPT; any agent from one console.
    
    labyrinthscout.com; Pricing:
    
    
    Scout Monitor    £49/mo    Observe. Monitoring, threat detection, audit trails
    Scout Govern     £79/mo    Act. Kill switch, injection shield, governance
    Enterprise       Custom    SOC2 readiness, dedicated infrastructure
    
    Carina Cloud users get Scout Govern at £79/mo.
    
    
    labyrinthscout.com; Add Carina Cloud connector section:
    
    Already on Carina Cloud?
    Scout is pre-integrated. Upgrade your Carina Cloud plan to add 
    Scout Monitor (£49/mo) or Scout Govern (£79/mo). No setup. 
    Your agents are governed in minutes.
    
    





 Here's the prompt Instruction:
    
    
    
    Task: Rewrite Carina + Scout marketing sites; position as sibling Verlox products with clear pricing
    
    Two static HTML sites. Copy changes only. No structural rework.
    
    Pricing reference:
    
    |               | Standalone | With Carina Cloud |
    |---------------|------------|-------------------|
    | Carina Cloud  |; | £20/mo            |
    | Scout Monitor | £49/mo     | £49/mo bundled    |
    | Scout Govern  | £99/mo     | £79/mo bundled    |
    | Enterprise    | Custom     | Custom            |
    
    Self-hosted Carina = free MIT. Cloud = paid. Scout = agent-agnostic security product.
    
    
    
    SITE 1: carinaai.uk
    
    Local: /opt/lampp/htdocs/verlox/carina/carinaai.uk/
    Server: /www/wwwroot/carinaai.uk/
    
    1. Nav; Add "Scout" link between Security and Pricing, pointing to https://labyrinthscout.com
    
    2. Scout section; Replace current copy (starts "Production Security. Your agent can email..."). New copy:
    
    Headline: The only autonomous agent platform with security built in
    
    Body:
    
    Carina is the only agent workspace that ships with governance, 
    compliance and trust verification. No bolt-ons. No separate vendors.
    
    Scout Monitor watches every agent decision; live feed, threat 
    detection, audit logs. Scout Govern acts on what it sees; kill 
    switch, injection shield, human-in-the-loop approvals.
    
    Carina Cloud starts at £20/mo. Add Scout Monitor at £49/mo. 
    Add Scout Govern at £79/mo (vs £99 standalone).
    Self-host Carina for free. MIT licensed. Forever.
    
    
    3. Self-host section; Add new section before footer:
    
    
    Self-host Carina. Free. MIT. Forever.
    
    Running in production with client data? Scout Monitor is not optional. 
    One rogue tool call is all it takes.
    
    Scout Monitor; £49/mo. See everything your agents do.
    Scout Govern; £79/mo on Carina Cloud. Stop anything that goes wrong.
    
    
    4. Pricing page; Fix prices. Remove any £79 or £99 standalone Scout prices shown outside the table context. Table should show:
    
    
    Carina Cloud          £20/mo    Platform + metered tokens, BYOK
    + Scout Monitor       £49/mo    Observe everything
    + Scout Govern        £79/mo    Act on threats (vs £99 standalone)
    Enterprise            Custom    SOC2, dedicated infra, custom retention
    
    
    
    
    SITE 2: labyrinthscout.com
    
    Local: /opt/lampp/htdocs/verlox/carina/labyrinthscout.com/
    Server: /www/wwwroot/labyrinthscout.com/
    
    1. Hero; Add one line below existing hero text:
    
    Scout is agent-agnostic. Monitor Carina, OpenClaw, Hermes, AutoGPT; 
    any agent from one console.
    
    
    2. Pricing section; Ensure prices are:
    
    
    Scout Monitor    £49/mo    Observe. Threat detection, audit trails, live feed.
    Scout Govern     £99/mo    Act. Kill switch, injection shield, governance.
    Enterprise       Custom    SOC2 readiness, dedicated infra, custom retention.
    
    Carina Cloud users: Scout Govern at £79/mo bundled.
    
    
    3. Add section after pricing; "Already on Carina Cloud?":
    
    Already on Carina Cloud?
    
    Scout is pre-integrated. No setup required. Upgrade your Carina Cloud 
    plan to add Scout Monitor (£49/mo) or Scout Govern (£79/mo). 
    Your agents are governed in minutes.
    
    
    
    
    Deploy: After editing, commit both, push to git, then rsync each site to its nginx directory on Contabo:
    
    
    rsync -avz -e "ssh -o ConnectTimeout=5 -o IdentitiesOnly=yes -i ~/.ssh/id_ed25519" \
      /opt/lampp/htdocs/verlox/carina/carinaai.uk/ \
      malike@80.190.81.208:/www/wwwroot/carinaai.uk/
    
    rsync -avz -e "ssh -o ConnectTimeout=5 -o IdentitiesOnly=yes -i ~/.ssh/id_ed25519" \
      /opt/lampp/htdocs/verlox/carina/labyrinthscout.com/ \
      malike@80.190.81.208:/www/wwwroot/labyrinthscout.com/
    
    
    Verify:
    
    curl -s https://carinaai.uk/ | grep -c "£20/mo"
    curl -s https://carinaai.uk/ | grep -c "£79/mo"
    curl -s https://labyrinthscout.com/ | grep -c "agent-agnostic"
    curl -s https://labyrinthscout.com/ | grep -c "£99/mo"
    
    
    
    
 is this a proper possitioning?
────────────────────────────────────────


╭─  Hermes ─────────────────────────────────────────────────────────────────────────────────────────────────────────╮
    There's a tension in it. Let me be direct.
    
    The problem: "Carina is the only agent platform with security built in" and "Scout is a separate product you buy" are contradictory claims. If security is built into Carina, why does it cost extra? If Scout is a separate Verlox product, then Carina doesn't have security built in; it integrates with Scout.
    
    The bundling math is a wash:
    
    | What you pay                                    | Total  |
    |-------------------------------------------------|--------|
    | Scout Govern standalone                         | £99/mo |
    | Carina Cloud (£20) + Scout Govern bundled (£79) | £99/mo |
    
    Same price. The bundle isn't a discount; it's just allocation. Carina Cloud is effectively free when you buy Scout Govern.
    
    The honest positioning would be one of these:
    
    A) Carina leads, Scout follows
    Carina = free MIT workspace. Great on its own. When you go to production, add Scout. Don't claim "security built in"; say "Scout-ready." Carina integrates with Scout in one click. That's the advantage over other agents.
    
    B) Scout leads, Carina follows  
    Scout = the security product (agent-agnostic). Carina Cloud is the easiest way to experience Scout because it comes pre-integrated. Self-host Carina for free, bring your own Scout key.
    
    C) One Verlox platform, two modules
    Verlox sells one thing: an autonomous agent platform. Carina module = workspace. Scout module = security. Buy them together or separately. Pricing reflects modularity. No sibling rivalry in the copy.
    
    The current draft tries to do all three at once. One of them needs to be the headline, and the other two become supporting points. Which one feels right to you?








B) but people don't have their own scout key. how d we position?
────────────────────────────────────────


╭─  Hermes ─────────────────────────────────────────────────────────────────────────────────────────────────────────╮
    "Subscribe to Scout. Get a key. Plug it into Carina; or any agent."
    
    Position it as:
    
    Scout is the product. Carina is the easiest way to use it.
    
    Carina Cloud = Scout pre-integrated. Pay one Verlox bill, get both.
    
    Self-host Carina = free. Then subscribe to Scout separately, add your key. Same Scout, same dashboard, just BYO agent.
    
    Other agents (OpenClaw, Hermes) = also plug in Scout. But Carina is the only one with zero-config integration.
    
    The copy becomes: "Scout secures any agent. Carina comes Scout-ready." No contradiction.


 Fair. Let me think through the actual mechanism.
    
    Scout is a separate product with its own API. Carina has a built-in telemetry pipeline that sends agent actions to any configured Scout instance. Set one config value; SCOUT_KEY; and Carina reports every tool call, every model decision, every agent action to Scout's console. Scout consumes that stream and does its thing: threat detection, audit logging, kill switch.
    
    That's what "Scout-ready" means. Not that Scout is inside Carina. That Carina has the reporting pipeline pre-built. One key. No integration work. Other agents would need custom telemetry plumbing to feed Scout the same data.
    
    So the positioning:
    
    Carina = free MIT workspace. If you run it in production, it can report to Scout with one config line.
    
    Scout = subscription security product. It monitors any agent that feeds it telemetry. Carina is pre-wired for it. Other agents need custom integration.
    
    Carina Cloud = hosted Carina + Scout pre-configured in one subscription. You don't configure the key. It just works.



