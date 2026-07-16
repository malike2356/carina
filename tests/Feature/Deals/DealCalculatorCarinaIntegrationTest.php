<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\CarinaConversation;
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

it('opens Carina from a deal calculator slug with metadata', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Calc Carina Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@calc-carina.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($user, 'web');

    expect(FeatureFlag::query()->where('key', 'carina_ai')->exists())->toBeTrue()
        ->and(FeatureFlag::isEnabled('carina_ai', (string) $tenant->id))->toBeTrue();

    $r = $this->get('http://'.$host.'/carina/open-deal-calculator/btl');
    $r->assertRedirect();

    tenancy()->initialize($tenant);
    $conv = CarinaConversation::query()->latest('id')->first();
    expect($conv)->not->toBeNull()
        ->and($conv->context_type)->toBe('deal_calculator')
        ->and($conv->context_id)->toBeNull()
        ->and($conv->metadata['deal_calculator_slug'] ?? null)->toBe('btl')
        ->and($conv->metadata['deal_calculator_kind'] ?? null)->toBe('strategy')
        ->and($conv->metadata['brain_key'] ?? null)->toBe('investor');
    tenancy()->end();
});

it('posts open deal calculator with JSON snapshot and returns redirect', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Calc Carina Post '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@calc-carina-post.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($user, 'web');

    $snapshot = json_encode([
        'strategy' => 'dscr',
        'outputs' => ['dscr' => 1.3],
        'applied_at' => '2026-05-02T12:00:00.000Z',
    ]);

    $res = $this->postJson('http://'.$host.'/carina/open-deal-calculator', [
        'strategy' => 'dscr',
        'calculator_last' => $snapshot,
    ]);

    $res->assertOk();
    $payload = $res->json();
    expect($payload['redirect'] ?? '')->toContain('/carina/conversations/');

    tenancy()->initialize($tenant);
    $conv = CarinaConversation::query()->latest('id')->first();
    expect($conv->context_type)->toBe('deal_calculator')
        ->and($conv->metadata['deal_calculator_slug'] ?? null)->toBe('dscr')
        ->and($conv->metadata['deal_calculator_kind'] ?? null)->toBe('tool')
        ->and(data_get($conv->metadata, 'playground_last_run.outputs.dscr'))->toBe(1.3);
    tenancy()->end();
});

it('returns 404 for unknown calculator slug', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Calc Carina 404 '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@calc-carina-404.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->get('http://'.$host.'/carina/open-deal-calculator/not-a-real-slug')->assertNotFound();
});
