<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\DealAnalysis;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', 'deal_engine')->update(['enabled' => true, 'tenant_overrides' => null]);
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

it('records a price reduction on a deal', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Timing Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@timing.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    $deal = DealAnalysis::query()->create([
        'property_id' => null,
        'created_by' => $user->id,
        'strategy' => 'btl',
        'title' => 'Timing',
        'metrics' => [],
        'status' => 'draft',
    ]);
    tenancy()->end();

    $this->actingAs($user, 'web');
    $this->post('http://'.$host.'/deals/'.$deal->id.'/price-reduction', [
        'reduced_on' => '2026-03-01',
        'from_price' => 250000,
        'to_price' => 235000,
    ])->assertRedirect();

    tenancy()->initialize($tenant);
    $fresh = DealAnalysis::query()->findOrFail($deal->id);
    $rows = $fresh->price_reductions;
    expect($rows)->toHaveCount(1)
        ->and((int) $rows[0]['from'])->toBe(250000)
        ->and((int) $rows[0]['to'])->toBe(235000);
    tenancy()->end();
});

it('rejects price reduction when to is not less than from', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Timing Bad '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@timing-bad.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    $deal = DealAnalysis::query()->create([
        'property_id' => null,
        'created_by' => $user->id,
        'strategy' => 'btl',
        'title' => 'Bad reduction',
        'metrics' => [],
        'status' => 'draft',
    ]);
    tenancy()->end();

    $this->actingAs($user, 'web');
    $this->post('http://'.$host.'/deals/'.$deal->id.'/price-reduction', [
        'reduced_on' => now()->format('Y-m-d'),
        'from_price' => 200000,
        'to_price' => 210000,
    ])->assertSessionHasErrors('to_price');
});
