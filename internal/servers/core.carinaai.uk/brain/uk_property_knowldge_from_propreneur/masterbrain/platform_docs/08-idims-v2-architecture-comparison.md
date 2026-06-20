# Loom (IDIMS v2) - Architecture Decisions

**Name:** Loom
**Date:** 6 May 2026  
**Context:** Rebuild IDIMS (association membership management) as a standalone multi-tenant SaaS called Loom, serving many associations.

**Decision:** Standalone repo. Zero shared code with Propreneur. Same server, separate apps. Patterns copied, never shared live.

---

## Comparison Table

| Factor | Standalone SaaS | Verlox Module |
|--------|----------------|---------------|
| **Code independence** | Full. No cross-app coupling. Deploy, scale, modify independently. | Coupled to Propreneur's codebase. Touching shared code risks both products. |
| **Time to MVP** | Longer (3-4 mo). Must rebuild auth, payments, file storage, reports, audit, admin UI, billing from scratch or copy-paste. | Faster (1-2 mo). Auth, payments, Carina AI, document storage, Stripe billing, reporting engine already exist. Build only IDIMS-specific features. |
| **Maintenance burden** | Two codebases to patch, upgrade, deploy. Two sets of dependencies. Two CI/CD pipelines. | One codebase. One `composer update`. One deploy. But shared upgrades (e.g. Laravel version bump) affect both products at once. |
| **Branding & positioning** | Clean. `idims.com` (or whatever). Standalone pricing page, marketing site, no confusion. | Awkward. "Propreneur - also does association management" dilutes both brands. Harder to market. |
| **Product focus** | Each PM/decision is IDIMS-only. No competing priorities from Propreneur's roadmap. | Features prioritised against Propreneur's needs. IDIMS features wait if Propreneur is the revenue driver. |
| **Tech debt isolation** | A bad deploy, a bug, or a security issue stays in IDIMS. Propreneur keeps running. | A breaking change in shared code takes down both apps. Higher blast radius. |
| **Revenue model** | Own pricing, own Stripe account, own billing pipeline. Full margin control. | Shared billing infra but shared costs. Pricing decisions entangled with Propreneur. |
| **Customer data isolation** | Separate databases, separate infrastructure. No risk of tenant crossover. | Shared `propreneur_central` database (if same multi-tenant infra). To be avoided - separate DB cluster per product is safer. |
| **Developer experience** | Clean repo, clean mental model. "This is the IDIMS repo." | Must understand Propreneur's architecture before contributing to IDIMS features. Higher onboarding cost. |

---

## The Verdict

### Choose Standalone if:

- You want to sell IDIMS as a distinct product with its own brand, pricing, and landing page
- You expect IDIMS to eventually match or exceed Propreneur in revenue
- You want independent deploys and zero risk of breaking Propreneur
- You can afford the extra 2-3 months to build the foundation

### Choose Verlox Module if:

- IDIMS is a vertical extension of the Verlox ecosystem - you sell "Verlox for associations" alongside "Verlox for property entrepreneurs"
- You want to prove the market fast with a 1-2 month MVP
- You have one small team and cannot sustain two full codebases
- You're comfortable with shared infrastructure risk

---

## My Recommendation: **Hybrid - Scaffold from Propreneur, but Detach**

Don't rewrite auth, payments, and storage from nothing. Don't fork Propreneur either. Instead:

1. **Borrow the architecture, not the codebase.** Create a **fresh Git repo** for IDIMS v2. Use the same Laravel + stancl/tenancy + Tailwind + Alpine stack.

2. **Extract shared libraries as Composer packages.** Auth patterns, Stripe helpers, audit logging, file upload logic → Verlox-owned private packages on Packagist or a Satis repo. Both apps consume them. Bugfix once, benefit twice.

3. **Separate infrastructure.** Own PostgreSQL cluster, own Redis, own deployment pipeline. Zero coupling at the infrastructure layer.

4. **Shared services, not shared code.** Carina AI, Zoho Books sync, email delivery - these are API calls, not code coupling. Both apps call the same services.

This gives you:

| Benefit | How |
|---------|-----|
| Clean brand & standalone repo | Fresh `idims-v2` repo |
| 60-70% faster than from scratch | Shared packages cover auth, billing, storage, audit |
| Independent deploys | Separate pipelines, separate infra |
| No blast radius | One app's issue stays in that app |
| Shared learning | When you solve a payment edge case in IDIMS, the shared package improves both |
