<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\ComplianceItem;
use App\Models\Tenant\Property;
use App\Models\Tenant\User;
use App\Services\Compliance\ComplianceStarterChecklistService;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;

beforeEach(function (): void {
    $this->withoutMiddleware(VerifyCsrfToken::class);
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', 'compliance')->update(['enabled' => true]);
});

it('creates starter compliance rows aligned with missing types only', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Compliance Starter '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@compliance-starter.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    $property = Property::query()->create([
        'address_line1' => '1 Starter Lane',
        'city' => 'Leeds',
        'postcode' => 'LS11AA',
        'property_type' => 'flat',
        'status' => 'managing',
        'created_by' => $user->id,
    ]);

    ComplianceItem::query()->create([
        'property_id' => $property->id,
        'created_by' => $user->id,
        'category' => 'legal',
        'type' => 'epc',
        'title' => 'EPC already here',
        'status' => 'valid',
        'reminder_days' => 90,
    ]);

    $svc = app(ComplianceStarterChecklistService::class);
    $created = $svc->apply($property, (int) $user->id);

    expect($created)->toBeGreaterThan(0);
    expect(ComplianceItem::query()->where('property_id', $property->id)->where('type', 'epc')->count())->toBe(1);
    expect(ComplianceItem::query()->where('property_id', $property->id)->where('type', 'gas_safety')->exists())->toBeTrue();
    expect(ComplianceItem::query()->where('property_id', $property->id)->where('type', 'pat_testing')->exists())->toBeTrue();

    expect($svc->apply($property, (int) $user->id))->toBe(0);

    tenancy()->end();
});

it('accepts starter checklist post from compliance hub', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Compliance HTTP '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@compliance-http.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    $property = Property::query()->create([
        'address_line1' => '9 HTTP Row',
        'city' => 'Sheffield',
        'postcode' => 'S11AA',
        'property_type' => 'terraced',
        'status' => 'managing',
        'created_by' => $user->id,
    ]);
    tenancy()->end();

    $this->actingAs($user, 'web');
    $this->post('http://'.$host.'/compliance/starter-checklist', [
        'property_id' => $property->id,
    ])->assertRedirect();

    tenancy()->initialize($tenant);
    expect(ComplianceItem::query()->where('property_id', $property->id)->count())->toBeGreaterThan(3);
    tenancy()->end();
});

it('includes HMO licence row when property is flagged for HMO licensing', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Compliance HMO '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@compliance-hmo.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    $property = Property::query()->create([
        'address_line1' => '2 HMO Street',
        'city' => 'Bristol',
        'postcode' => 'BS11AA',
        'property_type' => 'flat',
        'hmo_license_required' => true,
        'status' => 'managing',
        'created_by' => $user->id,
    ]);

    $created = app(ComplianceStarterChecklistService::class)->apply($property, (int) $user->id);
    expect($created)->toBeGreaterThan(0);
    expect(ComplianceItem::query()->where('property_id', $property->id)->where('type', 'hmo_license')->exists())->toBeTrue();

    tenancy()->end();
});
