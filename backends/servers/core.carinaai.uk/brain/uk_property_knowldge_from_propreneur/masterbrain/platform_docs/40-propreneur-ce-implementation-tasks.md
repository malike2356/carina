# Propreneur Community Edition - implementation tracker

Last updated: 2026-05-11

Product split: **Community Edition (CE)** on `propreneur-v1` / propreneur.uk; **Business Edition (BE)** on `propreneur-v2` with paid plans **Operator** and **Mentor Network** only. Spec: `propreneur-ce-prompt.md`.

**Mobile:** native app in `propreneur-mobile/` is a **Business Edition** entitlement only, redesigned for v2 BE workflows. The client targets **v2 BE** APIs; CE stays web-only on propreneur.uk.

## Completed

- [x] CE edition config and `PlatformEdition` helper
- [x] BE-only feature gating (HR/payroll, CMS, calendar, mentorship, premium reporting)
- [x] CE Carina BYOK-only (no platform-managed fallback)
- [x] CE PropertyData BYOK-only (no host `.env` fallback)
- [x] Shared BYOK requirement messaging via `TenantByokAccess` across AI and PropertyData entry points
- [x] Carina UI gate: full-page assistant, floating widget, and quota banner hidden when platform AI is disabled
- [x] SMTP platform defaults with tenant override (v1 admin + v2 workspace settings)
- [x] System-wide CE UI: badge, banner, footer note, page titles, meta (`layouts/app`, auth, login)
- [x] CE billing bypass middleware and billing controller redirects
- [x] CE self-service support help section; live ticket create/store redirected
- [x] CE terms addendum on platform Terms of Service with onboarding, footer, and help links
- [x] PropertyData and Carina BYOK copy on CE settings pages
- [x] Marketing homepage, pricing compare, start, waitlist, features page, blog index, launch post, and Open Graph meta
- [x] v2 billing catalogue: Operator and Mentor Network only; legacy slugs map to Operator
- [x] v2 signup copy and tenant provisioning respect configured trial days (default 0)
- [x] v2 Business Edition getting-started checklist, dashboard shortcuts, workflow steps, UK form defaults, and help-aware global search
- [x] Deployment edition snapshot written once to `audit_log`
- [x] Automated tests for CE edition helpers, BYOK, billing bypass, legal addendum, trial reminders, feature gates, and support redirects
- [x] CE trial expiry reminder command disabled on Community Edition deployments
- [x] In-app billing help copy for CE vs BE and two paid plans
- [x] v1 public plan defaults and admin copy aligned to Operator / Mentor Network (legacy keys retained for grandfathered tenants)
- [x] CE signup on marketing `start.html` via public API (verify email, then use); no Stripe
- [x] Business Edition marketing CTAs temporarily routed to `waitlist.html` (no v1 Stripe checkout)

## Deferred until Business Edition (v2) deploy

- [ ] Re-point Operator and Mentor Network CTAs from `waitlist.html` to live v2 BE checkout / onboarding (replace temporary waitlist routing on `index.html`, `pricing-compare.html`, and `start.html`).
- [ ] Remove waitlist-only guard in `WaitlistController` for `operator` and `mentor_network` when v2 checkout is live.
- [ ] Restore `create_checkout` behaviour in `propreneur.co.uk/main.js` only if v2 waitlist API should still offer Stripe from marketing.
- [ ] Do not provision paid BE tenants on v1 (`propreneur.uk/start` / waitlist Stripe); paid workspaces belong on v2 after deploy.

## Business Edition mobile app (BE-only)

**Product rule:** only **Business Edition** members (active **Operator** or **Mentor Network** on v2) may use the React Native client under `../propreneur-mobile/`. **Community Edition** is browser-only on propreneur.uk; do not advertise app stores or mobile download on CE marketing or onboarding.

**Backend target:** the mobile app points at **propreneur-v2** (BE), not the CE v1 MIS host. The tree is still a shell (`android/`, `ios/` placeholders); v1 `MisMobileController` and `/api/v1/mis/*` remain legacy MIS integrations until v2 mobile API ships.

**Redesign:** rebuild `propreneur-mobile/` for **Business Edition** workflows on v2 ? not a port of the v1 MIS mobile surface or CE web IA. Prioritise BE operator and mentor-network jobs (deals, pipeline, compliance touchpoints, Carina where enabled); defer CE-only or full MIS breadth on phone.

### Backlog (with v2 BE deploy)

- [ ] Redesign mobile IA, navigation, and screen set for BE on v2 (Operator vs Mentor Network where plans differ); align with v2 web patterns, not v1 admin/mobile parity.
- [ ] Set mobile app env/config (API base URL, tenant host resolution, deep links) to v2 BE only.
- [ ] Enforce edition and plan on mobile auth and token issuance: allow active BE tenants; reject CE, unpaid, and waitlist-only accounts with explicit copy.
- [ ] Marketing and in-app help: mobile is a BE benefit; CE CTAs stay on web signup only.
- [ ] Implement or wire v2 mobile API per `brain/prompts/19-mobile-api.md` (auth, sync, deals, pipeline); reuse v1 payload patterns only where they help parity, not as a second CE backend.

## Competitive benchmark: Prop AI Deals (PAID)

**Research archive:** `_ignore/07_market_research_and_competitors/market_research/propaid/` (`00-prop-ai-deals-research-and-v1-parity.md`, `01-authenticated-sidebar-ia.md`, public API probes 2026-05-11). Hub: `_ignore/AGENT_INDEX.md`.

PAID is a narrow **UK property acquisition OS** (not a full MIS). Propreneur wins on breadth (portals, portfolio ops, compliance, accounting, PropBook, mentoring); PAID wins on **speed-to-first-deal**, **listing-led UX**, and **platform-scale inventory**. Treat the items below as product design pressure, not a mandate to clone ~400k public SEO pages or run national crawlers on CE.

### What makes them feel special or better

| Edge | What users see | Evidence (external observation) |
|------|----------------|----------------------------------|
| Acquisition-first home | ?Morning briefing? framing, numbered onboarding (~10 min), shortcuts (add deal, scanner, comparables, calculator, investor pack, outreach) | Authenticated `/dashboard/home` copy; empty pipeline until scanners exist |
| Target scanners as habit | On-market / off-market scanners; ?each scanner runs nightly?; pipeline fills from matches | `/dashboard/lead-generators`; `GET /api/v1/lead-generators` (auth) |
| Listing URL as primary action | Top bar + Import Property: paste Rightmove / Zoopla / OnTheMarket URL | `/dashboard/import-property`; `POST /api/v1/deals/import` (auth) |
| Visual deal cards | Pipeline and search show **photos on cards**; property pages use portal CDN images in meta | Public `GET /api/v1/properties/{uuid}` returns `main_image_url` + `images[]` hotlinked to `lid.zoocdn.com` / `media.rightmove.co.uk` |
| Mass indexed catalogue | Huge public `/property/{uuid}` surface; marketing claims **635k+** properties analysed daily and **2.1M+** indexed | Sitemap queue ~400k URLs; marketing `/properties` copy |
| Enriched listing record | One normalised property payload with scores, rental bands, motivation signals, long description | Public property JSON ~250 fields (`source`, `external_id`, `url`, yield/BMV/strategy slots) |
| AI in the workflow | **Archie** sidebar + live deal picks on home | Sidebar IA; sample ?Archie?s live deals? cards |
| Packaged outputs | Investor packs / reports, outreach letters + templates beside deals | Sidebar ?My Assets?; captured dashboard routes |
| Alerts breadth | Email / SMS / WhatsApp positioning on pricing | Marketing guarantees (e.g. 5+ matches in 24h) |
| Growth surface | Academy, community, competitor-compare SEO, PWA shortcuts, affiliate/analytics stack | Public sitemap + authenticated community nav |
| Chrome extension | Save from portal while browsing | Nav ?Chrome Extension? (behaviour not verified in mirror) |

### Ingestion pattern (relevant to ?deals with images?)

- **Bulk path:** separate ingestion service (`propertyestate-*` on Railway in CSP) feeding `api.propaideals.co.uk`; listings keyed by portal `source` + `external_id` + canonical `url`.
- **Images:** store **portal CDN URLs** on the property row; UI hotlinks (search often returns ~4 preview URLs; detail returns full gallery). No evidence in API responses of first-party image hosting.
- **User path:** authenticated import from listing URL; extension likely complements paste-import (not reverse-engineered here).

### Propreneur v1 baseline vs PAID (deals + images)

| Capability | v1 today (`propreneur-v1`) | Gap vs PAID |
|------------|------------------------------|-------------|
| Deal hero image | `deals.image_url`; shown on pipeline, index, show | Extension capture **does not** set `image_url`; manual deal create may omit image |
| Sourcing inbox images | `sourced_listings.image_url`; grid + detail in deal-sourcer inbox | Depends on alert run + provider; not wired through extension |
| Promote to deal | `DealSourcingService::promoteToDeal()` copies `image_url` | Works when inbox row has image |
| Browser extension | `browser-extensions/propreneur-listing-capture/` ? `POST /api/v1/admin/listing-capture` | Payload has no `image_url` / gallery; only URL, title, excerpt, optional price/beds |
| Paste listing URL in admin | ? | No first-class import screen like PAID |
| National listing corpus + public SEO | Tenant-scoped deals/listings only | No platform-wide `/property/{uuid}` index |
| Nightly scanners | Deal sourcing alerts + inbox | UX/onboarding not as scanner-first as PAID |

## Product goal: deals with images on v1 BE (CE-feasible scope)

**Outcome:** every deal entering the pipeline from a portal listing should show a **thumbnail on kanban/list** and a **hero on deal show**, using **hotlinked portal image URLs** by default (same pattern as PAID). Optional mirroring to tenant storage is **BE-only** later.

**CE is feasible without platform scraping:** user-initiated capture (extension + paste URL), promotion from sourcing inbox, and manual edit of `image_url` all fit CE legal/ops posture. **Do not** ship CE as a national crawler or 400k-page SEO clone.

**BE / platform later:** managed PropertyData (non-BYOK), heavier scanner automation, optional image mirroring, larger catalogue or SEO programmes.

## Prioritized backlog ? deals with images (v1 BE)

### CE-safe (ship on Community Edition)

- [ ] **Extension ? deal image:** accept optional `image_url` (and later `image_urls[]`) on `ListingCaptureController`; validate `https` URL, length, allowed hosts (Rightmove, Zoopla, OnTheMarket CDNs); persist on `Deal.image_url`; set `referrerpolicy="no-referrer"` in UI (already on deal show).
- [ ] **Extension DOM capture:** in `browser-extensions/propreneur-listing-capture`, extract primary `og:image` / largest gallery `img` on supported hosts; send as `image_url`; document user ToS responsibility in extension readme (already present).
- [ ] **Paste listing URL (admin):** GUI-first flow on Deals (or Import Property page): paste URL ? preview title, price, beds, **thumbnail** ? create deal in `lead` with `image_url`, `source`, notes with listing URL; no silent bulk scrape.
- [ ] **URL resolver service:** map Rightmove / Zoopla / OTM listing URLs to `image_url` + core fields using **user-operated** fetch or **tenant BYOK** PropertyData where configured; time-boxed, rate-limited, audit-logged; return structured payload for deal create (not a national index).
- [ ] **Sourced listing ? deal:** ensure promote-to-deal and inbox ?add deal? always copy `image_url`; when missing, allow one-click ?fetch photo from listing URL? using the same resolver.
- [ ] **Pipeline polish:** default placeholder when `image_url` empty; keep card crop consistent with `admin/deals/pipeline.blade.php`; surface listing URL on deal show.
- [ ] **Deal image fields on APIs:** include `image_url` on deal payloads in `MisMobileController` (and any deal list endpoints) wherever sourced listings already expose it. Native **propreneur-mobile** remains BE-only on v2; this item is web/API parity for deals with images, not CE mobile access.
- [ ] **Help + onboarding:** CE getting-started step ?Add a deal from a listing URL or extension?; help section explains hotlink vs uploaded photos.
- [ ] **Tests:** feature tests for listing-capture with image, URL import create, promote-to-deal image copy.

### Business Edition / platform (defer from CE)

- [ ] **Managed PropertyData sourcing:** non-BYOK alert runs that reliably populate `sourced_listings.image_url` via existing providers (`RightmoveProvider`, `ZooplaProvider`, etc.) when platform keys exist.
- [ ] **Optional image mirror:** background job to copy hotlinked images into tenant `storage/` for PDF packs / offline mobile; store both `image_url` (CDN) and `image_path` (local).
- [ ] **National catalogue / public property SEO:** only with explicit business case; do not block CE deals-with-images on this.
- [ ] **PAID-style acquisition home:** morning briefing dashboard, scanner-first empty states, investor pack wizard ? track in v2 BE UX (`propreneur-v2` deal workspace parity), not required for CE image parity.

## Notes

- `FeatureHelper::COMMUNITY_KEYS` is the social forum module, not Community Edition.
- Super admins still bypass feature gates for support and QA.
- Set `PROPRENEUR_EDITION=business` on a v1 deployment only for internal BE-style testing on the legacy stack.
- Ongoing BE polish (extra tooltips, more multi-step flows) can follow the same `data-tooltip` and `x-ui.workflow-steps` patterns added on deal and compliance forms.
- `propreneur-mobile/` is not a CE deliverable; redesign and ship it for v2 Business Edition only (not a v1 MIS mobile port).
