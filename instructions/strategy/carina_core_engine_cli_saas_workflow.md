are we going to fork our final carina and make it saas?
────────────────────────────────────────


╭─  Hermes ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────╮
    No. Don't fork. Same codebase, different deployment modes.
    
    Here's why:
    
    Forking kills you slowly. Every bug fix, every new tool, every skill update; you do it twice. Within 6 months, the two versions have diverged and you're maintaining two products instead of one. This is how startups die.
    
    What you actually want:
    
    
    carina/
      packages/
        core/           ← The agent engine (same for both)
        cli/            ← CLI wrapper (self-hosted mode)
        cloud/          ← SaaS layer (tenancy, billing, web UI)
        scout/          ← Security (same for both)
      config/
        self-hosted.yaml
        cloud.yaml
    
    
    Same core, different skins. The CLI and Cloud are thin layers over the same engine.
    
    How it works in practice:
    
    - carina chat (CLI) → loads local config, connects to local DB, uses your API keys, runs locally
    - app.carinaai.uk/chat (Cloud) → loads tenant config from Postgres, connects to our API keys, runs on our infra
    - Both call carinaAgentService.chat(); the exact same function
    
    The agent doesn't care where it's running. It just needs a config and a database connection. Everything Claude described; tenant_id, Row-Level Security, session externalization; these are additions to the same codebase, not a fork.
    
    The one exception:
    
    Don't put cloud-specific code (billing, tenant management UI) in the open-source CLI package. But keep it in the same monorepo. The CLI package only includes core/ and cli/. The SaaS deployment includes everything.
    
    This is how GitLab, Sentry, and PostHog all work; open-source core, cloud features in the same repo, different build targets.
    
    
    
so where do we keep the engine?

────────────────────────────────────────

╭─  Hermes ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────╮
    
    carina/
      engine/              ← HERE. This is the agent. Everything else wraps it.
        agent/             ← Agentic loop, tool dispatch, model routing
        tools/             ← All 40+ tool implementations
        skills/            ← All 70+ skill files
        memory/            ← Memory storage + session search
        security/          ← Scout prompt injection, audit, kill switch
        channels/          ← Telegram, Discord, Slack, SMS adapters
    
      cli/                 ← Thin shell. npm install carina.
        index.ts           ← Commands: carina chat, carina serve, carina config
        config.ts          ← Reads carina.yaml, .env
        local-db.ts        ← SQLite for self-hosted, same schema as Postgres
    
      cloud/               ← SaaS layer. Not in the open-source package.
        auth/              ← Registration, login, JWT, SSO
        billing/           ← Stripe integration, usage metering, invoices
        tenancy/           ← Tenant isolation, RLS policies, workspace management
        api/               ← Public REST + WebSocket API
        web/               ← Chat UI, dashboard, admin panel
        db/                ← Postgres migrations with tenant_id on every table
    
      domain-packs/        ← Shared between CLI and Cloud
        property-uk/
        template/
    
    
    One repo. One engine. Two build targets:
    
    bash
    CLI package; what goes to npm
    npm run build:cli
    Output: packages/carina-cli/
    Contains: engine/ + cli/
    
    Cloud deployment; what runs on our servers
    npm run build:cloud
    Output: packages/carina-cloud/
    Contains: engine/ + cloud/ + domain-packs/
    
    
    The engine has no idea whether it's running on someone's laptop or in a Docker container behind a load balancer. It just receives config and returns responses. That's the whole trick.


