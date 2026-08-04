# Propreneur v2 -- Go-Live Gap Audit & Build Order

**Date:** 5 May 2026  
**Status:** Pre-production audit  
**Deployment target:** Contabo VPS (80.190.81.208)  

---

## 1. DEPLOYMENT & INFRASTRUCTURE (Gate: Nothing else matters without this)

| # | Item | Status | Effort | Notes |
|---|------|--------|--------|-------|
| 1.1 | **Contabo VPS provisioning** | NOT STARTED | 1hr | 6 cores, 12GB RAM, 200GB SSD. Need: Nginx, PHP 8.2+, PostgreSQL 16, Redis, Supervisor. Server is created but not configured. |
| 1.2 | **Laravel Forge or manual deploy** | NOT STARTED | 4hr | Forge recommended for management. Alternative: manual Nginx + deploy script. |
| 1.3 | **Domains & DNS** | PARTIAL | 1hr | propreneur.co.uk, propreneur.uk owned. Need: wildcard DNS for tenant subdomains, Cloudflare SSL. |
| 1.4 | **SSL / HTTPS** | NOT STARTED | 30min | Cloudflare or Certbot wildcard cert for `*.propreneur.co.uk`. |
| 1.5 | **PostgreSQL setup** | NOT STARTED | 1hr | Create `propreneur_central` DB, configure `pg_hba.conf`, set up tenant template DB. |
| 1.6 | **Redis** | NOT STARTED | 30min | Needed for cache, sessions, queues. Install + configure on Contabo. |
| 1.7 | **Queue worker (Supervisor)** | NOT STARTED | 30min | Laravel Horizon or classic Supervisor for queue workers. |
| 1.8 | **Deployment script / CI** | NOT STARTED | 2hr | GitHub Actions -> Forge or deploy script. Run tests, migrate, cache. |
| 1.9 | **Email (Resend/Mailgun/SES)** | NOT STARTED | 30min | Transactional emails needed for bookings, notifications, password resets. |
| 1.10 | **Backups (automated)** | PARTIAL | 1hr | Platform backup/DR code shipped. Needs: Backblaze B2 or S3 destination configured. |
| 1.11 | **Monitoring** | NOT STARTED | 30min | UptimeRobot (free), Sentry (free tier) for error tracking. |
| 1.12 | **.env production config** | NOT STARTED | 30min | Generate APP_KEY, set APP_ENV=production, APP_DEBUG=false. |

**Go-live gate:** All 1.x items must be complete before any customer touches v2.

---

## 2. CORE PLATFORM (Essential before any tenant can use the system)

| # | Item | Status | Effort | Notes |
|---|------|--------|--------|-------|
| 2.1 | **Multi-tenancy core** | SHIPPED | - | stancl/tenancy v3. Tenant creation, domain resolution, DB-per-tenant. |
| 2.2 | **Authentication (platform + tenant)** | SHIPPED | - | Platform login, tenant login, password reset. |
| 2.3 | **User Manager** | SHIPPED | - | Super admin and tenant user CRUD, roles, permissions. |
| 2.4 | **Feature Flags** | SHIPPED | - | Catalogue + feature: middleware. |
| 2.5 | **System Settings** | SHIPPED | - | Typed settings definitions UI. |
| 2.6 | **Theme system** | SHIPPED | - | DB-driven theme presets, tenant appearance self-service. |
| 2.7 | **Stripe billing API scaffold** | PARTIAL | 3hr | Routes exist. Needs: webhook handling, subscription management, invoicing. |
| 2.8 | **Subscription & plan management** | PARTIAL | 4hr | Admin CRUD shipped. Needs: tenant subscription enforcement, trial expiry, plan upgrade/downgrade. |
| 2.9 | **Platform admin UI** | SHIPPED | - | Filament admin panels for super admin. |
| 2.10 | **Workspace onboarding** | PARTIAL | 2hr | Tenant self-registration UI exists. Needs: first-run wizard, demo data seeding. |

**Go-live gate:** 2.7 and 2.8 are needed for any paid tenant.

---

## 3. MODULE DELIVERY (13 Modules, ship in priority order)

### 3.1 Customer-Facing Modules (Need to ship first)

| # | Module | Status | Effort | v1 Reference | Notes |
|---|--------|--------|--------|-------------|-------|
| 3.1.1 | **CRM** (Contacts, interactions, import/export) | SHIPPED | - | Full | Need investor intelligence gear (shipped). |
| 3.1.2 | **Pipeline Kanban** (Deals, activities, stages) | SHIPPED | - | Full | Need sourcing pipeline presets. |
| 3.1.3 | **Reporting & Intelligence** | SHIPPED | - | Partial | Tenant reporting hub, pipeline analytics. |
| 3.1.4 | **Carina AI** (Multi-provider, RAG, streaming) | SHIPPED | - | Partial | Core shipped. Need: qualification chatbot, deal analysis. |
| 3.1.5 | **viCal Booking** (Phase 1) | SHIPPED | - | Full | Event types, availability, public booking. Phase 2 deferred. |
| 3.1.6 | **Communications Hub** (Sequences, enrollments) | PARTIAL | 1-2 weeks | Full | Sequences, automation hook shipped. Need: full trigger library, extra channels, `{{workspace.booking_link}}` for viCal. |
| 3.1.7 | **Deal Engine** (Calculators: BTL, BRR, HMO) | PARTIAL | 2-3 weeks | Full | Deal workspace and sourcing criteria shipped. **Need: property schema, BTL/BRR/HMO calculators, Pest coverage.** This is the #1 feature gap. Without calculators, Propreneur is a CRM, not a deal platform. |

### 3.2 Tenancy & Compliance Modules (Ship second)

| # | Module | Status | Effort | v1 Reference | Notes |
|---|--------|--------|--------|-------------|-------|
| 3.2.1 | **Compliance** | PARTIAL | 1-2 weeks | Full | Routed CRUD shipped. Need: full checklists, document vault bridge, automated reminders. |
| 3.2.2 | **Document Vault** | NOT STARTED | 2-3 weeks | Full | Often built with Compliance. Need: document storage, versioning, share links, verification. |
| 3.2.3 | **Accounting** (GL phases 1-5) | SHIPPED | - | Full | Full double-entry GL. Phases 1-5 shipped including ledger drill-down. |

### 3.3 Specialised Portals (Ship third)

| # | Module | Status | Effort | v1 Reference | Notes |
|---|--------|--------|--------|-------------|-------|
| 3.3.1 | **Mentoring OS** | NOT STARTED | 1-2 weeks | Full | **HIGH PRIORITY for Salim.** Import from v1: copy backend (models, services, controllers), write fresh stancl migrations, rebuild Blade views in Tailwind v4. |
| 3.3.2 | **Investor Portal** | PARTIAL | 1-2 weeks | Full | Investor hub API shipped. Need: investor portal UI, deal access, KYC, communication. |
| 3.3.3 | **Project Management** | NOT STARTED | 2-3 weeks | Partial | Phase 2 / deferred. |
| 3.3.4 | **HR & Payroll** | NOT STARTED | 3-4 weeks | Full | Phase 3 / deferred. Staff management, shifts, payroll, leave. |

### 3.4 Community Learning

| # | Module | Status | Effort | v1 Reference | Notes |
|---|--------|--------|--------|-------------|-------|
| 3.4.1 | **Community & Learning** | SHIPPED | - | Full | Community posts, learning paths, courses. |

---

## 4. INTEGRATIONS (Needed for Salim & first tenants)

| # | Integration | Status | Effort | Notes |
|---|-------------|--------|--------|-------|
| 4.1 | **Stripe (payments)** | PARTIAL | 3hr | stripe/stripe-php installed. Webhook scaffold exists. Need: full subscription lifecycle. |
| 4.2 | **Zoom** | NOT STARTED | 2hr | Zoom API integration for auto-generating meeting links on booking. Salim needs this. |
| 4.3 | **Google Calendar** | NOT STARTED | 2hr | Two-way sync between viCal and Google Calendar. Salim needs this. |
| 4.4 | **Email (Resend/Mailgun)** | NOT STARTED | 1hr | Transactional email provider setup. |
| 4.5 | **PropertyData.co.uk** | NOT STARTED | 2hr | EPC, Land Registry, market data for Deal Engine. |
| 4.6 | **Trello** | NOT STARTED | 3hr | Two-way sync (Salim requested). Lower priority. |

---

## 5. TESTING & QUALITY (Before any production deployment)

| # | Item | Status | Effort | Notes |
|---|------|--------|--------|-------|
| 5.1 | **Test suite pass** | PARTIAL | Ongoing | 350 passed, 3 skipped. Need: run full suite after each module. |
| 5.2 | **Deal Engine tests** | NOT STARTED | With module | Calculator accuracy tests for BTL, BRR, HMO. |
| 5.3 | **Mentoring OS tests** | NOT STARTED | With module | Import from v1 requires new Pest tests. |
| 5.4 | **Integration tests** | NOT STARTED | 1 day | Stripe webhook, Zoom, Google Calendar integration tests. |
| 5.5 | **Load testing** | NOT STARTED | 1 day | Concurrent tenant operations, queue throughput, DB connection pooling. |
| 5.6 | **Security audit** | PARTIAL | 1 day | SCOUT shipped. Need: penetration test, OWASP review. |
| 5.7 | **GDPR / data protection review** | NOT STARTED | 1 day | Data retention, export, right-to-erasure workflows. |

---

## 6. V1-TO-V2 MIGRATION PATH

| # | Item | Status | Effort | Notes |
|---|------|--------|--------|-------|
| 6.1 | **Data migration plan** | NOT STARTED | 1 week | How to migrate existing v1 tenants to v2. Schema vastly different. |
| 6.2 | **Mentoring OS import** | NOT STARTED | 1-2 weeks | Copy backend (models, services, controllers), fresh stancl migrations, new views. |
| 6.3 | **PropBook booking import** | NOT STARTED | 1 week | viCal already covers this. Import historical booking data if needed. |
| 6.4 | **v1 feature parity audit** | NOT STARTED | 2 days | Compare v1 controller inventory (200+ controllers) against v2. Identify gaps. |

---

## 7. BUILD ORDER (Recommended Sequence)

### Phase 1: Minimum Viable Platform (Week 1)
```
1. Contabo VPS setup + Forge deployment           [Must ship first]
2. SSL, DNS, email, Redis, queue worker            [Must ship first]
3. Backups + monitoring                            [Must ship first]
4. Deal Engine calculators (BTL, BRR, HMO)         [Critical feature gap]
```

### Phase 2: First Tenant Ready (Week 2)
```
5. Mentoring OS import from v1                     [Salim's requirement]
6. Zoom integration                                 [Salim's requirement]
7. Google Calendar integration                      [Salim's requirement]
8. Compliance + Document Vault                      [Legal requirement]
```

### Phase 3: Paid Tenant Ready (Week 3-4)
```
9. Stripe subscription lifecycle                    [Revenue requirement]
10. Tenant onboarding + demo data                   [User experience]
11. v1 data migration path                          [Existing customers]
```

### Phase 4: Product Differentiation (Month 2)
```
12. AI Lead Qualification Chatbot (Carina)          [Differentiator]
13. Speed-to-Lead Engine                            [Conversion]
14. Marketing Template Library                      [Value-add]
15. Sourcing Pipeline Presets                       [Property focus]
```

### Phase 5: Full Parity (Month 2-3)
```
16. Project Management module                       [Parity]
17. HR & Payroll module                             [Parity]
18. Remaining integrations                          [Parity]
19. Investor Portal UI                              [Parity]
```

---

## 8. SUMMARY: SHIPPED vs NEEDED

| Category | Shipped | Partial | Not Started |
|----------|---------|---------|-------------|
| Infrastructure | 0 | 2 | 10 |
| Core Platform | 6 | 2 | 0 |
| Customer Modules | 6 | 2 | 0 |
| Tenancy Modules | 1 | 1 | 1 |
| Specialised Portals | 0 | 1 | 3 |
| Community & Learning | 1 | 0 | 0 |
| Integrations | 0 | 1 | 5 |
| Testing | 1 | 1 | 5 |
| Migration | 0 | 0 | 4 |
| **Total** | **15** | **10** | **28** |

**Minimum path to first paid tenant:** Phase 1 + Phase 2 = ~2 weeks full-time.
**Full parity with v1:** Phase 1-5 = ~3 months part-time.

---

## 9. RISKS

| Risk | Mitigation |
|------|------------|
| Contabo VPS underpowered for multi-tenant DB-per-tenant (Postgres connections) | Monitor connection pooling; upgrade to CX31 if needed (12/month extra) |
| No paid tenants yet = no revenue validation | Ship Deal Engine + Mentoring OS first; onboard Salim as first paying tenant |
| v1-to-v2 migration complexity | Don't migrate yet -- run v1 and v2 in parallel until full parity is reached |
| Scope creep (building all 13 modules before first sale) | Focus on Phase 1-2 only until first customer is live and paying |
