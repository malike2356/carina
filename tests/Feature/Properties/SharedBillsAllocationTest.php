<?php

declare(strict_types=1);

use App\Models\Tenant\BillAllocation;
use App\Models\Tenant\GlAccount;
use App\Models\Tenant\JournalEntry;
use App\Models\Tenant\JournalLine;
use App\Models\Tenant\Property;
use App\Models\Tenant\Room;
use App\Models\Tenant\User;
use App\Services\Accounting\ChartOfAccountsService;
use App\Services\Properties\SharedBillsService;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Support\Facades\Queue;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    Queue::fake();
});

function sharedBillsHmoProperty(User $user, array $overrides = []): Property
{
    return Property::query()->create(array_merge([
        'address_line1' => '10 Bills Lane',
        'city' => 'Leeds',
        'postcode' => 'LS10 1AA',
        'property_type' => 'hmo',
        'strategy' => 'hmo',
        'status' => 'managing',
        'hmo_license_required' => true,
        'created_by' => $user->id,
    ], $overrides));
}

function seedGlForSharedBills(): void
{
    GlAccount::query()->delete();
    app(ChartOfAccountsService::class)->ensureDefaultAccounts();
}

it('equal split across 4 occupied rooms produces correct per-room amounts', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Bills Equal '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'bills-equal-'.uniqid().'@test.test',
        'plan' => 'mentor_network',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    seedGlForSharedBills();

    $property = sharedBillsHmoProperty($user);
    foreach (['Room A', 'Room B', 'Room C', 'Room D'] as $name) {
        Room::query()->create([
            'property_id' => $property->id,
            'created_by' => $user->id,
            'name' => $name,
            'room_type' => 'single',
            'status' => 'occupied',
            'rent_pcm' => 500,
        ]);
    }

    $allocation = app(SharedBillsService::class)->createAllocation($property, [
        'period_start' => now()->startOfMonth()->toDateString(),
        'period_end' => now()->endOfMonth()->toDateString(),
        'utility_type' => 'gas',
        'total_cost' => 400.00,
        'allocation_method' => BillAllocation::METHOD_EQUAL,
    ], $user);

    expect($allocation->allocation_shares)->toHaveCount(4)
        ->and((float) array_sum($allocation->allocation_shares))->toEqual(400.0);

    foreach ($allocation->allocation_shares as $share) {
        expect((float) $share)->toBe(100.0);
    }

    tenancy()->end();
});

it('proportional split uses room sqm correctly', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Bills Prop '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'bills-prop-'.uniqid().'@test.test',
        'plan' => 'mentor_network',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    seedGlForSharedBills();

    $property = sharedBillsHmoProperty($user);
    $small = Room::query()->create([
        'property_id' => $property->id,
        'created_by' => $user->id,
        'name' => 'Small',
        'room_type' => 'single',
        'status' => 'occupied',
        'floor_area_sqm' => 10,
        'occupant_type' => 'single',
    ]);
    $large = Room::query()->create([
        'property_id' => $property->id,
        'created_by' => $user->id,
        'name' => 'Large',
        'room_type' => 'double',
        'status' => 'available',
        'floor_area_sqm' => 20,
        'occupant_type' => 'double',
    ]);

    $allocation = app(SharedBillsService::class)->createAllocation($property, [
        'period_start' => now()->startOfMonth()->toDateString(),
        'period_end' => now()->endOfMonth()->toDateString(),
        'utility_type' => 'electricity',
        'total_cost' => 300.00,
        'allocation_method' => BillAllocation::METHOD_PROPORTIONAL_SQM,
    ], $user);

    expect((float) $allocation->allocation_shares[(string) $small->id])->toBe(100.0)
        ->and((float) $allocation->allocation_shares[(string) $large->id])->toBe(200.0);

    tenancy()->end();
});

it('posting creates double-entry journal entries', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Bills Post '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'bills-post-'.uniqid().'@test.test',
        'plan' => 'mentor_network',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    seedGlForSharedBills();

    $property = sharedBillsHmoProperty($user);
    Room::query()->create([
        'property_id' => $property->id,
        'created_by' => $user->id,
        'name' => 'Room 1',
        'room_type' => 'single',
        'status' => 'occupied',
    ]);
    Room::query()->create([
        'property_id' => $property->id,
        'created_by' => $user->id,
        'name' => 'Room 2',
        'room_type' => 'single',
        'status' => 'occupied',
    ]);

    $allocation = app(SharedBillsService::class)->createAllocation($property, [
        'period_start' => now()->startOfMonth()->toDateString(),
        'period_end' => now()->endOfMonth()->toDateString(),
        'utility_type' => 'water',
        'total_cost' => 200.00,
        'allocation_method' => BillAllocation::METHOD_EQUAL,
    ], $user);

    $posted = app(SharedBillsService::class)->postAllocation($allocation, $user);

    expect($posted->status)->toBe(BillAllocation::STATUS_POSTED)
        ->and($posted->journal_entry_id)->not->toBeNull();

    $entry = JournalEntry::query()->with('lines')->findOrFail($posted->journal_entry_id);
    expect($entry->status)->toBe(JournalEntry::STATUS_POSTED);

    $debits = $entry->lines->sum('debit_minor');
    $credits = $entry->lines->sum('credit_minor');
    expect($debits)->toBe($credits)
        ->and($debits)->toBe(20000)
        ->and($entry->lines->where('debit_minor', '>', 0)->count())->toBe(2);

    tenancy()->end();
});

it('council tax is recorded as property expense not room split', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Bills CT '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'bills-ct-'.uniqid().'@test.test',
        'plan' => 'mentor_network',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    seedGlForSharedBills();

    $property = sharedBillsHmoProperty($user);
    Room::query()->create([
        'property_id' => $property->id,
        'created_by' => $user->id,
        'name' => 'Room 1',
        'room_type' => 'single',
        'status' => 'occupied',
    ]);

    expect(BillAllocation::query()->where('property_id', $property->id)->count())->toBe(0);

    $entry = app(SharedBillsService::class)->councilTaxAsPropertyExpense($property, [
        'amount' => 1850.00,
        'period_label' => '2026/27',
    ], $user);

    expect($entry->status)->toBe(JournalEntry::STATUS_POSTED)
        ->and($entry->description)->toContain('landlord-liable')
        ->and(BillAllocation::query()->where('property_id', $property->id)->count())->toBe(0);

    $lines = JournalLine::query()->where('journal_entry_id', $entry->id)->get();
    expect($lines)->toHaveCount(2)
        ->and($lines->sum('debit_minor'))->toBe($lines->sum('credit_minor'))
        ->and($lines->sum('debit_minor'))->toBe(185000);

    tenancy()->end();
});
