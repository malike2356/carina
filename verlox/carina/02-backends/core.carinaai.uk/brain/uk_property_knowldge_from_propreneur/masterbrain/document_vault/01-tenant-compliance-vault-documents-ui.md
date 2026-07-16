# Tenant compliance show and property document vault (UI bridge)

**Last updated:** 2026-05-15  
**Status:** Shipped; extended with workspace **`Document`** vault links (see **`07-compliance.md`**)  
**Scope:** Module 6 (Compliance) UI bridge to property **`PropertyDocument`** vault and workspace **`documents`** rows linked via **`compliance_item_id`**

---

## Purpose

When a **compliance item** is linked to a **property**, operators should see recent **property documents** next to the certificate context and jump to the property **vault** panel without hunting through menus. **Workspace** files live in **`documents`** (tenant Document Vault): **`ComplianceController::show`** also passes **`vaultDocuments`** (latest version head per chain where **`compliance_item_id`** matches). Upload from compliance pre-fills **`compliance_item_id`** on **`tenant.documents.create`**.

---

## Controller behaviour

**`App\Http\Controllers\Tenant\ComplianceController::show`**

- Eager-loads **`property`** on the item.
- If **`property_id`** is set, loads up to **20** newest **`PropertyDocument`** rows for that property (ordered by **`id` descending**).
- Passes **`propertyDocuments`** into **`tenant.compliance.show`**.
- Passes **`vaultDocuments`** from **`DocumentVaultService::latestHeadsForComplianceItem`** (workspace vault heads linked to this compliance row).

If there is no linked property, **`propertyDocuments`** is an empty collection.

---

## Views

| View | Role |
|------|------|
| **`resources/views/tenant/compliance/show.blade.php`** | Renders **`issued_at`** / **`expires_at`**, **Workspace vault (this item)** when **`vaultDocuments`** is non-empty (links to **`tenant.documents.*`**), **Property file vault** block for **`PropertyDocument`** rows, download route **`tenant.properties.documents.download`**, and links to **`tenant.properties.show`** with fragment **`#vault-documents`**. |
| **`resources/views/tenant/properties/show.blade.php`** | Document list lives in a panel with **`id="vault-documents"`** so compliance deep links scroll correctly. |

Create and edit compliance forms use **`issued_at`** / **`expires_at`** and the shared **`$categories`** / **`$types`** arrays from the controller (see **`07-compliance.md`**).

---

## Tests

**`tests/Feature/Tenant/ComplianceShowDocumentsTest.php`** (Blade-only)

- Renders compliance show with **`issued_at`**, property document names, **`#vault-documents`**, and **Download** (view-only, no HTTP app bootstrap for tenancy).
- Renders the property show vault block with the same fragment id pattern.

**`tests/Feature/Documents/DocumentVaultVersioningTest.php`** (HTTP + tenant)

- Workspace document second upload via **`previous_document_id`** and **`/documents/{id}/versions`** listing.
- **`compliance_item_id`** persisted on **`POST /documents`**.

---

## Related

- **`07-compliance.md`** - module routes, model, validation  
- **`03-properties.md`** - property hub and document download routes  
- **`31-vcal-booking-module.md`** - separate booking surface (not vault)
