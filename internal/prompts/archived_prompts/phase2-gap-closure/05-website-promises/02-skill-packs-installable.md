# Phase 2.16; Vertical Skill Packs (Installable)

## Goal
Make domain packs installable, discoverable, and manageable through the Carina console. Users can browse available packs, install with one click, and manage installed packs. This makes "Vertical skill packs (property-uk)" a real deliverable, not just a concept.

## Files to create
```
packages/cloud/web/
  skill-packs/
    index.html; Skill pack marketplace/browser
    css/packs.css
    js/
      pack-browser.js; Browse available packs
      pack-detail.js; Pack details with install button
      pack-manager.js; Manage installed packs

packages/cloud/src/
  api/
    packs-api.ts; REST API for pack management
    registry/
      pack-registry.ts; Available packs index
      pack-installer.ts; Install/uninstall packs
      pack-validator.ts; Validate pack manifests
```

## Pack API
```
GET    /api/packs; List available packs (marketplace)
GET    /api/packs/installed; List installed packs
GET    /api/packs/{slug}; Pack details
POST   /api/packs/{slug}/install; Install pack
DELETE /api/packs/{slug}/uninstall; Uninstall pack
POST   /api/packs/{slug}/update; Update to latest version
GET    /api/packs/{slug}/configure; Pack configuration
PUT    /api/packs/{slug}/configure; Update pack config
```

## Marketplace UI
```
┌──────────────────────────────────────────────────────────────┐
│ SKILL PACK MARKETPLACE                    [Search packs...]   │
├──────────────────────────────────────────────────────────────┤
│ INSTALLED (2) | AVAILABLE (6) | UPDATES (1)                  │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│ ┌─────────────────────────────────────────────────────────┐  │
│ │ property-uk                           (234)         │  │
│ │ UK property investment, compliance, deal analysis        │  │
│ │ v2.1.0 · By Carina Team · Installed 1,234 times          │  │
│ │                                                          │  │
│ │ Includes: 12 prompts, 4 tools, 1 model, 3 data files     │  │
│ │ Tools: Rightmove Scraper, HMO Compliance, Deal Analyzer  │  │
│ │                                                          │  │
│ │ [Installed ] [Configure] [Uninstall]                    │  │
│ └─────────────────────────────────────────────────────────┘  │
│                                                               │
│ ┌─────────────────────────────────────────────────────────┐  │
│ │ legal-uk                                (87)        │  │
│ │ UK legal research, case law search, document drafting    │  │
│ │ v1.3.0 · By LegalTech Community · Installed 456 times    │  │
│ │                                                          │  │
│ │ [Install]                                                │  │
│ └─────────────────────────────────────────────────────────┘  │
│                                                               │
│ ┌─────────────────────────────────────────────────────────┐  │
│ │ medical-uk                              (156)       │  │
│ │ NHS guidelines, medical research, clinical workflows     │  │
│ │ v2.0.1 · By HealthTech UK · Installed 892 times          │  │
│ │                                                          │  │
│ │ [Install]                                                │  │
│ └─────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

## What makes a pack "vertical"
Each pack includes:
1. **Prompts**; Domain-specific AI instructions (how to value a property, how to check HMO compliance)
2. **Tools**; Domain-specific tool implementations (Rightmove scraper, case law search)
3. **Models**; Fine-tuned model configurations (property valuation model, medical terminology model)
4. **Data**; Static reference data (UK property law, HMO regulations by postcode, NHS guidelines)

A pack is "vertical" because it makes Carina an expert in that domain without any code changes to Carina Core. Install the medical-uk pack, and Carina understands NHS workflows. Install legal-uk, and Carina can search case law.

## property-uk pack contents (reference implementation)
```
property-uk/
  SKILL.md; Pack manifest
  prompts/
    property-valuation.md; AI prompt for valuing properties
    hmo-compliance.md; AI prompt for HMO regulation checks
    deal-analysis.md; AI prompt for deal evaluation
    rent-optimization.md; AI prompt for rent analysis
    portfolio-summary.md; AI prompt for portfolio reporting
  tools/
    rightmove-scraper.ts; Scrape Rightmove listings
    hmo-compliance.ts; Check HMO compliance by postcode
    deal-calculator.ts; BTL/BRR/HMO/SA deal calculator
    mortgage-comparison.ts; Compare mortgage products
  models/
    property-faq.json; Fine-tuned model for property FAQs
  data/
    uk-property-law.json; Key property legislation
    portsmouth-hmo-regs.json; Portsmouth-specific HMO rules
    tax-rates.json; Current SDLT, income tax, CGT rates
```

## Verification
```bash
# 1. Browse marketplace
open https://console.carinaai.uk/packs
# Expected: property-uk shown as installed, 5+ other packs available

# 2. Install a pack
# Click "Install" on legal-uk
# Expected: progress bar, completion message, appears in Installed tab

# 3. Use installed pack
carina chat
> Search UK case law for HMO licensing appeals in 2025
# Expected: Carina uses legal-uk tools to search case law

# 4. Update pack
# property-uk has update available (v2.1.0 → v2.2.0)
# Click "Update"
# Expected: downloads update, keeps configuration

# 5. Uninstall
# Click "Uninstall" on legal-uk
# Expected: pack removed, tools no longer available
```
