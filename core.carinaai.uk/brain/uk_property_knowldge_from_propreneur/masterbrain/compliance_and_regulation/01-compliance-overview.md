# Compliance Tracking

## Overview
The Compliance module tracks regulatory certificates, licences, insurance policies, and other compliance items linked to properties. It provides expiry alerts, status tracking, and document management to ensure landlords never miss critical renewal dates.

**Routes:** `tenant.compliance.*`  
**Controller:** `App\Http\Controllers\Tenant\ComplianceController`  
**Model:** `App\Models\Tenant\ComplianceItem`  

## Routes

| Method | URI | Name |
|--------|-----|------|
| GET | `/compliance` | `tenant.compliance.index` |
| GET | `/compliance/create` | `tenant.compliance.create` |
| POST | `/compliance` | `tenant.compliance.store` |
| GET | `/compliance/{item}` | `tenant.compliance.show` |
| GET | `/compliance/{item}/edit` | `tenant.compliance.edit` |
| PUT | `/compliance/{item}` | `tenant.compliance.update` |
| DELETE | `/compliance/{item}` | `tenant.compliance.destroy` |

## Model: `ComplianceItem`

**Table:** `compliance_items` (tenant-scoped)

**Fillable columns:**

| Column | Type | Description |
|--------|------|-------------|
| `property_id` | UUID (FK → properties) | Linked property (nullable) |
| `title` | string | e.g., "Gas Safety Certificate" |
| `category` | string | gas_safety, electrical, epc, fire_safety, hmo_licence, insurance, mortgage, legal, planning, other |
| `status` | string | active, expiring_soon, expired, pending, not_required |
| `issued_at` | date | Date certificate/licence issued |
| `expires_at` | date | Expiry/renewal date |
| `reminder_days` | integer | Days before expiry to trigger alert (default: 30) |
| `notes` | text | Additional notes |
| `file_path` | string | Path to uploaded document |
| `created_by` | UUID (FK → users) | User who created the record |

**Relationships:**

```php
public function property()  // belongsTo(Property::class, 'property_id')
public function creator()   // belongsTo(User::class, 'created_by')
```

**Casts:**
```php
protected $casts = [
    'issued_at'  => 'date',
    'expires_at' => 'date',
];
```

## Controller: `ComplianceController`

**Index:** Lists all compliance items with filters:
- Category (gas_safety, electrical, etc.)
- Status (active, expiring_soon, expired)
- Property (dropdown)
- Search (title, notes)
Defaults to showing items sorted by `expires_at` ascending (soonest expiry first).

**Status auto-calculation:**

```php
public function computeStatus(): string
{
    if ($this->expires_at === null) return 'active';
    
    $daysUntilExpiry = now()->diffInDays($this->expires_at, false);
    
    if ($daysUntilExpiry < 0) return 'expired';
    if ($daysUntilExpiry <= $this->reminder_days) return 'expiring_soon';
    
    return 'active';
}
```

**Store/Update validation:**
```php
[
    'property_id'   => 'nullable|exists:properties,id',
    'title'         => 'required|string|max:255',
    'category'      => 'required|string',
    'issued_at'     => 'nullable|date',
    'expires_at'    => 'nullable|date|after_or_equal:issued_at',
    'reminder_days' => 'nullable|integer|min:1|max:365',
    'notes'         => 'nullable|string',
]
```

## UK Compliance Categories

| Category | Typical Documents | Legal Requirement |
|----------|------------------|-------------------|
| `gas_safety` | Gas Safety Certificate (CP12) | Annual - mandatory for rented properties with gas |
| `electrical` | EICR (Electrical Installation Condition Report) | Every 5 years (mandatory from 2020) |
| `epc` | Energy Performance Certificate | Valid 10 years, minimum E rating for rentals |
| `fire_safety` | Fire Risk Assessment | Required for HMOs (annual review) |
| `hmo_licence` | HMO Licence | Varies by council (5 years typical) |
| `insurance` | Landlord Building/Contents Insurance | Annual renewal |
| `mortgage` | Mortgage Statement / Consent to Let | Varies by lender |
| `legal` | Tenancy Agreement, Right to Rent, EPC, etc. | Ongoing |
| `planning` | Planning Permission / Building Regs | Property-specific |
| `other` | Anything else | - |

## Views

- `resources/views/tenant/compliance/index.blade.php` - filtered table with status badges
- `resources/views/tenant/compliance/create.blade.php` - create form
- `resources/views/tenant/compliance/show.blade.php` - detail view
- `resources/views/tenant/compliance/edit.blade.php` - edit form

## Dashboard Integration

The dashboard shows a compliance alert count. Alerts are triggered when:
- `expires_at` is within the next `reminder_days` (default 30 days)
- `status` is `expired`

The count is clickable and links to `tenant.compliance.index` with the status filter pre-applied.

## Important Implementation Details

1. **Column naming:** The model uses `issued_at` / `expires_at` (not `issue_date` / `expiry_date`). Tenant create, edit, and show Blade forms use those names. **`ComplianceItem` show** lists recent **`PropertyDocument`** rows for the linked property with download links (`tenant.properties.documents.download`); the property link and vault shortcut use fragment **`#vault-documents`** on **`tenant.properties.show`**. Canonical write-up: **`40-tenant-compliance-vault-documents-ui.md`**.
2. **Property display:** Uses `$item->property->address_line1` (not `address_line_1`).
3. **Status:** Stored as computed string in the DB (`computed_status` was replaced with `status`).
4. **Soft deletes:** Compliance items use `SoftDeletes`.

## Related

- Properties: `tenant.properties.show` shows compliance items linked to that property
- Dashboard: alert count shown in Command Centre
- Notifications: can be extended to send reminders via email/in-app