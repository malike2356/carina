<?php

declare(strict_types=1);

use App\Models\Tenant\CommunalAreaInspection;
use App\Models\Tenant\Property;
use App\Models\Tenant\User;
use App\Services\Properties\FireSafetyService;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
});

it('inspection creates record with correct next_due_at', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Communal '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@communal.test',
        'plan' => 'mentor_network',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    $property = Property::query()->create([
        'address_line1' => '1 Communal Way',
        'city' => 'Leeds',
        'postcode' => 'LS4 4AA',
        'property_type' => 'hmo',
        'strategy' => 'hmo',
        'status' => 'managing',
        'created_by' => $user->id,
    ]);

    $inspectedAt = now()->subDays(2)->toDateString();
    $inspection = app(FireSafetyService::class)->logCommunalInspection($property, [
        'area_type' => 'kitchen',
        'area_label' => 'Shared kitchen',
        'inspected_at' => $inspectedAt,
        'result' => CommunalAreaInspection::RESULT_SATISFACTORY,
    ], $user);

    expect($inspection->next_due_at?->toDateString())->toBe(now()->subDays(2)->addDays(90)->toDateString());

    tenancy()->end();
});

it('overdue detection returns inspections past next_due_at', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Communal Overdue '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@communal-overdue.test',
        'plan' => 'mentor_network',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    $property = Property::query()->create([
        'address_line1' => '2 Hall Lane',
        'city' => 'Leeds',
        'postcode' => 'LS5 5AA',
        'property_type' => 'hmo',
        'strategy' => 'hmo',
        'status' => 'managing',
        'created_by' => $user->id,
    ]);

    CommunalAreaInspection::query()->create([
        'property_id' => $property->id,
        'area_type' => 'hallway',
        'inspected_at' => now()->subDays(100),
        'result' => CommunalAreaInspection::RESULT_SATISFACTORY,
        'next_due_at' => now()->subDays(5),
        'created_by' => $user->id,
    ]);

    $overdue = app(FireSafetyService::class)->getOverdueCommunalInspections($property);
    expect($overdue)->toHaveCount(1);

    tenancy()->end();
});
