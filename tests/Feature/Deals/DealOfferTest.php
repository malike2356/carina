<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\DealAnalysis;
use App\Models\Tenant\DealOffer;
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

it('stores and deletes deal offers', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Offer Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@offer.test',
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
        'title' => 'Offer deal',
        'metrics' => [],
        'status' => 'draft',
    ]);
    tenancy()->end();

    $this->actingAs($user, 'web');
    $this->post('http://'.$host.'/deals/'.$deal->id.'/offers', [
        'offer_type' => 'offer_made',
        'amount' => 185000,
        'offered_at' => '2026-01-15',
    ])->assertRedirect();

    tenancy()->initialize($tenant);
    expect(DealOffer::query()->where('deal_analysis_id', $deal->id)->count())->toBe(1);
    $offer = DealOffer::query()->where('deal_analysis_id', $deal->id)->firstOrFail();
    tenancy()->end();

    $this->delete('http://'.$host.'/deals/'.$deal->id.'/offers/'.$offer->id)->assertRedirect();

    tenancy()->initialize($tenant);
    expect(DealOffer::query()->where('deal_analysis_id', $deal->id)->count())->toBe(0);
    tenancy()->end();
});

it('allows optional from_party', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Offer Opt '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@offer-opt.test',
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
        'title' => 'Offer opt',
        'metrics' => [],
        'status' => 'draft',
    ]);
    tenancy()->end();

    $this->actingAs($user, 'web');
    $this->post('http://'.$host.'/deals/'.$deal->id.'/offers', [
        'offer_type' => 'counter_offer',
        'amount' => 170000,
        'offered_at' => '2026-02-01',
        'from_party' => null,
    ])->assertRedirect();
});
