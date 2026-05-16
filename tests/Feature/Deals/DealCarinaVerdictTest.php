<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\DealAnalysis;
use App\Models\Tenant\User;
use App\Services\Carina\CarinaService;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', 'deal_engine')->update(['enabled' => true, 'tenant_overrides' => null]);
    FeatureFlag::query()->where('key', 'carina_ai')->update(['enabled' => true, 'tenant_overrides' => null]);
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

it('stores a Carina verdict via POST', function (): void {
    $this->mock(CarinaService::class, function ($mock): void {
        $mock->shouldReceive('generateDealVerdict')->once()->andReturn([
            'recommendation' => 'buy',
            'confidence' => 80,
            'key_reasons' => ['a', 'b', 'c'],
            'risks' => ['x', 'y'],
        ]);
    });

    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Verdict Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@verdict.test',
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
        'title' => 'Verdict target',
        'metrics' => ['roi' => 7],
        'status' => 'draft',
    ]);
    tenancy()->end();

    $this->actingAs($user, 'web');
    $this->postJson('http://'.$host.'/deals/'.$deal->id.'/carina-verdict')
        ->assertOk()
        ->assertJsonPath('verdict.recommendation', 'buy');

    tenancy()->initialize($tenant);
    expect(DealAnalysis::query()->find($deal->id)?->carina_verdict)->not->toBeNull();
    tenancy()->end();
});
