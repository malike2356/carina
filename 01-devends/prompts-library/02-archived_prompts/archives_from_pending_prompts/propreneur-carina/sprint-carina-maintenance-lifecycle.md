# Sprint: Carina Maintenance Lifecycle

**Status: COMPLETED 2026-07-26**

**What was built:**
- Implemented and archived

> Shared preflight: read `README.md` in this folder before implementing. Target `/opt/lampp/htdocs/verlox/propreneur/propreneur-v2`. Verify existing Laravel models, migrations, dispatcher, prompt registry, tenant boundaries, and tests before using any code snippet. Treat snippets as implementation sketches, not blind copy/paste.

## What This Builds

Full maintenance workflow via chat: tenant reports issue -> landlord reviews -> contractor assigned -> work tracked -> invoice recorded. Carina manages the entire lifecycle, not just flagging the initial email.

## Architecture

```
Tenant: "There's a leak in the bathroom at flat 4"
 -> Carina creates maintenance_request (status: reported)
 -> Landlord reviews in digest or via "show me open maintenance"
 -> Landlord: "Schedule a plumber for flat 4"

Carina: "I found 2 plumbers in your contacts. Should I message James (Plumber, 07700 900123)?"
 -> Landlord: "Yes, message James"
 -> Carina drafts message to contractor via TenantCommunicationHandler
 -> Creates maintenance_job with status: scheduled, contractor: James

After work: Landlord: "Mark flat 4 bathroom leak as complete. Invoice: £180"
 -> Carina updates job to completed, records invoice
 -> Maintenance history stored per property
```

## Part 1: Database Migrations

```php
// database/migrations/tenant/XXXX_create_maintenance_tables.php

Schema::create('maintenance_requests', function (Blueprint $table) {
    $table->id();
    $table->foreignId('property_id')->constrained()->cascadeOnDelete();
    $table->foreignId('tenant_id')->nullable()->constrained()->nullOnDelete();
    $table->string('title');
    $table->text('description');
    $table->string('priority')->default('normal'); // low, normal, urgent, emergency
    $table->string('status')->default('reported'); // reported, reviewing, scheduled, in_progress, completed, cancelled
    $table->string('category')->default('general'); // plumbing, electrical, heating, structural, appliance, general
    $table->foreignId('reported_by_user_id')->nullable()->constrained('users')->nullOnDelete();
    $table->timestamps();
});

Schema::create('maintenance_jobs', function (Blueprint $table) {
    $table->id();
    $table->foreignId('maintenance_request_id')->constrained()->cascadeOnDelete();
    $table->foreignId('property_id')->constrained()->cascadeOnDelete();
    $table->string('contractor_name')->nullable();
    $table->string('contractor_phone')->nullable();
    $table->string('contractor_email')->nullable();
    $table->date('scheduled_date')->nullable();
    $table->string('status')->default('pending'); // pending, scheduled, in_progress, completed, cancelled
    $table->decimal('quoted_amount', 10, 2)->nullable();
    $table->decimal('invoice_amount', 10, 2)->nullable();
    $table->string('invoice_reference')->nullable();
    $table->text('outcome_notes')->nullable();
    $table->timestamps();
});

Schema::create('contractors', function (Blueprint $table) {
    $table->id();
    $table->string('name');
    $table->string('trade'); // plumber, electrician, builder, handyman, gas_engineer, roofer, painter, other
    $table->string('phone')->nullable();
    $table->string('email')->nullable();
    $table->string('company')->nullable();
    $table->text('notes')->nullable();
    $table->boolean('is_active')->default(true);
    $table->timestamps();
});
```

## Part 2: Tool Handler

Create `app/Services/Carina/ToolHandlers/MaintenanceHandler.php`:

```php
<?php

declare(strict_types=1);

namespace App\Services\Carina\ToolHandlers;

use App\Models\Tenant\MaintenanceRequest;
use App\Models\Tenant\MaintenanceJob;
use App\Models\Tenant\Contractor;
use App\Models\Tenant\Property;
use App\Models\Tenant\User;
use App\Services\Carina\CarinaConversation;
use App\Services\Carina\ToolResult;

final class MaintenanceHandler extends AbstractModuleToolHandler
{
  protected array $tools = [
    'create_maintenance_request',
    'list_maintenance',
    'assign_contractor',
    'update_maintenance_status',
    'manage_contractor',
    'list_contractors',
  ];

  public function __construct() {}

  public function handle(string $name, array $args, ?User $user, CarinaConversation $conversation): ToolResult
  {
    try {
      return match ($name) {
        'create_maintenance_request' => $this->createRequest($args, $user),
        'list_maintenance' => $this->listRequests($args),
        'assign_contractor' => $this->assignContractor($args, $user),
        'update_maintenance_status' => $this->updateStatus($args),
        'manage_contractor' => $this->manageContractor($args),
        'list_contractors' => $this->listContractors($args),
        default => $this->fail('Unsupported tool.'),
      };
    } catch (\Throwable $e) {
      return $this->fail($e->getMessage(), 'execution_error');
    }
  }

  private function createRequest(array $args, ?User $user): ToolResult
  {
    $propertyRef = $args['property_reference'] ?? null;
    $title = $args['title'] ?? 'Maintenance issue';
    $description = $args['description'] ?? '';
    $priority = $args['priority'] ?? 'normal';
    $category = $args['category'] ?? 'general';

    if (!$propertyRef) {
      return $this->fail('Property reference required.');
    }

    $property = Property::where('address_line_1', 'like', "%{$propertyRef}%")->first();
    if (!$property) {
      return $this->fail("Property '{$propertyRef}' not found.");
    }

    $request = MaintenanceRequest::create([
        'property_id' => $property->id,
        'tenant_id' => $property->tenants()->where('is_active', true)->first()?->id,
        'title' => $title,
        'description' => $description,
        'priority' => $priority,
        'category' => $category,
        'status' => 'reported',
        'reported_by_user_id' => $user?->id,
    ]);

    $priorityFlag = $priority === 'emergency' ? 'URGENT: ' : ($priority === 'urgent' ? 'URGENT: ' : '');

    return $this->success([
        'request_id' => $request->id,
        'property' => $property->address_line_1,
        'title' => $title,
        'priority' => $priority,
        'message' => "{$priorityFlag}Maintenance request #{$request->id} created for {$property->address_line_1}: {$title}.",
    ]);
  }

  private function listRequests(array $args): ToolResult
  {
    $status = $args['status'] ?? null;
    $propertyRef = $args['property_reference'] ?? null;
    $priority = $args['priority'] ?? null;

    $query = MaintenanceRequest::with(['property', 'jobs']);

    if ($status) $query->where('status', $status);
    if ($priority) $query->where('priority', $priority);
    if ($propertyRef) {
      $prop = Property::where('address_line_1', 'like', "%{$propertyRef}%")->first();
      if ($prop) $query->where('property_id', $prop->id);
    }

    $requests = $query->latest()->limit(20)->get();

    if ($requests->isEmpty()) {
      return $this->success(['message' => 'No maintenance requests found.', 'requests' => []]);
    }

    $items = $requests->map(fn($r) => [
        'id' => $r->id,
        'property' => $r->property?->address_line_1,
        'title' => $r->title,
        'priority' => $r->priority,
        'status' => $r->status,
        'category' => $r->category,
        'has_contractor' => $r->jobs->where('status', '!=', 'cancelled')->isNotEmpty(),
        'latest_job' => $r->jobs->last()?->status,
        'created' => $r->created_at->diffForHumans(),
    ]);

    $open = $requests->whereIn('status', ['reported', 'reviewing', 'scheduled', 'in_progress'])->count();

    return $this->success([
        'total' => $requests->count(),
        'open' => $open,
        'requests' => $items->toArray(),
        'message' => "{$requests->count()} requests found. {$open} open.",
    ]);
  }

  private function assignContractor(array $args, ?User $user): ToolResult
  {
    $requestId = $args['request_id'] ?? null;
    $contractorId = $args['contractor_id'] ?? null;
    $contractorName = $args['contractor_name'] ?? null;
    $scheduledDate = $args['scheduled_date'] ?? null;

    if (!$requestId) return $this->fail('Request ID required.');
    $request = MaintenanceRequest::find($requestId);
    if (!$request) return $this->fail("Request #{$requestId} not found.");

    $contractor = null;
    if ($contractorId) {
      $contractor = Contractor::find($contractorId);
    } elseif ($contractorName) {
      $contractor = Contractor::where('name', 'like', "%{$contractorName}%")->first();
    }

    if (!$contractor) {
      // Suggest available contractors in the right trade
      $trade = match ($request->category) {
        'plumbing' => 'plumber',
        'electrical' => 'electrician',
        'heating' => 'gas_engineer',
        default => null,
      };

      $suggestions = $trade
      ? Contractor::where('trade', $trade)->where('is_active', true)->get()
      : Contractor::where('is_active', true)->get();

      return $this->success([
          'suggestion' => true,
          'contractors' => $suggestions->map(fn($c) => [
              'id' => $c->id,
              'name' => $c->name,
              'trade' => $c->trade,
              'phone' => $c->phone,
          ])->toArray(),
          'message' => "Here are available contractors. Say 'assign contractor [name] to request {$requestId}'.",
      ]);
    }

    $job = MaintenanceJob::create([
        'maintenance_request_id' => $request->id,
        'property_id' => $request->property_id,
        'contractor_name' => $contractor->name,
        'contractor_phone' => $contractor->phone,
        'contractor_email' => $contractor->email,
        'scheduled_date' => $scheduledDate,
        'status' => $scheduledDate ? 'scheduled' : 'pending',
    ]);

    $request->update(['status' => $scheduledDate ? 'scheduled' : 'reviewing']);

    return $this->success([
        'job_id' => $job->id,
        'contractor' => $contractor->name,
        'scheduled' => $scheduledDate,
        'message' => "Contractor {$contractor->name} assigned to request #{$requestId}." . ($scheduledDate ? " Scheduled for {$scheduledDate}." : ""),
        'next_step' => "To message the contractor: 'draft a message to {$contractor->name} about the {$request->title} at {$request->property->address_line_1}'",
    ]);
  }

  private function updateStatus(array $args): ToolResult
  {
    $requestId = $args['request_id'] ?? null;
    $status = $args['status'] ?? null;
    $invoiceAmount = $args['invoice_amount'] ?? null;
    $outcomeNotes = $args['outcome_notes'] ?? null;

    if (!$requestId || !$status) return $this->fail('Request ID and status required.');

    $request = MaintenanceRequest::find($requestId);
    if (!$request) return $this->fail("Request #{$requestId} not found.");

    $request->update(['status' => $status]);

    $job = $request->jobs()->latest()->first();
    if ($job && $status === 'completed') {
      $job->update([
          'status' => 'completed',
          'invoice_amount' => $invoiceAmount,
          'outcome_notes' => $outcomeNotes,
      ]);
    }

    return $this->success([
        'request_id' => $request->id,
        'status' => $status,
        'invoice_amount' => $invoiceAmount,
        'message' => "Maintenance request #{$requestId} marked as {$status}." . ($invoiceAmount ? " Invoice: £{$invoiceAmount}." : ""),
    ]);
  }

  private function manageContractor(array $args): ToolResult
  {
    $action = $args['action'] ?? 'add';
    $name = $args['name'] ?? null;
    $trade = $args['trade'] ?? null;
    $phone = $args['phone'] ?? null;
    $email = $args['email'] ?? null;

    if ($action === 'add') {
      if (!$name || !$trade) return $this->fail('Name and trade required.');
      $c = Contractor::create(['name' => $name, 'trade' => $trade, 'phone' => $phone, 'email' => $email]);
      return $this->success(['contractor_id' => $c->id, 'message' => "Contractor {$name} ({$trade}) added."]);
    }

    return $this->fail("Unknown action: {$action}");
  }

  private function listContractors(array $args): ToolResult
  {
    $trade = $args['trade'] ?? null;
    $query = Contractor::where('is_active', true);
    if ($trade) $query->where('trade', $trade);

    $contractors = $query->get()->map(fn($c) => [
        'id' => $c->id, 'name' => $c->name, 'trade' => $c->trade, 'phone' => $c->phone,
    ]);

    return $this->success(['contractors' => $contractors->toArray()]);
  }
}
```

## Part 3: Registration and Prompt

Standard dispatcher registration pattern (import, constructor, array).

Prompt library addition:

```php
'maintenance' => <<<'PROMPT'
You manage the full maintenance lifecycle.

-- REPORTING ISSUES --
Use create_maintenance_request:
- title: Short description (REQUIRED)
- description: Full details
- priority: low, normal, urgent, emergency
- category: plumbing, electrical, heating, structural, appliance, general
- property_reference: Address (REQUIRED)

-- VIEWING REQUESTS --
Use list_maintenance:
- status: Filter by status (reported, reviewing, scheduled, in_progress, completed)
- property_reference: Filter by property
- priority: Filter by priority

-- ASSIGNING CONTRACTORS --
Use assign_contractor:
- request_id: The maintenance request ID
- contractor_name: Name of contractor (system searches existing)
- scheduled_date: When the work is booked

-- UPDATING STATUS --
Use update_maintenance_status:
- request_id: The request ID
- status: New status
- invoice_amount: If completed, the invoice total
- outcome_notes: What was done

-- MANAGING CONTRACTORS --
Use manage_contractor(action="add") or list_contractors.

CONVERSATION FLOW:
User: "The tenant at flat 4 says the boiler is broken"
Carina: [creates request with priority=urgent, category=heating]
Carina: "Maintenance request created. I found 2 heating contractors. Should I assign one?"

User: "Assign James"
Carina: [assigns contractor, creates job]
Carina: "James assigned. Should I draft a message to him?"

User: "Yes"
Carina: [drafts message via draft_tenant_message pattern]
PROMPT,
```

## Verification

- [ ] Migrations create 3 tables
- [ ] `php -l` passes on handler and models
- [ ] Create request -> assign contractor -> schedule -> complete with invoice
- [ ] Contractor suggestions by trade
- [ ] Status transitions: reported -> reviewing -> scheduled -> in_progress -> completed
- [ ] Maintenance history stored per property
- [ ] No hardcoded values

## Files Summary

| File | Action |
|------|--------|
| `database/migrations/tenant/XXXX_create_maintenance_tables.php` | CREATE |
| `app/Models/Tenant/MaintenanceRequest.php` | CREATE |
| `app/Models/Tenant/MaintenanceJob.php` | CREATE |
| `app/Models/Tenant/Contractor.php` | CREATE |
| `app/Services/Carina/ToolHandlers/MaintenanceHandler.php` | CREATE |
| `app/Services/Carina/CarinaModuleToolDispatcher.php` | MODIFY |
| `brain/prompts/carina_extended/carina-assistant-prompts.php` | MODIFY |
