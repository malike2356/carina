<?php

declare(strict_types=1);

use App\Models\Tenant\Property;
use App\Models\Tenant\PropertyMaintenanceRequest;
use App\Models\Tenant\User;
use App\Services\Properties\AwaabsLawService;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
});

it('damp_mould request triggers Awaabs Law flag and sets timestamps', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Awaabs '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@awaabs.test',
        'plan' => 'mentor_network',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    $property = Property::query()->create([
        'address_line1' => '1 Damp Street',
        'city' => 'Leeds',
        'postcode' => 'LS1 1AA',
        'property_type' => 'terraced',
        'status' => 'managing',
        'created_by' => $user->id,
    ]);

    $request = PropertyMaintenanceRequest::query()->create([
        'property_id' => $property->id,
        'title' => 'Black mould in bedroom',
        'category' => AwaabsLawService::CATEGORY_DAMP_MOULD,
        'reported_at' => now()->toDateString(),
        'status' => 'open',
        'priority' => 'urgent',
        'reported_by_user_id' => $user->id,
    ]);

    app(AwaabsLawService::class)->applyAwaabsLaw($request);
    $request->save();

    expect($request->awaabs_law_applies)->toBeTrue()
        ->and($request->awaabs_24h_due_at)->not->toBeNull()
        ->and($request->awaabs_14d_due_at)->not->toBeNull()
        ->and($request->awaabs_24h_met_at)->toBeNull();

    tenancy()->end();
});

it('breach detection returns request where 24h window passed without response', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Awaabs Breach '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@awaabs-breach.test',
        'plan' => 'mentor_network',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    $property = Property::query()->create([
        'address_line1' => '2 Mould Lane',
        'city' => 'Leeds',
        'postcode' => 'LS2 2AA',
        'property_type' => 'hmo',
        'strategy' => 'hmo',
        'status' => 'managing',
        'created_by' => $user->id,
    ]);

    $request = PropertyMaintenanceRequest::query()->create([
        'property_id' => $property->id,
        'title' => 'Severe damp',
        'category' => AwaabsLawService::CATEGORY_DAMP_MOULD,
        'reported_at' => now()->toDateString(),
        'status' => 'open',
        'priority' => 'urgent',
        'reported_by_user_id' => $user->id,
        'awaabs_law_applies' => true,
        'awaabs_24h_due_at' => now()->subHour(),
        'awaabs_14d_due_at' => now()->addDays(13),
        'awaabs_24h_met_at' => null,
    ]);

    $breached = app(AwaabsLawService::class)->getBreachedRequests($property);
    expect($breached->pluck('id')->all())->toContain($request->id);

    tenancy()->end();
});

it('marks response and repair milestones from lifecycle', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Awaabs Lifecycle '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@awaabs-life.test',
        'plan' => 'mentor_network',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    $property = Property::query()->create([
        'address_line1' => '3 Hazard Road',
        'city' => 'Leeds',
        'postcode' => 'LS3 3AA',
        'property_type' => 'hmo',
        'status' => 'managing',
        'created_by' => $user->id,
    ]);

    $request = PropertyMaintenanceRequest::query()->create([
        'property_id' => $property->id,
        'title' => 'Category 1 hazard',
        'category' => AwaabsLawService::CATEGORY_ONE_HAZARD,
        'reported_at' => now()->toDateString(),
        'status' => 'open',
        'priority' => 'urgent',
        'reported_by_user_id' => $user->id,
        'awaabs_law_applies' => true,
        'awaabs_24h_due_at' => now()->addHours(12),
        'awaabs_14d_due_at' => now()->addDays(14),
    ]);

    $service = app(AwaabsLawService::class);
    $request->status = 'in_progress';
    $service->syncFromLifecycle($request, 'open');
    $request->refresh();

    expect($request->awaabs_24h_met_at)->not->toBeNull();

    $request->status = 'completed';
    $service->syncFromLifecycle($request, 'in_progress');
    $request->refresh();

    expect($request->awaabs_14d_met_at)->not->toBeNull();

    tenancy()->end();
});
