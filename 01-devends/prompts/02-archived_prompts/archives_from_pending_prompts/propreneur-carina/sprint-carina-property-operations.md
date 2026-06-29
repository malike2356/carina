# Sprint: Carina Natural Language Property Operations

> Shared preflight: read `README.md` in this folder before implementing. Target `/opt/lampp/htdocs/verlox/propreneur/propreneur-v2`. Verify existing Laravel models, migrations, dispatcher, prompt registry, tenant boundaries, and tests before using any code snippet. Treat snippets as implementation sketches, not blind copy/paste.

## What This Builds

Carina handles property operations entirely via conversation. The user can add tenants, update property details, check payment status, query the portfolio, and run reports - all by talking. No dashboard required for day-to-day operations.

This is the prompt that takes Carina from 30% control to 90% control of Propreneur.

## Prerequisites

- Propreneur v2 running at `/opt/lampp/htdocs/verlox/propreneur/propreneur-v2`
- `sprint-carina-document-upload.md` must be complete
- `sprint-carina-tenant-communication.md` must be complete
- `Property`, `Tenant`, `Payment` (or `RentPayment`), and `Note` models exist (verify; create migrations if missing)

## Architecture

This sprint creates the largest tool handler in Propreneur - six tools covering the full property management surface:

```
User: "Add a new tenant to flat 3"
 -> Carina calls manage_property with action="add_tenant"
 -> Tenant record created, linked to property

User: "Has flat 4 paid rent this month?"
 -> Carina calls query_payments
 -> Returns payment status for that property

User: "What's my total monthly rent roll?"
 -> Carina calls portfolio_summary
 -> Returns totals across all properties

User: "Mark rent as paid for 106 Chichester, 950 pounds"
 -> Carina calls record_payment
 -> Payment recorded, tenant balance updated

User: "Add a note to flat 2: boiler serviced today"
 -> Carina calls manage_property with action="add_note"
 -> Note attached to property
```

## Part 1: Database Migrations (if not already existing)

### 1.1 Tenant Migration

If `tenants` table does not exist:

```php
Schema::create('tenants', function (Blueprint $table) {
    $table->id();
    $table->foreignId('property_id')->constrained()->cascadeOnDelete();
    $table->string('name');
    $table->string('email')->nullable();
    $table->string('phone')->nullable();
    $table->decimal('monthly_rent', 10, 2)->nullable();
    $table->date('tenancy_start')->nullable();
    $table->date('tenancy_end')->nullable();
    $table->boolean('is_active')->default(true);
    $table->timestamps();
});
```

### 1.2 Payments Migration

If `rent_payments` table does not exist:

```php
Schema::create('rent_payments', function (Blueprint $table) {
    $table->id();
    $table->foreignId('property_id')->constrained()->cascadeOnDelete();
    $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
    $table->decimal('amount', 10, 2);
    $table->date('payment_date');
    $table->string('payment_month'); // YYYY-MM format
    $table->string('method')->default('bank_transfer');
    $table->string('status')->default('paid'); // paid, pending, overdue
    $table->text('notes')->nullable();
    $table->foreignId('recorded_by_user_id')->nullable()->constrained('users')->nullOnDelete();
    $table->timestamps();
});
```

### 1.3 Notes Migration

If `property_notes` table does not exist:

```php
Schema::create('property_notes', function (Blueprint $table) {
    $table->id();
    $table->foreignId('property_id')->constrained()->cascadeOnDelete();
    $table->text('content');
    $table->string('category')->default('general'); // general, maintenance, inspection, tenant
    $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
    $table->timestamps();
});
```

## Part 2: Models (create if missing)

### 2.1 Tenant Model

```php
// app/Models/Tenant/Tenant.php
// BelongsTo Property
// HasMany RentPayment
// Fillable: name, email, phone, monthly_rent, tenancy_start, tenancy_end, is_active
// Casts: tenancy_start => date, tenancy_end => date, is_active => boolean
```

### 2.2 RentPayment Model

```php
// app/Models/Tenant/RentPayment.php
// BelongsTo Property, Tenant, User (recordedBy)
// Fillable: property_id, tenant_id, amount, payment_date, payment_month, method, status, notes, recorded_by_user_id
// Casts: payment_date => date, amount => decimal:2
```

### 2.3 PropertyNote Model

```php
// app/Models/Tenant/PropertyNote.php
// BelongsTo Property, User (createdBy)
// Fillable: property_id, content, category, created_by_user_id
```

## Part 3: Tool Handler

Create `app/Services/Carina/ToolHandlers/PropertyOpsHandler.php`:

```php
<?php

declare(strict_types=1);

namespace App\Services\Carina\ToolHandlers;

use App\Models\Tenant\Property;
use App\Models\Tenant\PropertyNote;
use App\Models\Tenant\RentPayment;
use App\Models\Tenant\Tenant;
use App\Models\Tenant\User;
use App\Services\Carina\CarinaConversation;
use App\Services\Carina\ToolResult;
use Carbon\Carbon;

final class PropertyOpsHandler extends AbstractModuleToolHandler
{
  protected array $tools = [
    'manage_property',
    'query_payments',
    'record_payment',
    'portfolio_summary',
    'property_detail',
  ];

  public function __construct() {}

  public function handle(string $name, array $args, ?User $user, CarinaConversation $conversation): ToolResult
  {
    try {
      return match ($name) {
        'manage_property' => $this->manageProperty($args, $user),
        'query_payments' => $this->queryPayments($args, $user),
        'record_payment' => $this->recordPayment($args, $user),
        'portfolio_summary' => $this->portfolioSummary($user),
        'property_detail' => $this->propertyDetail($args, $user),
        default => $this->fail('Unsupported tool.'),
      };
    } catch (\Throwable $e) {
      return $this->fail($e->getMessage(), 'execution_error');
    }
  }

  /**
  * Manage property CRUD operations via conversation.
  * Actions: add_tenant, update_tenant, add_note, update_property
  */
  private function manageProperty(array $args, ?User $user): ToolResult
  {
    $action = $args['action'] ?? null;
    $propertyRef = $args['property_reference'] ?? null;

    if (!$action) {
      return $this->fail('Action is required. Valid actions: add_tenant, update_tenant, add_note, update_property.');
    }

    return match ($action) {
      'add_tenant' => $this->addTenant($args, $user),
      'update_tenant' => $this->updateTenant($args, $user),
      'add_note' => $this->addNote($args, $user),
      'update_property' => $this->updateProperty($args, $user),
      default => $this->fail("Unknown action '{$action}'. Valid: add_tenant, update_tenant, add_note, update_property."),
    };
  }

  /**
  * Add a tenant to a property.
  */
  private function addTenant(array $args, ?User $user): ToolResult
  {
    $propertyRef = $args['property_reference'] ?? null;
    $name = $args['name'] ?? null;
    $email = $args['email'] ?? null;
    $phone = $args['phone'] ?? null;
    $monthlyRent = $args['monthly_rent'] ?? null;
    $tenancyStart = $args['tenancy_start'] ?? null;

    if (!$propertyRef || !$name) {
      return $this->fail('Property reference and tenant name are required.');
    }

    $property = $this->resolveProperty($propertyRef);
    if (!$property) {
      return $this->fail("Could not find property matching '{$propertyRef}'.");
    }

    $tenant = Tenant::create([
        'property_id' => $property->id,
        'name' => $name,
        'email' => $email,
        'phone' => $phone,
        'monthly_rent' => $monthlyRent,
        'tenancy_start' => $tenancyStart ? Carbon::parse($tenancyStart) : null,
        'is_active' => true,
    ]);

    return $this->success([
        'tenant_id' => $tenant->id,
        'name' => $tenant->name,
        'property' => $property->address_line_1,
        'monthly_rent' => $tenant->monthly_rent,
        'message' => "Tenant '{$tenant->name}' added to {$property->address_line_1}.",
    ]);
  }

  /**
  * Update tenant details.
  */
  private function updateTenant(array $args, ?User $user): ToolResult
  {
    $tenantId = $args['tenant_id'] ?? null;
    $propertyRef = $args['property_reference'] ?? null;

    $tenant = null;
    if ($tenantId) {
      $tenant = Tenant::find($tenantId);
    } elseif ($propertyRef) {
      $property = $this->resolveProperty($propertyRef);
      if ($property) {
        $tenant = $property->tenants()->where('is_active', true)->first();
      }
    }

    if (!$tenant) {
      return $this->fail('Tenant not found. Provide a tenant_id or property_reference with an active tenant.');
    }

    $updates = array_filter([
        'name' => $args['name'] ?? null,
        'email' => $args['email'] ?? null,
        'phone' => $args['phone'] ?? null,
        'monthly_rent' => $args['monthly_rent'] ?? null,
        'tenancy_end' => $args['tenancy_end'] ?? null,
        'is_active' => $args['is_active'] ?? null,
      ], fn($v) => $v !== null);

    if (empty($updates)) {
      return $this->fail('No fields to update. Provide at least one: name, email, phone, monthly_rent, tenancy_end, is_active.');
    }

    $tenant->update($updates);

    return $this->success([
        'tenant_id' => $tenant->id,
        'name' => $tenant->name,
        'updated_fields' => array_keys($updates),
        'message' => "Tenant '{$tenant->name}' updated.",
    ]);
  }

  /**
  * Add a note to a property.
  */
  private function addNote(array $args, ?User $user): ToolResult
  {
    $propertyRef = $args['property_reference'] ?? null;
    $content = $args['content'] ?? null;
    $category = $args['category'] ?? 'general';

    if (!$propertyRef || !$content) {
      return $this->fail('Property reference and note content are required.');
    }

    $property = $this->resolveProperty($propertyRef);
    if (!$property) {
      return $this->fail("Could not find property matching '{$propertyRef}'.");
    }

    $note = PropertyNote::create([
        'property_id' => $property->id,
        'content' => $content,
        'category' => $category,
        'created_by_user_id' => $user?->id,
    ]);

    return $this->success([
        'note_id' => $note->id,
        'property' => $property->address_line_1,
        'category' => $category,
        'message' => "Note added to {$property->address_line_1}.",
    ]);
  }

  /**
  * Update property details.
  */
  private function updateProperty(array $args, ?User $user): ToolResult
  {
    $propertyRef = $args['property_reference'] ?? null;
    if (!$propertyRef) {
      return $this->fail('Property reference is required.');
    }

    $property = $this->resolveProperty($propertyRef);
    if (!$property) {
      return $this->fail("Could not find property matching '{$propertyRef}'.");
    }

    $updatableFields = ['address_line_1', 'address_line_2', 'city', 'postcode', 'property_type', 'bedrooms', 'purchase_price', 'current_value', 'mortgage_lender', 'mortgage_amount', 'interest_rate', 'monthly_payment', 'landlord_name'];
    $updates = [];

    foreach ($updatableFields as $field) {
      if (isset($args[$field])) {
        $updates[$field] = $args[$field];
      }
    }

    if (empty($updates)) {
      return $this->fail('No valid fields to update.');
    }

    $property->update($updates);

    return $this->success([
        'property_id' => $property->id,
        'address' => $property->address_line_1,
        'updated_fields' => array_keys($updates),
        'message' => "Property '{$property->address_line_1}' updated.",
    ]);
  }

  /**
  * Query payment status for a property or the entire portfolio.
  */
  private function queryPayments(array $args, ?User $user): ToolResult
  {
    $propertyRef = $args['property_reference'] ?? null;
    $month = $args['month'] ?? now()->format('Y-m');
    $status = $args['status'] ?? null;

    $query = RentPayment::query()->where('payment_month', $month);

    if ($propertyRef) {
      $property = $this->resolveProperty($propertyRef);
      if (!$property) {
        return $this->fail("Could not find property matching '{$propertyRef}'.");
      }
      $query->where('property_id', $property->id);
    }

    if ($status) {
      $query->where('status', $status);
    }

    $payments = $query->with(['property', 'tenant'])->get();

    if ($payments->isEmpty()) {
      return $this->success([
          'month' => $month,
          'payment_count' => 0,
          'message' => "No payments found for {$month}.",
      ]);
    }

    $totalPaid = $payments->where('status', 'paid')->sum('amount');
    $totalPending = $payments->where('status', 'pending')->sum('amount');
    $totalOverdue = $payments->where('status', 'overdue')->sum('amount');

    $items = $payments->map(fn($p) => [
        'id' => $p->id,
        'property' => $p->property?->address_line_1 ?? 'Unknown',
        'tenant' => $p->tenant?->name ?? 'Unknown',
        'amount' => $p->amount,
        'status' => $p->status,
        'date' => $p->payment_date?->toDateString(),
        'method' => $p->method,
    ]);

    return $this->success([
        'month' => $month,
        'payment_count' => $payments->count(),
        'total_paid' => $totalPaid,
        'total_pending' => $totalPending,
        'total_overdue' => $totalOverdue,
        'payments' => $items->toArray(),
    ]);
  }

  /**
  * Record a rent payment.
  */
  private function recordPayment(array $args, ?User $user): ToolResult
  {
    $propertyRef = $args['property_reference'] ?? null;
    $amount = $args['amount'] ?? null;
    $month = $args['month'] ?? now()->format('Y-m');
    $method = $args['method'] ?? 'bank_transfer';
    $date = $args['payment_date'] ?? now()->toDateString();

    if (!$propertyRef || !$amount) {
      return $this->fail('Property reference and amount are required.');
    }

    $property = $this->resolveProperty($propertyRef);
    if (!$property) {
      return $this->fail("Could not find property matching '{$propertyRef}'.");
    }

    $tenant = $property->tenants()->where('is_active', true)->first();
    if (!$tenant) {
      return $this->fail("No active tenant for {$property->address_line_1}. Add a tenant first.");
    }

    // Check for duplicate (same month, same property)
    $existing = RentPayment::where('property_id', $property->id)
    ->where('payment_month', $month)
    ->where('status', 'paid')
    ->first();

    if ($existing) {
      return $this->success([
          'warning' => "Rent for {$month} at {$property->address_line_1} was already marked as paid.",
          'existing_payment_id' => $existing->id,
          'amount' => $existing->amount,
      ]);
    }

    $payment = RentPayment::create([
        'property_id' => $property->id,
        'tenant_id' => $tenant->id,
        'amount' => $amount,
        'payment_date' => Carbon::parse($date),
        'payment_month' => $month,
        'method' => $method,
        'status' => 'paid',
        'recorded_by_user_id' => $user?->id,
    ]);

    return $this->success([
        'payment_id' => $payment->id,
        'property' => $property->address_line_1,
        'tenant' => $tenant->name,
        'amount' => $payment->amount,
        'month' => $month,
        'message' => "Rent payment of £{$payment->amount} recorded for {$property->address_line_1} ({$month}).",
    ]);
  }

  /**
  * Portfolio summary - totals across all properties.
  */
  private function portfolioSummary(?User $user): ToolResult
  {
    $properties = Property::count();
    $activeTenants = Tenant::where('is_active', true)->count();

    $totalMonthlyRent = Tenant::where('is_active', true)->sum('monthly_rent');
    $totalAnnualRent = $totalMonthlyRent * 12;

    $currentMonth = now()->format('Y-m');
    $thisMonthPaid = RentPayment::where('payment_month', $currentMonth)
    ->where('status', 'paid')
    ->sum('amount');

    $thisMonthPending = Tenant::where('is_active', true)->count()
    - RentPayment::where('payment_month', $currentMonth)
    ->where('status', 'paid')
    ->count();

    // Upcoming compliance expiry
    $expiringSoon = \App\Models\Tenant\ComplianceRecord::where('expiry_date', '<=', now()->addDays(30))
    ->where('expiry_date', '>=', now())
    ->count();

    return $this->success([
        'total_properties' => $properties,
        'active_tenants' => $activeTenants,
        'monthly_rent_roll' => round($totalMonthlyRent, 2),
        'annual_rent_roll' => round($totalAnnualRent, 2),
        'rent_collected_this_month' => round($thisMonthPaid, 2),
        'rent_outstanding_this_month' => max(0, $thisMonthPending),
        'collection_rate' => $totalMonthlyRent > 0
        ? round(($thisMonthPaid / ($totalMonthlyRent ?: 1)) * 100, 1) . '%'
        : 'N/A',
        'compliance_expiring_soon' => $expiringSoon,
        'message' => "Portfolio: {$properties} properties, {$activeTenants} active tenants. Monthly rent roll: £" . number_format($totalMonthlyRent, 2) . ". This month: £" . number_format($thisMonthPaid, 2) . " collected.",
    ]);
  }

  /**
  * Get full detail for a single property.
  */
  private function propertyDetail(array $args, ?User $user): ToolResult
  {
    $propertyRef = $args['property_reference'] ?? null;
    if (!$propertyRef) {
      return $this->fail('Property reference is required.');
    }

    $property = $this->resolveProperty($propertyRef);
    if (!$property) {
      return $this->fail("Could not find property matching '{$propertyRef}'.");
    }

    $tenant = $property->tenants()->where('is_active', true)->first();
    $lastPayment = RentPayment::where('property_id', $property->id)
    ->where('status', 'paid')
    ->latest('payment_date')
    ->first();

    $recentNotes = $property->notes()->latest()->limit(5)->get()->map(fn($n) => [
        'content' => $n->content,
        'category' => $n->category,
        'date' => $n->created_at->toDateString(),
    ]);

    $complianceItems = $property->complianceRecords()
    ->get()
    ->map(fn($c) => [
        'type' => $c->type,
        'status' => $c->status,
        'expires' => $c->expiry_date?->toDateString(),
        'days_remaining' => $c->expiry_date ? (int) now()->diffInDays($c->expiry_date, false) : null,
    ]);

    return $this->success([
        'property' => [
          'id' => $property->id,
          'address' => $property->address_line_1,
          'city' => $property->city,
          'postcode' => $property->postcode,
          'type' => $property->property_type,
          'bedrooms' => $property->bedrooms,
          'purchase_price' => $property->purchase_price,
          'current_value' => $property->current_value,
        ],
        'tenant' => $tenant ? [
          'name' => $tenant->name,
          'email' => $tenant->email,
          'phone' => $tenant->phone,
          'monthly_rent' => $tenant->monthly_rent,
          'tenancy_start' => $tenant->tenancy_start?->toDateString(),
        ] : null,
        'last_payment' => $lastPayment ? [
          'amount' => $lastPayment->amount,
          'date' => $lastPayment->payment_date->toDateString(),
          'month' => $lastPayment->payment_month,
        ] : null,
        'compliance' => $complianceItems->toArray(),
        'recent_notes' => $recentNotes->toArray(),
    ]);
  }

  // -- Helper -----------------------------------------------

  private function resolveProperty(string $ref): ?Property
  {
    if (is_numeric($ref)) {
      return Property::find($ref);
    }
    return Property::where('address_line_1', 'like', "%{$ref}%")
    ->orWhere('postcode', 'like', "%{$ref}%")
    ->first();
  }
}
```

## Part 4: Registration

### 4.1 Register Handler in Dispatcher

In `app/Services/Carina/CarinaModuleToolDispatcher.php`:

Add import:
```php
use App\Services\Carina\ToolHandlers\PropertyOpsHandler;
```

Add to constructor params:
```php
PropertyOpsHandler $propertyOps,
```

Add to handlers array:
```php
$propertyOps,
```

### 4.2 Add Prompt to Library

In `brain/prompts/carina_extended/carina-assistant-prompts.php`:

```php
'property_operations' => <<<'PROMPT'
You are the property operations assistant. You help landlords manage their entire portfolio via conversation - no dashboard required for day-to-day tasks.

AVAILABLE TOOLS:
- manage_property: Add/update tenants, add notes, update property details
- query_payments: Check payment status
- record_payment: Record a rent payment
- portfolio_summary: Overview of entire portfolio
- property_detail: Full detail for one property

-- ADDING A TENANT --
Use manage_property with action="add_tenant":
- property_reference: Address or nickname (REQUIRED)
- name: Tenant full name (REQUIRED)
- email: (optional)
- phone: (optional)
- monthly_rent: Rent amount in pounds (optional)
- tenancy_start: Move-in date, YYYY-MM-DD (optional)

Example:
User: "Add James as a tenant to flat 4, 950 pounds a month starting August 1st"
You call: manage_property(action="add_tenant", property_reference="flat 4", name="James", monthly_rent=950, tenancy_start="2026-08-01")

-- CHECKING PAYMENTS --
Use query_payments:
- property_reference: (optional) Check one property. Omit for all.
- month: YYYY-MM format (default: current month)
- status: (optional) Filter by "paid", "pending", "overdue"

Example:
User: "Has flat 4 paid this month?"
You call: query_payments(property_reference="flat 4", month="2026-07")

-- RECORDING PAYMENT --
Use record_payment:
- property_reference: Address or nickname (REQUIRED)
- amount: Rent amount in pounds (REQUIRED)
- month: YYYY-MM (default: current month)
- method: Payment method (default: bank_transfer)
- payment_date: Date of payment (default: today)

Example:
User: "Mark rent as paid for 106 Chichester, 950 pounds"
You call: record_payment(property_reference="106 Chichester", amount=950)

-- PORTFOLIO OVERVIEW --
Use portfolio_summary (no parameters needed).

Example:
User: "How's my portfolio looking?"
You call: portfolio_summary()
Response includes: total properties, active tenants, monthly rent roll, this month's collection rate, compliance expiring soon.

-- PROPERTY DETAIL --
Use property_detail:
- property_reference: Address or nickname (REQUIRED)

Example:
User: "Tell me everything about flat 4"
You call: property_detail(property_reference="flat 4")

-- ADDING A NOTE --
Use manage_property with action="add_note":
- property_reference: Address (REQUIRED)
- content: Note text (REQUIRED)
- category: general, maintenance, inspection, tenant (default: general)

Example:
User: "Note that the boiler was serviced today at 106 Chichester"
You call: manage_property(action="add_note", property_reference="106 Chichester", content="Boiler serviced", category="maintenance")

-- UPDATING PROPERTY DETAILS --
Use manage_property with action="update_property":
- property_reference: Address (REQUIRED)
- Any fields to update: address_line_1, city, postcode, bedrooms, purchase_price, current_value, interest_rate, monthly_payment, landlord_name

CONVERSATION STYLE:
- Be direct and efficient. Landlords value speed.
- When recording payments, confirm the amount and month.
- When showing portfolio_summary, highlight anything that needs attention (overdue rent, expiring compliance).
- If a property reference is ambiguous, ask: "Did you mean [address A] or [address B]?"
PROMPT,
```

## Part 5: Verification

- [ ] Models exist (Tenant, RentPayment, PropertyNote) or are created
- [ ] Migrations run without errors
- [ ] `php -l` passes on handler and models
- [ ] Handler registered in dispatcher (import + constructor + array)
- [ ] `manage_property` add_tenant creates tenant linked to property
- [ ] `manage_property` add_note attaches note to property
- [ ] `manage_property` update_property modifies property fields
- [ ] `query_payments` returns payments for a property or portfolio
- [ ] `record_payment` creates payment and prevents duplicates
- [ ] `portfolio_summary` returns totals across all properties
- [ ] `property_detail` returns full picture for one property
- [ ] Property resolution works by partial address
- [ ] Duplicate payment detection works (same month, same property)
- [ ] No hardcoded names, times, or values
- [ ] File permissions 644 after deploy

## Files Summary

| File | Action |
|------|--------|
| `database/migrations/tenant/XXXX_tenants.php` | CREATE (if missing) |
| `database/migrations/tenant/XXXX_rent_payments.php` | CREATE (if missing) |
| `database/migrations/tenant/XXXX_property_notes.php` | CREATE (if missing) |
| `app/Models/Tenant/Tenant.php` | CREATE (if missing) |
| `app/Models/Tenant/RentPayment.php` | CREATE (if missing) |
| `app/Models/Tenant/PropertyNote.php` | CREATE (if missing) |
| `app/Services/Carina/ToolHandlers/PropertyOpsHandler.php` | CREATE |
| `app/Services/Carina/CarinaModuleToolDispatcher.php` | MODIFY |
| `brain/prompts/carina_extended/carina-assistant-prompts.php` | MODIFY |

## Build Order Note

Build the foundational property prompts in this order:
1. `sprint-carina-document-upload.md`
2. `sprint-carina-tenant-communication.md`
3. `sprint-carina-property-operations.md` (this prompt, depends on the first two)
