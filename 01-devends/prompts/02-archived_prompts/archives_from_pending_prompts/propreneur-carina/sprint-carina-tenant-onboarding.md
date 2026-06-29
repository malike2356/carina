# Sprint: Carina Tenant Onboarding

> Shared preflight: read `README.md` in this folder before implementing. Target `/opt/lampp/htdocs/verlox/propreneur/propreneur-v2`. Verify existing Laravel models, migrations, dispatcher, prompt registry, tenant boundaries, and tests before using any code snippet. Treat snippets as implementation sketches, not blind copy/paste.

## What This Builds

Full move-in workflow via chat. Carina handles referencing, right-to-rent checks, deposit tracking, and tenancy agreement generation. One conversation to onboard a tenant completely.

## Part 1: Database

```php
Schema::create('tenant_applications', function (Blueprint $table) {
    $table->id();
    $table->foreignId('property_id')->constrained()->cascadeOnDelete();
    $table->string('applicant_name');
    $table->string('applicant_email')->nullable();
    $table->string('applicant_phone')->nullable();
    $table->decimal('proposed_rent', 10, 2);
    $table->date('proposed_start_date')->nullable();
    $table->string('status')->default('enquiry'); // enquiry, referencing, right_to_rent, deposit_pending, ready, approved, rejected
    $table->boolean('referencing_passed')->nullable();
    $table->boolean('right_to_rent_verified')->nullable();
    $table->decimal('deposit_amount', 10, 2)->nullable();
    $table->boolean('deposit_received')->default(false);
    $table->date('move_in_date')->nullable();
    $table->text('notes')->nullable();
    $table->foreignId('processed_by_user_id')->nullable()->constrained('users')->nullOnDelete();
    $table->timestamps();
});
```

## Part 2: Handler

Create `app/Services/Carina/ToolHandlers/TenantOnboardingHandler.php`:

```php
<?php

declare(strict_types=1);

namespace App\Services\Carina\ToolHandlers;

use App\Models\Tenant\Property;
use App\Models\Tenant\Tenant;
use App\Models\Tenant\TenantApplication;
use App\Models\Tenant\User;
use App\Services\Carina\CarinaConversation;
use App\Services\Carina\ToolResult;

final class TenantOnboardingHandler extends AbstractModuleToolHandler
{
  protected array $tools = [
    'start_tenant_application',
    'update_application_status',
    'list_applications',
    'complete_onboarding',
  ];

  public function __construct() {}

  public function handle(string $name, array $args, ?User $user, CarinaConversation $conversation): ToolResult
  {
    try {
      return match ($name) {
        'start_tenant_application' => $this->startApplication($args, $user),
        'update_application_status' => $this->updateStatus($args),
        'list_applications' => $this->listApplications($args),
        'complete_onboarding' => $this->completeOnboarding($args, $user),
        default => $this->fail('Unsupported tool.'),
      };
    } catch (\Throwable $e) {
      return $this->fail($e->getMessage(), 'execution_error');
    }
  }

  private function startApplication(array $args, ?User $user): ToolResult
  {
    $propertyRef = $args['property_reference'] ?? null;
    $name = $args['applicant_name'] ?? null;
    $rent = (float) ($args['proposed_rent'] ?? 0);
    $startDate = $args['proposed_start_date'] ?? null;

    if (!$propertyRef || !$name) return $this->fail('Property reference and applicant name required.');

    $property = Property::where('address_line_1', 'like', "%{$propertyRef}%")->first();
    if (!$property) return $this->fail("Property '{$propertyRef}' not found.");

    $app = TenantApplication::create([
        'property_id' => $property->id,
        'applicant_name' => $name,
        'applicant_email' => $args['applicant_email'] ?? null,
        'applicant_phone' => $args['applicant_phone'] ?? null,
        'proposed_rent' => $rent,
        'proposed_start_date' => $startDate,
        'status' => 'enquiry',
        'processed_by_user_id' => $user?->id,
    ]);

    return $this->success([
        'application_id' => $app->id,
        'property' => $property->address_line_1,
        'applicant' => $name,
        'message' => "Application #{$app->id} started for {$name} at {$property->address_line_1}.",
        'next_steps' => [
          'reference' => "Run referencing checks - say 'update application {$app->id} to referencing'",
          'right_to_rent' => "Verify right to rent after referencing passes",
          'deposit' => "Collect deposit of 5 weeks rent (approx £" . round($rent * 5 / 4.33, 2) . ")",
        ],
    ]);
  }

  private function updateStatus(array $args): ToolResult
  {
    $appId = $args['application_id'] ?? null;
    $status = $args['status'] ?? null;
    if (!$appId || !$status) return $this->fail('Application ID and status required.');

    $app = TenantApplication::find($appId);
    if (!$app) return $this->fail("Application #{$appId} not found.");

    $updates = ['status' => $status];

    if (isset($args['referencing_passed'])) $updates['referencing_passed'] = (bool) $args['referencing_passed'];
    if (isset($args['right_to_rent_verified'])) $updates['right_to_rent_verified'] = (bool) $args['right_to_rent_verified'];
    if (isset($args['deposit_received'])) $updates['deposit_received'] = (bool) $args['deposit_received'];
    if (isset($args['deposit_amount'])) $updates['deposit_amount'] = (float) $args['deposit_amount'];
    if (isset($args['move_in_date'])) $updates['move_in_date'] = $args['move_in_date'];

    $app->update($updates);

    // Progress summary
    $checks = [];
    if ($app->referencing_passed) $checks[] = 'Referencing: passed';
    elseif ($status === 'referencing') $checks[] = 'Referencing: in progress';
    else $checks[] = 'Referencing: not started';

    if ($app->right_to_rent_verified) $checks[] = 'Right to rent: verified';
    else $checks[] = 'Right to rent: not verified';

    if ($app->deposit_received) $checks[] = 'Deposit: received (£' . number_format($app->deposit_amount ?? 0, 2) . ')';
    else $checks[] = 'Deposit: not received';

    return $this->success([
        'application_id' => $app->id,
        'status' => $status,
        'progress' => $checks,
        'ready_to_move_in' => $app->referencing_passed && $app->right_to_rent_verified && $app->deposit_received,
        'message' => "Application #{$appId} updated to {$status}. " . implode('. ', $checks) . '.',
    ]);
  }

  private function listApplications(array $args): ToolResult
  {
    $status = $args['status'] ?? null;
    $query = TenantApplication::with('property')->latest();
    if ($status) $query->where('status', $status);

    $apps = $query->limit(20)->get()->map(fn($a) => [
        'id' => $a->id,
        'property' => $a->property?->address_line_1,
        'applicant' => $a->applicant_name,
        'status' => $a->status,
        'rent' => $a->proposed_rent,
        'checks' => [
          'referencing' => $a->referencing_passed ? 'passed' : 'pending',
          'right_to_rent' => $a->right_to_rent_verified ? 'verified' : 'pending',
          'deposit' => $a->deposit_received ? 'received' : 'pending',
        ],
        'date' => $a->created_at->toDateString(),
    ]);

    return $this->success([
        'applications' => $apps->toArray(),
        'ready' => TenantApplication::where('referencing_passed', true)->where('right_to_rent_verified', true)->where('deposit_received', true)->where('status', '!=', 'approved')->count(),
    ]);
  }

  private function completeOnboarding(array $args, ?User $user): ToolResult
  {
    $appId = $args['application_id'] ?? null;
    if (!$appId) return $this->fail('Application ID required.');

    $app = TenantApplication::with('property')->find($appId);
    if (!$app) return $this->fail("Application #{$appId} not found.");

    if (!$app->referencing_passed || !$app->right_to_rent_verified || !$app->deposit_received) {
      $missing = [];
      if (!$app->referencing_passed) $missing[] = 'referencing';
      if (!$app->right_to_rent_verified) $missing[] = 'right to rent';
      if (!$app->deposit_received) $missing[] = 'deposit';
      return $this->fail('Cannot complete. Missing: ' . implode(', ', $missing));
    }

    // Create active tenant
    $tenant = Tenant::create([
        'property_id' => $app->property_id,
        'name' => $app->applicant_name,
        'email' => $app->applicant_email,
        'phone' => $app->applicant_phone,
        'monthly_rent' => $app->proposed_rent,
        'tenancy_start' => $app->move_in_date ?? $app->proposed_start_date ?? now(),
        'is_active' => true,
    ]);

    $app->update(['status' => 'approved', 'move_in_date' => $app->move_in_date ?? now()->toDateString()]);

    return $this->success([
        'tenant_id' => $tenant->id,
        'property' => $app->property->address_line_1,
        'tenant' => $tenant->name,
        'rent' => $tenant->monthly_rent,
        'start_date' => $tenant->tenancy_start->toDateString(),
        'message' => "Onboarding complete. {$tenant->name} is now the active tenant at {$app->property->address_line_1}. Rent: £{$tenant->monthly_rent}/month. Move-in: {$tenant->tenancy_start->toDateString()}.",
    ]);
  }
}
```

## Part 3: Registration and Prompt

Standard dispatcher registration.

```php
'tenant_onboarding' => <<<'PROMPT'
You manage the full tenant onboarding process from enquiry to move-in.

WORKFLOW STAGES:
enquiry -> referencing -> right_to_rent -> deposit_pending -> ready -> approved

Use start_tenant_application when a new applicant enquires. Then update_application_status as each check passes. Use complete_onboarding only when all three checks (referencing, right to rent, deposit) are complete. This creates the active tenant record.

DEPOSIT: Calculate as 5 weeks rent: monthly_rent × 12 / 52 × 5. Round to nearest pound.

ALWAYS show the progress checklist after each status update so the landlord knows exactly what remains.
PROMPT,
```

## Verification

- [ ] Full flow: enquiry -> referencing -> right to rent -> deposit -> approved -> active tenant
- [ ] `complete_onboarding` blocks if checks incomplete
- [ ] Deposit calculated correctly at 5 weeks rent
- [ ] Standard registration and prompt

## Files Summary

| File | Action |
|------|--------|
| `database/migrations/tenant/XXXX_create_tenant_applications_table.php` | CREATE |
| `app/Models/Tenant/TenantApplication.php` | CREATE |
| `app/Services/Carina/ToolHandlers/TenantOnboardingHandler.php` | CREATE |
| `app/Services/Carina/CarinaModuleToolDispatcher.php` | MODIFY |
| `brain/prompts/carina_extended/carina-assistant-prompts.php` | MODIFY |
