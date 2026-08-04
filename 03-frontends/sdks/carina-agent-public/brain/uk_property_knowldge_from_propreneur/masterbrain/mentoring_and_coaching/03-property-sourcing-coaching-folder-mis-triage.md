# Property sourcing coaching folder - MIS triage (neutral)

**Purpose:** Map a typical **tenant-owned coaching resources** folder (property sourcing programme materials) to **build vs template vs knowledge / RAG**, without naming individuals or external training brands.

**Scope:** Internal operations and implementers. This file lives under `archives/doc/` (not deployed with the app unless you explicitly index it for RAG).

---

## Use of materials

- **Permission:** Programme materials may be adapted for product design, Help, Academy, and RAG **subject to your licence**. This note does not replace legal review.
- **No public deployment of raw tenant files:** Keep original `.docx`, `.xlsx`, and `.pdf` files in **tenant or private storage only**. Do not publish those paths on a public website or ship them as static assets in a production build. For RAG, prefer **neutral markdown summaries** authored or exported into `archives/doc/` (or another private corpus), then run `php artisan ai:index-rag --source=documentations` from `api/`.
- **Neutral naming:** User-facing copy, templates, and indexed text must use **generic** labels (e.g. “property sourcing business”, “client identity verification provider”, “bookkeeping software”). Do not embed legacy network or third-party training brand names in the MIS UI, config labels, or committed product docs.

---

## Typical folder contents (illustrative)

| Asset type | Examples | MIS direction |
|------------|----------|----------------|
| **Getting started / compliance checklist** | One-page checklist (company, bank, insurance, ICO, redress, VAT, AML, accounts, domain, website, CRM, social, networking) | **Digitised:** **Operations → Business setup & compliance check** (`/admin/sourcing-setup`) - per-tenant status and notes. |
| **Course manual (modules 1-7)** | Long-form DOCX/PDF: overview, legalities, marketing, investor list, deal finding, property assessment, selling deals | **Knowledge / RAG:** chunk into neutral markdown for Carina; optional **Academy** courses. Not fully re-keyed as forms. |
| **Viewing guide** | PDF/DOCX with photos: roof, gutters, structure, damp, doors, gardens, invasive species risks, etc. | **Knowledge / RAG** + optional **Help** article; optional future **deal viewing checklist** flags in-app. |
| **DD pack template** | Address, comparables, agents, refurb, ROI upload, media | **Digitised:** **Deal** data + **Export DD pack**; **Compliance → Property deal - due diligence** intake (`property_deal_dd_pack`). **Template:** master DOCX in **Documents → Templates** if still needed. |
| **ROI / strategy spreadsheets** | BTL, BRR, HMO, R2R, SA scenarios; “make a copy” style | **Build:** align with **Calculators** (deal-linked, auditable). Keep spreadsheet as **template** until parity. |
| **Cashflow forecast** | 12-month income/expense grid | **Template** in vault, or later **finance** forecasting if prioritised. |
| **Sales / activity dashboard** | Weekly counts: agent calls, viewings, offers, investor calls, deals sold, cash | **Digitised:** **Activity Tracker** + CRM/deal metrics; spreadsheet as optional **template**. |
| **Customer journey diagram** | Single-page flow (setup → DD → offer → investors → payment → handover) | **Template** PDF after neutral artwork; **Help** diagram; no heavy custom code. |
| **Graphic briefs / internal admin lists** | “Convert manual to PDF”, logo-removal lists | **Operations only** - not product features. |

---

## Related MIS features

- **Templates vs knowledge:** `guides/DOCUMENTS_TEMPLATES_AND_KNOWLEDGE_BASE.md`
- **DD pack mapping:** `guides/dd-pack-example-folder-mis-mapping.md`
- **Compliance Word packs:** `modules/compliance-template-pack-mis-mapping.md`
- **Sourcing T&C / letters inventory:** `business/xelox-coaching-resources-sourcing-templates-inventory.md` (folder paths; upload targets only)

---

*Governance note for builders: keep tenant filesystem paths out of user-facing strings; use this doc for internal alignment only.*
