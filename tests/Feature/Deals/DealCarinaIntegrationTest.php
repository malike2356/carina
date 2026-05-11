<?php

declare(strict_types=1);

/**
 * Carina + deal integration (tenant HTTP).
 *
 * Docs: brain/knowledge/04-deals.md ("Carina chat scoped to a deal").
 * Route names: tests/Unit/Carina/CarinaModuleRoutesTest.php
 *
 * One sequential POST `it()` avoids parallel workers corrupting a shared testing database.
 * Tenant HTTP calls must use absolute URLs so subdomain tenancy initializes (see DealCalculatorCarinaIntegrationTest).
 */
use App\Models\Central\FeatureFlag;
use App\Models\Tenant\CarinaConversation;
use App\Models\Tenant\DealAnalysis;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', 'carina_ai')->update(['enabled' => true, 'tenant_overrides' => null]);
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

it('integrates Carina with deals via POST and cross-user rules', function (): void {
    $service = app(TenantCreationService::class);

    $tenantA = $service->createTenant([
        'company_name' => 'Carina Deal Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@carina-deal.test',
        'plan' => 'starter',
    ]);
    $hostA = $tenantA->domains->first()->domain.'.propreneur.test';
    tenancy()->initialize($tenantA);
    $userA = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    $dealPost = DealAnalysis::query()->create([
        'property_id' => null,
        'created_by' => $userA->id,
        'strategy' => 'btl',
        'title' => 'Bridge Street BTL',
        'metrics' => ['roi' => 6.5],
        'status' => 'draft',
    ]);
    tenancy()->end();
    $this->actingAs($userA, 'web');
    $this->post('http://'.$hostA.'/carina/conversations', [
        'context_type' => 'deal',
        'context_id' => $dealPost->id,
    ])->assertRedirect();
    tenancy()->initialize($tenantA);
    $convPost = CarinaConversation::query()->latest('id')->first();
    expect($convPost)->not->toBeNull()
        ->and($convPost->context_type)->toBe('deal')
        ->and((int) $convPost->context_id)->toBe($dealPost->id)
        ->and($convPost->user_id)->toBe($userA->id)
        ->and($convPost->metadata['brain_key'] ?? null)->toBe('investor');
    tenancy()->end();

    $tenantC = $service->createTenant([
        'company_name' => 'Carina Iso '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@carina-iso-deal.test',
        'plan' => 'starter',
    ]);
    $hostC = $tenantC->domains->first()->domain.'.propreneur.test';
    tenancy()->initialize($tenantC);
    $ownerC = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    $intruderC = User::factory()->create(['name' => 'Intruder']);
    $dealSecret = DealAnalysis::query()->create([
        'property_id' => null,
        'created_by' => $ownerC->id,
        'strategy' => 'btl',
        'title' => 'Secret',
        'metrics' => [],
        'status' => 'draft',
    ]);
    tenancy()->end();
    $this->actingAs($intruderC, 'web');
    $this->post('http://'.$hostC.'/carina/conversations', [
        'context_type' => 'deal',
        'context_id' => $dealSecret->id,
        'title' => 'Hack',
    ])->assertNotFound();
});

it('redirects GET open-deal when host is set on the request', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Carina GET '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@carina-get.test',
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
        'title' => 'GET route deal',
        'metrics' => [],
        'status' => 'draft',
    ]);
    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->get('http://'.$host.'/carina/open-deal/'.$deal->id)->assertRedirect();
});
