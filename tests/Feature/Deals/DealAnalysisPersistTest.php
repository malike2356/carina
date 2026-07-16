<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\DealAnalysis;
use App\Models\Tenant\Property;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;

beforeEach(function () {
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

it('stores a deal analysis from the tenant UI', function () {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Deal Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@deal.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    $property = Property::query()->create([
        'address_line1' => '2 Deal Row',
        'city' => 'Manchester',
        'postcode' => 'M1 1AE',
        'property_type' => 'terraced',
        'status' => 'lead',
        'created_by' => $user->id,
    ]);

    tenancy()->end();

    $this->actingAs($user, 'web');

    $response = $this->post('http://'.$host.'/deals', [
        'property_id' => $property->id,
        'strategy' => 'btl',
        'title' => 'Scenario A',
        'metrics' => ['purchase_price' => 200000],
        'status' => 'draft',
    ]);

    $response->assertRedirect();

    tenancy()->initialize($tenant);
    expect(DealAnalysis::query()->count())->toBe(1)
        ->and(DealAnalysis::query()->first()->title)->toBe('Scenario A');
    tenancy()->end();
});

it('stores calculator snapshot inside metrics when calculator_snapshot is posted', function () {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Snap Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@snap.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();

    $property = Property::query()->create([
        'address_line1' => '9 Calc Lane',
        'city' => 'Leeds',
        'postcode' => 'LS1 1AA',
        'property_type' => 'terraced',
        'status' => 'lead',
        'created_by' => $user->id,
    ]);

    tenancy()->end();

    $this->actingAs($user, 'web');

    $snapshot = json_encode([
        'strategy' => 'btl',
        'outputs' => ['roi_pct' => 7.5],
        'applied_at' => '2026-05-02T12:00:00Z',
    ]);

    $this->post('http://'.$host.'/deals', [
        'property_id' => $property->id,
        'strategy' => 'btl',
        'title' => 'With snapshot',
        'metrics' => ['purchase_price' => 180000],
        'calculator_snapshot' => $snapshot,
        'status' => 'draft',
    ])->assertRedirect();

    tenancy()->initialize($tenant);
    $deal = DealAnalysis::query()->where('title', 'With snapshot')->firstOrFail();
    expect(data_get($deal->metrics, 'calculator_last.outputs.roi_pct'))->toBe(7.5);
    tenancy()->end();
});
