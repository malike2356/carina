<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\DealAnalysis;
use App\Models\Tenant\Document;
use App\Models\Tenant\User;
use App\Services\Carina\CarinaService;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', 'deal_engine')->update(['enabled' => true, 'tenant_overrides' => null]);
    FeatureFlag::query()->where('key', 'document_vault')->update(['enabled' => true, 'tenant_overrides' => null]);
    FeatureFlag::query()->where('key', 'carina_ai')->update(['enabled' => true, 'tenant_overrides' => null]);
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

it('generates a deal pack document in the vault', function (): void {
    Http::preventStrayRequests();
    Storage::fake('local');

    $this->mock(CarinaService::class, function ($mock): void {
        $mock->shouldReceive('generateDealPackNarrative')->once()->andReturn([
            'executive_summary' => 'Summary text for investors.',
            'strategy_analysis' => 'Strategy detail.',
            'market_context' => 'Market note.',
        ]);
    });

    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Pack Gen '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@pack-gen.test',
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
        'title' => 'Pack Gen Deal',
        'metrics' => ['purchase_price' => 220000, 'gross_yield' => 6.5],
        'status' => 'draft',
    ]);
    tenancy()->end();

    $this->actingAs($user, 'web');
    $response = $this->postJson('http://'.$host.'/deals/'.$deal->id.'/pack/generate');
    $response->assertOk()->assertJsonStructure(['document_id', 'download_url', 'title']);

    tenancy()->initialize($tenant);
    $doc = Document::query()->find($response->json('document_id'));
    expect($doc)->not->toBeNull();
    expect($doc->category)->toBe('deal_pack');
    expect((int) $doc->deal_analysis_id)->toBe((int) $deal->id);
    expect(Storage::disk('local')->exists($doc->file_path))->toBeTrue();
    tenancy()->end();
});

it('returns 422 when deal has no calculator outputs', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Pack Empty '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@pack-empty.test',
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
        'title' => 'Empty metrics deal',
        'metrics' => [],
        'status' => 'draft',
    ]);
    tenancy()->end();

    $this->actingAs($user, 'web');
    $this->postJson('http://'.$host.'/deals/'.$deal->id.'/pack/generate')
        ->assertStatus(422);
});

it('downloads a stored deal pack for the deal', function (): void {
    Http::preventStrayRequests();
    Storage::fake('local');

    $this->mock(CarinaService::class, function ($mock): void {
        $mock->shouldReceive('generateDealPackNarrative')->once()->andReturn([
            'executive_summary' => 'A',
            'strategy_analysis' => 'B',
            'market_context' => 'C',
        ]);
    });

    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Pack DL '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@pack-dl.test',
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
        'title' => 'Download pack deal',
        'metrics' => ['roi' => 12],
        'status' => 'draft',
    ]);
    tenancy()->end();

    $this->actingAs($user, 'web');
    $gen = $this->postJson('http://'.$host.'/deals/'.$deal->id.'/pack/generate')->assertOk();
    $docId = (int) $gen->json('document_id');

    $download = $this->get('http://'.$host.'/deals/'.$deal->id.'/pack/'.$docId);
    $download->assertOk();
    $ctype = strtolower((string) $download->headers->get('content-type'));
    expect(str_contains($ctype, 'application/pdf') || str_contains($ctype, 'octet-stream'))->toBeTrue();
});

it('generates a data-only pack when Carina narrative is not called', function (): void {
    Http::preventStrayRequests();
    Storage::fake('local');

    $this->mock(CarinaService::class, function ($mock): void {
        $mock->shouldNotReceive('generateDealPackNarrative');
    });

    FeatureFlag::query()->where('key', 'carina_ai')->update(['enabled' => false]);

    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Pack No AI '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@pack-no-ai.test',
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
        'title' => 'No AI pack',
        'metrics' => ['purchase_price' => 150000],
        'status' => 'draft',
    ]);
    tenancy()->end();

    $this->actingAs($user, 'web');
    $this->postJson('http://'.$host.'/deals/'.$deal->id.'/pack/generate')->assertOk();
});
