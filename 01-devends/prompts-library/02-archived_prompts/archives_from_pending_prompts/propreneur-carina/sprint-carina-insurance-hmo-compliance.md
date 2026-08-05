# Sprint: Carina Insurance and HMO Compliance

**Status: COMPLETED 2026-07-26**

**What was built:**
- Implemented and archived

> Shared preflight: read `README.md` in this folder before implementing. Target `/opt/lampp/htdocs/verlox/propreneur/propreneur-v2`. Verify existing Laravel models, migrations, dispatcher, prompt registry, tenant boundaries, and tests before using any code snippet. Treat snippets as implementation sketches, not blind copy/paste.

## What This Builds

Carina tracks insurance policies and HMO licensing requirements. Proactive alerts before expiry. Full HMO compliance checklist. Combined because both are recurring compliance obligations.

## Part 1: Database

```php
Schema::create('insurance_policies', function (Blueprint $table) {
    $table->id();
    $table->foreignId('property_id')->constrained()->cascadeOnDelete();
    $table->string('policy_type'); // buildings, contents, landlord, rent_guarantee, public_liability
    $table->string('provider');
    $table->string('policy_number')->nullable();
    $table->decimal('annual_premium', 10, 2)->nullable();
    $table->date('start_date');
    $table->date('expiry_date');
    $table->date('renewal_date')->nullable();
    $table->text('notes')->nullable();
    $table->timestamps();
});

Schema::create('hmo_checks', function (Blueprint $table) {
    $table->id();
    $table->foreignId('property_id')->constrained()->cascadeOnDelete();
    $table->string('license_status')->default('not_required'); // not_required, required_not_applied, application_submitted, licensed, expiring
    $table->string('license_number')->nullable();
    $table->date('license_expiry')->nullable();
    $table->string('local_authority')->nullable();
    $table->integer('tenant_count')->default(0);
    $table->integer('household_count')->default(0);
    $table->integer('storeys')->nullable();
    $table->boolean('fire_doors_fitted')->default(false);
    $table->boolean('emergency_lighting')->default(false);
    $table->boolean('fire_alarm_grade_d')->default(false);
    $table->boolean('room_sizes_compliant')->default(false);
    $table->text('notes')->nullable();
    $table->timestamps();
});
```

## Part 2: Handler

Create `app/Services/Carina/ToolHandlers/ComplianceHandler.php`:

```php
<?php

declare(strict_types=1);

namespace App\Services\Carina\ToolHandlers;

use App\Models\Tenant\InsurancePolicy;
use App\Models\Tenant\HmoCheck;
use App\Models\Tenant\Property;
use App\Models\Tenant\User;
use App\Services\Carina\CarinaConversation;
use App\Services\Carina\ToolResult;

final class ComplianceHandler extends AbstractModuleToolHandler
{
  protected array $tools = [
    'manage_insurance',
    'list_insurance',
    'insurance_expiring',
    'hmo_check',
    'hmo_compliance_status',
  ];

  public function __construct() {}

  public function handle(string $name, array $args, ?User $user, CarinaConversation $conversation): ToolResult
  {
    try {
      return match ($name) {
        'manage_insurance' => $this->manageInsurance($args),
        'list_insurance' => $this->listInsurance($args),
        'insurance_expiring' => $this->expiringInsurance(),
        'hmo_check' => $this->hmoCheck($args),
        'hmo_compliance_status' => $this->hmoStatus($args),
        default => $this->fail('Unsupported tool.'),
      };
    } catch (\Throwable $e) {
      return $this->fail($e->getMessage(), 'execution_error');
    }
  }

  private function manageInsurance(array $args): ToolResult
  {
    $propertyRef = $args['property_reference'] ?? null;
    $policyType = $args['policy_type'] ?? 'buildings';
    $provider = $args['provider'] ?? null;
    $expiryDate = $args['expiry_date'] ?? null;

    $property = Property::where('address_line_1', 'like', "%{$propertyRef}%")->first();
    if (!$property) return $this->fail("Property not found.");

    $policy = InsurancePolicy::updateOrCreate(
      ['property_id' => $property->id, 'policy_type' => $policyType],
      [
        'provider' => $provider,
        'policy_number' => $args['policy_number'] ?? null,
        'annual_premium' => $args['annual_premium'] ?? null,
        'start_date' => $args['start_date'] ?? now(),
        'expiry_date' => $expiryDate,
        'renewal_date' => $args['renewal_date'] ?? ($expiryDate ? date('Y-m-d', strtotime($expiryDate . ' -30 days')) : null),
        'notes' => $args['notes'] ?? null,
      ]
    );

    return $this->success([
        'policy_id' => $policy->id,
        'property' => $property->address_line_1,
        'type' => $policyType,
        'provider' => $provider,
        'expires' => $expiryDate,
        'message' => "{$policyType} insurance for {$property->address_line_1} saved. Expires: {$expiryDate}.",
    ]);
  }

  private function listInsurance(array $args): ToolResult
  {
    $propertyRef = $args['property_reference'] ?? null;
    $query = InsurancePolicy::with('property');
    if ($propertyRef) {
      $prop = Property::where('address_line_1', 'like', "%{$propertyRef}%")->first();
      if ($prop) $query->where('property_id', $prop->id);
    }

    $policies = $query->get()->map(fn($p) => [
        'id' => $p->id,
        'property' => $p->property?->address_line_1,
        'type' => $p->policy_type,
        'provider' => $p->provider,
        'expires' => $p->expiry_date->toDateString(),
        'days_left' => (int) now()->diffInDays($p->expiry_date, false),
        'premium' => $p->annual_premium,
    ]);

    return $this->success(['policies' => $policies->toArray()]);
  }

  private function expiringInsurance(): ToolResult
  {
    $expiring = InsurancePolicy::with('property')
    ->where('expiry_date', '<=', now()->addDays(60))
    ->where('expiry_date', '>=', now())
    ->orderBy('expiry_date')
    ->get();

    $expired = InsurancePolicy::with('property')
    ->where('expiry_date', '<', now())
    ->get();

    return $this->success([
        'expiring_soon' => $expiring->count(),
        'expired' => $expired->count(),
        'urgent' => $expired->map(fn($p) => "{$p->property?->address_line_1}: {$p->policy_type} expired {$p->expiry_date->toDateString()}")->toArray(),
        'message' => "{$expiring->count()} policies expiring within 60 days. {$expired->count()} already expired.",
    ]);
  }

  private function hmoCheck(array $args): ToolResult
  {
    $propertyRef = $args['property_reference'] ?? null;
    $property = Property::where('address_line_1', 'like', "%{$propertyRef}%")->first();
    if (!$property) return $this->fail("Property not found.");

    $tenantCount = (int) ($args['tenant_count'] ?? 0);
    $householdCount = (int) ($args['household_count'] ?? 0);
    $storeys = (int) ($args['storeys'] ?? 0);

    // HMO triggers (England)
    $mandatoryHmo = $tenantCount >= 5 && $householdCount >= 3;
    $additionalLicensing = $tenantCount >= 3 && $householdCount >= 2;

    $check = HmoCheck::updateOrCreate(
      ['property_id' => $property->id],
      [
        'tenant_count' => $tenantCount,
        'household_count' => $householdCount,
        'storeys' => $storeys,
        'local_authority' => $args['local_authority'] ?? null,
        'license_status' => $mandatoryHmo ? 'required_not_applied' : ($additionalLicensing ? 'check_local_authority' : 'not_required'),
      ]
    );

    $requirements = [];
    if ($mandatoryHmo) {
      $requirements = [
        'Mandatory HMO license required (5+ tenants, 3+ households)',
        'Fire doors on all habitable rooms',
        'Grade D fire alarm system (mains-wired, interlinked)',
        'Emergency lighting in escape routes',
        'Minimum room sizes: 6.51m² for 1 person, 10.22m² for 2 people',
        'Adequate kitchen and bathroom facilities',
        'Annual gas safety check',
        'Electrical safety (EICR every 5 years)',
      ];
    }

    return $this->success([
        'property' => $property->address_line_1,
        'tenants' => $tenantCount,
        'households' => $householdCount,
        'storeys' => $storeys,
        'mandatory_hmo' => $mandatoryHmo,
        'additional_licensing' => $additionalLicensing,
        'license_status' => $check->license_status,
        'requirements' => $requirements,
        'message' => $mandatoryHmo
        ? "MANDATORY HMO LICENSE REQUIRED for {$property->address_line_1}. {$tenantCount} tenants from {$householdCount} households."
        : "No mandatory HMO license required. Check local authority for additional licensing schemes.",
    ]);
  }

  private function hmoStatus(array $args): ToolResult
  {
    $checks = HmoCheck::with('property')
    ->whereIn('license_status', ['required_not_applied', 'application_submitted', 'licensed', 'expiring'])
    ->get();

    if ($checks->isEmpty()) {
      return $this->success(['message' => 'No properties flagged for HMO licensing.']);
    }

    $statuses = $checks->map(fn($c) => [
        'property' => $c->property?->address_line_1,
        'status' => $c->license_status,
        'tenants' => $c->tenant_count,
        'households' => $c->household_count,
        'license_expiry' => $c->license_expiry?->toDateString(),
        'compliance' => [
          'fire_doors' => $c->fire_doors_fitted,
          'emergency_lighting' => $c->emergency_lighting,
          'fire_alarm' => $c->fire_alarm_grade_d,
          'room_sizes' => $c->room_sizes_compliant,
        ],
    ]);

    $notApplied = $checks->where('license_status', 'required_not_applied')->count();

    return $this->success([
        'properties_affected' => $checks->count(),
        'not_yet_applied' => $notApplied,
        'statuses' => $statuses->toArray(),
        'message' => "{$checks->count()} properties flagged. {$notApplied} require immediate license application.",
    ]);
  }
}
```

## Part 3: Registration and Prompt

```php
'compliance_insurance_hmo' => <<<'PROMPT'
You track insurance policies and HMO licensing compliance.

-- INSURANCE --
Use manage_insurance to add/update policies. Types: buildings, contents, landlord, rent_guarantee, public_liability.
Use list_insurance for all policies or filter by property.
Use insurance_expiring for policies expiring within 60 days or already expired.

-- HMO LICENSING --
Use hmo_check when the landlord provides tenant/household counts for a property. This determines if mandatory HMO licensing applies and lists requirements.

HMO TRIGGERS (England):
- 5+ tenants forming 3+ households = MANDATORY HMO license
- 3+ tenants forming 2+ households = Check local authority for additional licensing

Always flag mandatory HMO requirements prominently. HMO fines are unlimited - this is not optional.

Use hmo_compliance_status for a portfolio-wide view of all HMO-affected properties.
PROMPT,
```

## Verification

- [ ] Insurance CRUD: add, list, detect expiring/expired
- [ ] HMO check calculates mandatory vs additional licensing correctly
- [ ] HMO requirements checklist populated for mandatory properties
- [ ] Standard registration
- [ ] No hardcoded values

## Files Summary

| File | Action |
|------|--------|
| `database/migrations/tenant/XXXX_create_insurance_hmo_tables.php` | CREATE |
| `app/Models/Tenant/InsurancePolicy.php` | CREATE |
| `app/Models/Tenant/HmoCheck.php` | CREATE |
| `app/Services/Carina/ToolHandlers/ComplianceHandler.php` | CREATE |
| `app/Services/Carina/CarinaModuleToolDispatcher.php` | MODIFY |
| `brain/prompts/carina_extended/carina-assistant-prompts.php` | MODIFY |
