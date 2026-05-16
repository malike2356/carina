<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\CarinaConversation;
use App\Models\Tenant\DealAnalysis;
use App\Models\Tenant\User;
use App\Services\Carina\CarinaService;
use App\Services\Deals\DealSourcingDiligenceService;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', 'deal_engine')->update([
        'enabled' => true,
        'tenant_overrides' => null,
    ]);
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

it('renders the manual search hub', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Manual hub '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@manualhub.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($user, 'web')
        ->get('http://'.$host.'/deals/sourcing/manual-search')
        ->assertOk()
        ->assertSee('Capture centre', false)
        ->assertSee('PropertyData', false);
});

it('persists sourcing diligence on a deal and exposes it to Carina summary', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Diligence '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@diligence.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    $deal = DealAnalysis::query()->create([
        'property_id' => null,
        'created_by' => $user->id,
        'strategy' => 'brr',
        'title' => 'Row DD',
        'metrics' => ['asking_price' => 100000],
        'status' => 'draft',
    ]);
    $id = (int) $deal->id;
    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->put('http://'.$host.'/deals/'.$id.'/sourcing-diligence', [
        'quick_dd' => [
            'notes' => 'Quick pass OK on paper',
            'listing_url' => 'https://example.com/listing',
            'comparable_notes' => 'Two terraces sold at 95k',
            'rough_rehab_budget_gbp' => 15000,
            'investor_fit_notes' => 'Seeks BRR under 120k',
            'agent_contacted' => true,
        ],
        'viewing' => [
            'viewed_at' => '2026-05-01',
            'items' => [
                'damp' => ['status' => 'ok', 'notes' => 'Dry'],
                'roof_void' => ['status' => 'issue', 'notes' => 'Felt tired'],
            ],
        ],
    ])->assertRedirect();

    tenancy()->initialize($tenant);
    $deal->refresh();
    expect($deal->sourcing_diligence)->toBeArray()
        ->and(data_get($deal->sourcing_diligence, 'quick_dd.notes'))->toBe('Quick pass OK on paper')
        ->and(data_get($deal->sourcing_diligence, 'viewing.items.damp.status'))->toBe('ok');

    $summary = app(DealSourcingDiligenceService::class)->summaryForCarina($deal);
    expect($summary)->toBeString()->toContain('Quick pass')->toContain('Damp');

    $carina = app(CarinaService::class);
    $reflection = new ReflectionClass($carina);
    $method = $reflection->getMethod('buildSystemPrompt');
    $method->setAccessible(true);
    $conv = new CarinaConversation([
        'context_type' => 'deal',
        'context_id' => $deal->id,
    ]);
    $prompt = $method->invoke($carina, $conv, $user);
    expect($prompt)->toContain('Sourcing diligence');

    tenancy()->end();
});
