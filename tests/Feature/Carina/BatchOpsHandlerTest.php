<?php

declare(strict_types=1);

use App\Models\Central\Tenant;
use App\Models\Tenant\CarinaConversation;
use App\Models\Tenant\ComplianceItem;
use App\Models\Tenant\Property;
use App\Models\Tenant\PropertyTenancy;
use App\Models\Tenant\TenancyRentPayment;
use App\Models\Tenant\User;
use App\Services\Carina\CarinaModuleToolDispatcher;
use App\Services\Carina\ToolHandlers\BatchOpsHandler;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;

/**
 * @return array{0: Tenant, 1: User}
 */
function batchOpsTenant(): array
{
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Batch Ops '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@batchops.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    return [$tenant, $user];
}

function batchOpsConversation(Tenant $tenant, User $user): CarinaConversation
{
    return CarinaConversation::query()->create([
        'tenant_id' => (string) $tenant->getTenantKey(),
        'user_id' => $user->id,
        'title' => 'Batch ops test',
    ]);
}

function batchOpsProperty(User $user, string $address): Property
{
    return Property::query()->create([
        'created_by' => $user->id,
        'address_line1' => $address,
        'city' => 'Portsmouth',
        'postcode' => 'PO4 2AA',
        'property_type' => 'flat',
        'bedrooms' => 2,
    ]);
}

function batchOpsTenancy(Property $property, User $user, float $rent = 900.0): PropertyTenancy
{
    return PropertyTenancy::query()->create([
        'property_id' => $property->id,
        'tenant_name' => 'Tenant '.$property->id,
        'start_date' => now()->subMonths(3)->toDateString(),
        'rent_amount' => $rent,
        'tenancy_type' => 'ast',
        'rent_due_day' => 1,
    ]);
}

it('batch_mark_rent records payments for active tenancies', function (): void {
    [$tenant, $user] = batchOpsTenant();
    tenancy()->initialize($tenant);

    $propertyA = batchOpsProperty($user, '1 Batch Lane');
    $propertyB = batchOpsProperty($user, '2 Batch Lane');
    batchOpsTenancy($propertyA, $user, 800);
    batchOpsTenancy($propertyB, $user, 950);

    $month = now()->format('Y-m');
    $conversation = batchOpsConversation($tenant, $user);

    $result = app(BatchOpsHandler::class)->handle(
        'batch_mark_rent',
        ['month' => $month],
        $user,
        $conversation,
    );

    expect($result->success)->toBeTrue()
        ->and($result->data['recorded_count'])->toBe(2)
        ->and($result->data['skipped_count'])->toBe(0);

    expect(TenancyRentPayment::query()->where('status', 'paid')->count())->toBe(2);

    tenancy()->end();
});

it('batch_mark_rent skips tenancies already paid for the month', function (): void {
    [$tenant, $user] = batchOpsTenant();
    tenancy()->initialize($tenant);

    $property = batchOpsProperty($user, '3 Batch Lane');
    $tenancy = batchOpsTenancy($property, $user, 900);
    $month = now()->format('Y-m');

    TenancyRentPayment::query()->create([
        'tenancy_id' => $tenancy->id,
        'property_id' => $property->id,
        'amount_minor' => 90000,
        'due_date' => now()->startOfMonth()->toDateString(),
        'paid_date' => now()->toDateString(),
        'status' => 'paid',
        'created_by' => $user->id,
    ]);

    $conversation = batchOpsConversation($tenant, $user);

    $result = app(BatchOpsHandler::class)->handle(
        'batch_mark_rent',
        ['month' => $month],
        $user,
        $conversation,
    );

    expect($result->success)->toBeTrue()
        ->and($result->data['recorded_count'])->toBe(0)
        ->and($result->data['skipped_count'])->toBe(1);

    expect(TenancyRentPayment::query()->count())->toBe(1);

    tenancy()->end();
});

it('batch_compliance_check returns expiring and expired items', function (): void {
    [$tenant, $user] = batchOpsTenant();
    tenancy()->initialize($tenant);

    $property = batchOpsProperty($user, '4 Batch Lane');

    ComplianceItem::query()->create([
        'property_id' => $property->id,
        'created_by' => $user->id,
        'category' => 'safety',
        'type' => 'gas_safety',
        'title' => 'Gas safety certificate',
        'expires_at' => now()->addDays(10)->toDateString(),
        'status' => 'valid',
    ]);

    ComplianceItem::query()->create([
        'property_id' => $property->id,
        'created_by' => $user->id,
        'category' => 'safety',
        'type' => 'eicr',
        'title' => 'EICR',
        'expires_at' => now()->subDays(5)->toDateString(),
        'status' => 'expired',
    ]);

    $conversation = batchOpsConversation($tenant, $user);

    $result = app(BatchOpsHandler::class)->handle(
        'batch_compliance_check',
        ['days' => 30],
        $user,
        $conversation,
    );

    expect($result->success)->toBeTrue()
        ->and($result->data['expiring_soon'])->toBe(1)
        ->and($result->data['expired'])->toBe(1)
        ->and($result->data['worst_offenders'])->toHaveCount(1);

    tenancy()->end();
});

it('upcoming_events includes compliance and tenancy renewals sorted by date', function (): void {
    [$tenant, $user] = batchOpsTenant();
    tenancy()->initialize($tenant);

    $property = batchOpsProperty($user, '5 Batch Lane');

    ComplianceItem::query()->create([
        'property_id' => $property->id,
        'created_by' => $user->id,
        'category' => 'safety',
        'type' => 'epc',
        'title' => 'EPC',
        'expires_at' => now()->addDays(14)->toDateString(),
        'status' => 'valid',
    ]);

    PropertyTenancy::query()->create([
        'property_id' => $property->id,
        'tenant_name' => 'Renewal Tenant',
        'start_date' => now()->subYear()->toDateString(),
        'end_date' => now()->addDays(45)->toDateString(),
        'rent_amount' => 850,
        'tenancy_type' => 'ast',
    ]);

    $conversation = batchOpsConversation($tenant, $user);

    $result = app(BatchOpsHandler::class)->handle(
        'upcoming_events',
        [],
        $user,
        $conversation,
    );

    expect($result->success)->toBeTrue()
        ->and($result->data['all_upcoming'])->toHaveCount(2)
        ->and($result->data['all_upcoming'][0]['date'] <= $result->data['all_upcoming'][1]['date'])->toBeTrue();

    tenancy()->end();
});

it('generate_report creates pdf and sends email', function (): void {
    Mail::fake();
    Storage::fake('local');

    [$tenant, $user] = batchOpsTenant();
    tenancy()->initialize($tenant);

    $property = batchOpsProperty($user, '6 Batch Lane');
    batchOpsTenancy($property, $user, 775);

    $conversation = batchOpsConversation($tenant, $user);

    $result = app(BatchOpsHandler::class)->handle(
        'generate_report',
        [
            'report_type' => 'summary',
            'send_to' => 'reports@example.test',
        ],
        $user,
        $conversation,
    );

    expect($result->success)->toBeTrue()
        ->and($result->data['report_type'])->toBe('summary')
        ->and($result->data['sent_to'])->toBe('reports@example.test');

    Storage::disk('local')->assertExists($result->data['storage_path']);
    Mail::assertSentCount(1);

    tenancy()->end();
});

it('portfolio_health returns score and issues', function (): void {
    [$tenant, $user] = batchOpsTenant();
    tenancy()->initialize($tenant);

    $occupied = batchOpsProperty($user, '7 Batch Lane');
    batchOpsTenancy($occupied, $user, 900);
    batchOpsProperty($user, '8 Batch Lane Vacant');

    ComplianceItem::query()->create([
        'property_id' => $occupied->id,
        'created_by' => $user->id,
        'category' => 'safety',
        'type' => 'gas_safety',
        'title' => 'Gas safety',
        'expires_at' => now()->subDay()->toDateString(),
        'status' => 'expired',
    ]);

    $conversation = batchOpsConversation($tenant, $user);

    $result = app(BatchOpsHandler::class)->handle(
        'portfolio_health',
        [],
        $user,
        $conversation,
    );

    expect($result->success)->toBeTrue()
        ->and($result->data['health_score'])->toBeInt()
        ->and($result->data['issues'])->not->toBeEmpty()
        ->and($result->data['metrics']['vacant_properties'])->toBe(1);

    tenancy()->end();
});

it('registers batch ops tools in the dispatcher', function (): void {
    [$tenant, $user] = batchOpsTenant();
    tenancy()->initialize($tenant);

    $conversation = batchOpsConversation($tenant, $user);
    $dispatcher = app(CarinaModuleToolDispatcher::class);

    $result = $dispatcher->dispatch('portfolio_health', [], $user, $conversation);

    expect($result->success)->toBeTrue();

    tenancy()->end();
});
