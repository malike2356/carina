<?php

declare(strict_types=1);

use App\Events\Tenant\WorksOrder\WorksOrderCompleted;
use App\Listeners\WorksOrder\CreateMaintenanceCostJournalOnCompletion;
use App\Models\Tenant\GlAccount;
use App\Models\Tenant\JournalEntry;
use App\Models\Tenant\Property;
use App\Models\Tenant\User;
use App\Models\Tenant\WorksOrder;
use App\Services\Accounting\ChartOfAccountsService;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
});

it('creates maintenance cost journal when works order completed', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'WO JE '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'wo-je-'.uniqid().'@test.test',
        'plan' => 'mentor_network',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    GlAccount::query()->delete();
    app(ChartOfAccountsService::class)->ensureDefaultAccounts();
    $property = Property::query()->create([
        'address_line1' => '30 Works Road',
        'city' => 'Leeds',
        'postcode' => 'LS30 1AA',
        'property_type' => 'flat',
        'status' => 'managing',
        'strategy' => 'btl',
        'created_by' => $user->id,
    ]);
    $order = WorksOrder::query()->create([
        'property_id' => $property->id,
        'title' => 'Boiler repair',
        'status' => 'completed',
        'actual_amount' => 450.50,
        'created_by' => $user->id,
    ]);

    app(CreateMaintenanceCostJournalOnCompletion::class)
        ->handle(new WorksOrderCompleted($order->fresh('property')));

    expect(JournalEntry::query()->where('reference', 'WO-'.$order->id)->exists())->toBeTrue();
    tenancy()->end();
});
