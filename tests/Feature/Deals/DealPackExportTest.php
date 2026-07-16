<?php

declare(strict_types=1);

use App\Models\Central\DealShareToken;
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

it('downloads a PDF deal pack', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Pack Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@pack.test',
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
        'title' => 'Pack Deal PDF',
        'metrics' => ['purchase_price' => 180000],
        'status' => 'draft',
    ]);
    tenancy()->end();

    $this->actingAs($user, 'web');
    $response = $this->get('http://'.$host.'/deals/'.$deal->id.'/export-pack');
    $response->assertOk();
    $ctype = strtolower((string) $response->headers->get('content-type'));
    expect(str_contains($ctype, 'application/pdf'))->toBeTrue();
});

it('creates a central share token row and exposes a public pack', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Share Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@share.test',
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
        'title' => 'Public pack title',
        'metrics' => [],
        'status' => 'draft',
    ]);
    tenancy()->end();

    $this->actingAs($user, 'web');
    $this->post('http://'.$host.'/deals/'.$deal->id.'/share-token')->assertRedirect();

    tenancy()->initialize($tenant);
    $token = DealAnalysis::query()->find($deal->id)?->share_token;
    expect($token)->not->toBeNull();
    tenancy()->end();

    expect(DealShareToken::query()->where('token', $token)->count())->toBe(1);

    $this->get(route('deals.public-pack', ['token' => $token]))
        ->assertOk()
        ->assertSee('Public pack title', false);
});
