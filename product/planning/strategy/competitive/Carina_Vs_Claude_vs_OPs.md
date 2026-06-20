 Use this in Cursor:

  You are working in /opt/lampp/htdocs/verlox/carina/ops.carinaai.uk.

  Goal
  Close the functional gap between Carina Ops and Claude Console by turning the ops panel into a real AI platform control plane, not just an internal admin dashboard. The target is not a pixel-for-pixel clone. The target is to implement
  the missing product surfaces that Claude Console has and Carina Ops does not: org controls, credits and spend, workbench, files, skills, batches, managed agents, sessions, deployments, environments, credential vaults, memory stores, and
  analytics.

  Read these first:
  - /opt/lampp/htdocs/verlox/carina/instructions/strategy/Carina_Ops_Claude_Platform_Compare.md
  - /opt/lampp/htdocs/verlox/carina/ops.carinaai.uk/server.ts
  - /opt/lampp/htdocs/verlox/carina/ops.carinaai.uk/views/layout.ejs
  - /opt/lampp/htdocs/verlox/carina/ops.carinaai.uk/routes/*.ts
  - /opt/lampp/htdocs/verlox/carina/ops.carinaai.uk/lib/*.ts
  - /opt/lampp/htdocs/verlox/carina/ops.carinaai.uk/views/*.ejs
  - /opt/lampp/htdocs/verlox/carina/ops.carinaai.uk/package.json
  - /opt/lampp/htdocs/verlox/carina/ops.carinaai.uk/tsconfig.json

  Important constraints
  - Keep all changes inside ops.carinaai.uk unless a small supporting change in core.carinaai.uk is clearly required.
  - Do not add new packages.
  - Use the existing Express, EJS, PostgreSQL, and fetch patterns already in this repo.
  - Keep the current dark ops UI style, but make the new area feel like a product surface, not a settings dump.
  - ASCII only. No emojis. No em dashes or en dashes.
  - If live upstream data is unavailable, use a persistent local table plus graceful empty states, not hardcoded demo cards.
  - Reuse existing Carina endpoints where they exist, especially chat streaming and skill pack management, instead of inventing parallel systems.

  What is missing today
  Claude Console has:
  - Dashboard, API keys, Workbench, Files, Skills, Batches
  - Managed Agents, Sessions, Deployments
  - Environments, Credential vaults, Memory stores
  - Analytics, model compare, credits, spend, prompt caching, batch API, fast mode

  Carina Ops currently has:
  - Dashboard, Tenants, Subscriptions, Security, Chat, Memories, Skills, Skill Packs, RAG Corpus, Projects, Settings

  The gap is a unified AI platform control plane. Build that.

  Implementation plan

  1. Add a new top-level section called AI Platform in the sidebar
  - Update /opt/lampp/htdocs/verlox/carina/ops.carinaai.uk/views/layout.ejs.
  - Add one nav entry for `/ai-platform`.
  - Keep the existing ops sections intact.
  - Use a compact grouping or subnav if needed, but do not overcomplicate the sidebar.

  2. Add a new router for the platform surface
  Create /opt/lampp/htdocs/verlox/carina/ops.carinaai.uk/routes/ai-platform.ts.

  Mount it from server.ts behind requireAdmin.

  The router should support these pages:
  - GET /ai-platform
  - GET /ai-platform/workbench
  - GET /ai-platform/files
  - GET /ai-platform/skills
  - GET /ai-platform/batches
  - GET /ai-platform/agents
  - GET /ai-platform/sessions
  - GET /ai-platform/deployments
  - GET /ai-platform/environments
  - GET /ai-platform/vaults
  - GET /ai-platform/memory
  - GET /ai-platform/analytics
  - GET /ai-platform/credits

  Keep these pages within one router if that is cleaner, but do not make the code messy.

  3. Add local persistence for the missing platform entities
  Create /opt/lampp/htdocs/verlox/carina/ops.carinaai.uk/lib/ai-platform.ts.

  Use the existing pool from lib/db.ts and create a small schema bootstrap function, similar in spirit to the hosted schema initializer.

  Create tables with CREATE TABLE IF NOT EXISTS for the minimum set needed to support the UI:
  - ai_platform_orgs
  - ai_platform_models
  - ai_platform_workbench_runs
  - ai_platform_assets
  - ai_platform_agents
  - ai_platform_sessions
  - ai_platform_deployments
  - ai_platform_environments
  - ai_platform_credential_vault_items
  - ai_platform_memory_stores
  - ai_platform_usage_daily

  Keep the schema practical, not perfect. Use JSONB for flexible metadata where that reduces churn.

  Suggested minimum columns:
  - ai_platform_orgs: id, name, credit_balance, monthly_limit, auto_reload_enabled, prompt_caching_enabled, batch_enabled, created_at, updated_at
  - ai_platform_models: id, provider, model, tier, is_default, status, input_price, output_price, notes, created_at, updated_at
  - ai_platform_workbench_runs: id, org_id, title, prompt, provider, model, status, tokens_in, tokens_out, cost_estimate, response_text, created_at
  - ai_platform_assets: id, kind, name, slug, status, metadata_json, created_at, updated_at
  - ai_platform_agents: id, name, status, model, provider, last_run_at, last_error, created_at, updated_at
  - ai_platform_sessions: id, agent_id, title, status, started_at, ended_at, summary, metadata_json
  - ai_platform_deployments: id, name, environment_id, status, model, provider, version, deployed_at, metadata_json
  - ai_platform_environments: id, name, slug, status, api_base_url, notes, created_at, updated_at
  - ai_platform_credential_vault_items: id, environment_id, name, provider, encrypted_secret, is_active, created_at, updated_at
  - ai_platform_memory_stores: id, name, scope, status, item_count, notes, created_at, updated_at
  - ai_platform_usage_daily: id, usage_date, provider, model, requests, tokens_in, tokens_out, cache_hits, batch_jobs, estimated_cost

  Add helper functions for:
  - seeding a default org if missing
  - listing models
  - reading and writing workbench runs
  - listing and updating assets
  - listing agents, sessions, deployments, environments, vault items, and memory stores
  - rolling up usage for the analytics page
  - updating org credits and feature flags

  Do not over-abstract. Keep the helpers small and direct.

  4. Wire the workbench to real Carina chat streaming
  The workbench should not be a dead-end mock.

  Use the existing Carina chat stream flow from:
  - /opt/lampp/htdocs/verlox/carina/ops.carinaai.uk/routes/chat.ts
  - /opt/lampp/htdocs/verlox/carina/ops.carinaai.uk/lib/carina.ts

  Build a workbench page that can:
  - choose a model/provider from the local model table
  - submit a prompt
  - stream the response using the existing Carina streaming endpoint
  - save the run to ai_platform_workbench_runs
  - show recent runs and their token / cost metadata
  - support a basic prompt cache toggle flag in the org record, even if the underlying cache is just a UI and ledger flag for now

  If you need a route for streaming, add it to the new ai-platform router and proxy through the existing Carina stream mechanism rather than inventing a new backend.

  5. Add the missing product pages
  Build these pages with real tables, forms, and empty states.

  AI Platform overview
  - Show org name, credit balance, monthly limit, auto reload, prompt caching, batch status
  - Show total requests, tokens in, tokens out, cache hits, batch jobs, estimated spend
  - Show counts for agents, sessions, deployments, vault items, memory stores, assets
  - Show a model comparison table with provider, model, tier, status, and price hints
  - Show recent runs and recent changes

  Workbench
  - Prompt composer
  - Provider/model selector
  - Save as draft or run now
  - Recent run list
  - Streaming response panel
  - Run metadata panel

  Files
  - List stored files / assets
  - Include kind, name, status, tags or metadata, created date
  - Add create, edit, archive, delete actions
  - Keep uploads local to disk or to metadata only, depending on the least risky implementation that fits the repo

  Skills
  - Surface installed operator skill packs and platform skills
  - Let the admin enable, disable, or mark a pack as featured
  - Reuse the existing skill pack store if that is the simplest source of truth
  - Show skill versions, source, and last updated timestamps

  Batches
  - Show queued, running, and completed batch jobs
  - Add a create batch form that stores a batch record
  - Add a cancel action
  - If async execution is not available, persist the job and mark it queued, with a clear status model

  Agents, sessions, deployments
  - Show active agents and their last run
  - Show session history
  - Show deployment rows with environment and status
  - Add simple create / update forms for deployments and environments

  Environments
  - Store environment records, API base URLs, notes, and status
  - Include a basic health indicator if a URL can be pinged safely

  Credential vaults
  - Store environment-scoped secrets encrypted at rest
  - Use the same encryption style already used elsewhere in Carina if there is a local precedent
  - Never render secret values back to the page
  - Show name, provider, active status, and timestamps only

  Memory stores
  - Show stores, scope, item count, and notes
  - Add create / update / archive actions
  - Make the page feel like a durable product surface, not a stub

  Analytics
  - Show daily usage rollups
  - Show token totals, request totals, cache hits, batch jobs, estimated cost
  - Break the view down by provider and model
  - Include a simple period selector if easy to do with the current stack

  Credits
  - Show current balance, monthly limit, spend this month, auto reload, prompt caching, and batch enablement
  - Include an edit form to update org settings
  - Keep the copy plain and operational

  6. Add tests
  Use the existing Vitest setup in ops.carinaai.uk.

  Add tests for:
  - ai platform schema bootstrap helpers
  - model listing and org default seeding
  - run persistence
  - asset and environment CRUD helpers
  - any route-level logic that is easy to test without a browser

  Prefer focused unit tests over broad snapshot tests.

  7. Keep the UI consistent
  - Use the same EJS and Tailwind patterns the ops panel already uses
  - Keep cards compact, tables readable, and forms clear
  - Avoid decorative marketing language
  - Avoid giant hero sections
  - Make the first screen useful immediately
  - Use absolute, concrete labels like Credits, Workbench, Models, Agents, Sessions, Deployments, Environments, Vaults, Memory, Analytics

  8. Integrate with existing Carina surfaces instead of duplicating them
  - If the platform page can reuse existing chat, skill pack, or security data, do that
  - Do not create a second unrelated admin model if the repo already has one
  - Keep the ops panel as the control plane for Carina, not a separate product fork

  9. Validation
  After implementation, run:
  - ./node_modules/.bin/tsc --noEmit in /opt/lampp/htdocs/verlox/carina/ops.carinaai.uk
  - pnpm test in /opt/lampp/htdocs/verlox/carina/ops.carinaai.uk if it works in this workspace
  - pnpm css if you touch any Tailwind-backed classes or need to rebuild styles

  Also smoke check that:
  - /ai-platform loads
  - /ai-platform/workbench can save and stream a prompt
  - the sidebar entry is present
  - the existing dashboard and settings pages still work
  - no route or type errors were introduced

  Deliverable
  Implement the feature end to end. Do not stop at a design sketch. Do not leave placeholder tabs that do nothing. The goal is a usable internal AI platform control plane that narrows the Claude Console gap in a way Carina can actually
  own.


