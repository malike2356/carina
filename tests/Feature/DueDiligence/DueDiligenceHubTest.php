<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Central\Tenant;
use App\Models\Tenant\DueDiligenceSnapshot;
use App\Models\Tenant\TenantSetting;
use App\Models\Tenant\User;
use App\Jobs\Deals\RunDueDiligenceFetchJob;
use App\Services\Deals\DueDiligenceFetchRunStore;
use App\Services\Deals\PropertyDueDiligenceService;
use App\Support\Integrations\PropertyDataCredentialResolver;
use App\Services\Onboarding\WorkspaceOnboardingService;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Illuminate\Support\Facades\Bus;

beforeEach(function (): void {
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

/**
 * @return array{0: Tenant, 1: string, 2: User}
 */
function ddHubTenantHostUser(): array
{
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'DD Hub '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'dd-hub-'.uniqid().'@example.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    TenantSetting::query()->updateOrCreate(
        ['key' => WorkspaceOnboardingService::SETTINGS_KEY],
        ['value' => json_encode([
            'completed_at' => now()->toIso8601String(),
            'onboarding_version' => 2,
            'max_unlocked_step' => WorkspaceOnboardingService::TOTAL_STEPS,
            'workspace' => ['display_name' => 'DD Hub Co'],
            'strategy' => ['primary' => 'btl', 'target_postcodes_raw' => ''],
            'profile' => ['name' => 'Owner', 'phone' => null],
            'preferences' => ['timezone' => 'Europe/London'],
            'preferences_skipped' => false,
        ]), 'group' => 'onboarding']
    );
    $user = User::query()->firstOrFail();
    tenancy()->end();

    return [$tenant, $host, $user];
}

function enableDealEngineForDdHub(): void
{
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', 'deal_engine')->update(['enabled' => true]);
}

it('due diligence hub index renders', function (): void {
    [, $host, $user] = ddHubTenantHostUser();
    enableDealEngineForDdHub();
    $this->actingAs($user, 'web');

    $response = $this->get('http://'.$host.'/due-diligence');

    $response->assertOk();
    $response->assertViewIs('tenant.due-diligence.index');
});

it('fetch endpoint returns helpful message when PropertyData key is missing', function (): void {
    [, $host, $user] = ddHubTenantHostUser();
    enableDealEngineForDdHub();
    $this->actingAs($user, 'web');

    $resolver = Mockery::mock(PropertyDataCredentialResolver::class);
    $resolver->shouldReceive('resolveEffectiveKey')->andReturn('');
    $resolver->shouldReceive('platformKeyConfigured')->andReturn(false);
    $this->app->instance(PropertyDataCredentialResolver::class, $resolver);

    $response = $this->postJson('http://'.$host.'/due-diligence/fetch', [
        'postcode' => 'PO2 0AH',
        'bedrooms' => 2,
        'property_type' => 'flat',
    ]);

    $response->assertStatus(422)
        ->assertJsonPath('code', 'propertydata_key_missing')
        ->assertJsonFragment(['message' => 'PropertyData API key is not configured. Add your key under Settings > API Keys, then try again.']);
});

it('fetch endpoint validates postcode required', function (): void {
    [, $host, $user] = ddHubTenantHostUser();
    enableDealEngineForDdHub();
    $this->actingAs($user, 'web');

    $response = $this->postJson('http://'.$host.'/due-diligence/fetch', []);

    $response->assertStatus(422);
    $response->assertJsonValidationErrors(['postcode']);
});

it('fetch endpoint returns core bundle inline when PropertyData succeeds', function (): void {
    [, $host, $user] = ddHubTenantHostUser();
    enableDealEngineForDdHub();
    $this->actingAs($user, 'web');

    config(['services.propertydata.key' => 'test-pd-key']);

    $mock = Mockery::mock(\App\Services\Deals\DueDiligenceFetchExecutor::class);
    $mock->shouldReceive('execute')->once()->andReturn([
        'bundle' => [
            'status' => 'success',
            'postcode' => 'PO20AH',
            'sections' => [],
            'epc' => ['configured' => false, 'certificate' => null],
        ],
        'geo' => null,
        'workspace_listings' => null,
    ]);
    $this->app->instance(\App\Services\Deals\DueDiligenceFetchExecutor::class, $mock);

    $this->postJson('http://'.$host.'/due-diligence/fetch', [
        'postcode' => 'PO2 0AH',
        'bedrooms' => 2,
        'property_type' => 'flat',
        'scan_mode' => 'core',
    ])
        ->assertOk()
        ->assertJsonPath('status', 'completed')
        ->assertJsonPath('bundle.status', 'success');
});

it('fetch endpoint queues a background run for full scan', function (): void {
    Bus::fake();

    [, $host, $user] = ddHubTenantHostUser();
    enableDealEngineForDdHub();
    $this->actingAs($user, 'web');

    config(['services.propertydata.key' => 'test-pd-key']);

    $this->postJson('http://'.$host.'/due-diligence/fetch', [
        'postcode' => 'SW1A 2AA',
        'bedrooms' => 2,
        'property_type' => 'flat',
        'scan_mode' => 'full',
    ])
        ->assertOk()
        ->assertJsonPath('status', 'pending')
        ->assertJsonStructure(['run_id']);

    Bus::assertDispatched(RunDueDiligenceFetchJob::class);
});

it('fetch status returns completed bundle from run store', function (): void {
    [, $host, $user] = ddHubTenantHostUser();
    enableDealEngineForDdHub();
    $this->actingAs($user, 'web');

    $store = app(DueDiligenceFetchRunStore::class);
    $created = $store->create($user->id, ['postcode' => 'PO20AH', 'scan_mode' => 'full']);
    $runId = $created['run_id'];

    $store->markCompleted($runId, [
        'bundle' => ['status' => 'success', 'postcode' => 'PO20AH', 'sections' => []],
        'geo' => null,
        'workspace_listings' => null,
    ]);

    $this->getJson('http://'.$host.'/due-diligence/fetch/'.$runId)
        ->assertOk()
        ->assertJsonPath('status', 'completed')
        ->assertJsonPath('bundle.status', 'success');
});

it('save snapshot persists to database', function (): void {
    [, $host, $user] = ddHubTenantHostUser();
    enableDealEngineForDdHub();
    $this->actingAs($user, 'web');

    $mock = Mockery::mock(PropertyDueDiligenceService::class);
    $mock->shouldReceive('fetch')->once()->andReturn([
        'status' => 'success',
        'postcode' => 'E1W1AB',
        'inputs' => [],
        'fetched_at' => now()->toIso8601String(),
        'sections' => [],
        'epc' => ['configured' => false, 'certificate' => null],
    ]);
    $mock->shouldReceive('epcIsConfigured')->andReturn(false);
    $this->app->instance(PropertyDueDiligenceService::class, $mock);

    $response = $this->postJson('http://'.$host.'/due-diligence/snapshot', [
        'postcode' => 'E1W 1AB',
        'bedrooms' => 3,
        'property_type' => 'terraced',
    ]);

    $response->assertOk();
    $response->assertJsonStructure(['snapshot_id', 'saved_at']);

    tenancy()->initialize(Tenant::query()->whereHas('domains', fn ($q) => $q->where('domain', explode('.', $host)[0]))->firstOrFail());
    $this->assertDatabaseHas('due_diligence_snapshots', ['postcode' => 'E1W1AB']);
    tenancy()->end();
});

it('snapshot is user-scoped - other user cannot view', function (): void {
    [, $host, $owner] = ddHubTenantHostUser();
    enableDealEngineForDdHub();

    tenancy()->initialize(Tenant::query()->whereHas('domains', fn ($q) => $q->where('domain', explode('.', $host)[0]))->firstOrFail());
    $snap = DueDiligenceSnapshot::factory()->create(['created_by' => $owner->id]);
    $other = User::factory()->create();
    tenancy()->end();

    $this->actingAs($other, 'web');
    $response = $this->getJson('http://'.$host.'/due-diligence/snapshot/'.$snap->id);
    $response->assertForbidden();
});

it('owner can delete own snapshot', function (): void {
    [, $host, $user] = ddHubTenantHostUser();
    enableDealEngineForDdHub();

    tenancy()->initialize(Tenant::query()->whereHas('domains', fn ($q) => $q->where('domain', explode('.', $host)[0]))->firstOrFail());
    $snap = DueDiligenceSnapshot::factory()->create(['created_by' => $user->id]);
    tenancy()->end();

    $this->actingAs($user, 'web');
    $response = $this->deleteJson('http://'.$host.'/due-diligence/snapshot/'.$snap->id);
    $response->assertOk();

    tenancy()->initialize(Tenant::query()->whereHas('domains', fn ($q) => $q->where('domain', explode('.', $host)[0]))->firstOrFail());
    $this->assertDatabaseMissing('due_diligence_snapshots', ['id' => $snap->id]);
    tenancy()->end();
});

it('DueDiligenceSnapshot factory creates valid record', function (): void {
    [, $host, $user] = ddHubTenantHostUser();

    tenancy()->initialize(Tenant::query()->whereHas('domains', fn ($q) => $q->where('domain', explode('.', $host)[0]))->firstOrFail());
    $snap = DueDiligenceSnapshot::factory()->create(['created_by' => $user->id, 'postcode' => 'M11AE']);
    expect($snap->postcode)->toBe('M11AE');
    expect($snap->created_by)->toBe($user->id);
    tenancy()->end();
});
