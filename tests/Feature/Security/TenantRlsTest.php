<?php

declare(strict_types=1);

use App\Http\Middleware\TenantRlsMiddleware;
use App\Models\Central\Subscription;
use App\Models\Central\Tenant;
use App\Services\Security\TenantConnectionAssertionService;
use App\Services\Tenancy\TenantCreationService;
use App\Support\TestingCentralCatalog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Tests\Concerns\BypassesRlsForTests;

uses(BypassesRlsForTests::class);

function setRlsTenantId(?string $tenantId): void
{
    $connections = ['central'];
    $metadata = TestingCentralCatalog::tenantMetadataConnectionInTests();
    if ($metadata !== null) {
        $connections[] = $metadata;
    }

    foreach (array_unique($connections) as $connection) {
        DB::connection($connection)->statement(
            "SELECT set_config('app.current_tenant_id', ?, false)",
            [$tenantId ?? '']
        );
    }
}

function createSubscriptionForTenant(Tenant $tenant, string $plan = 'starter'): Subscription
{
    return Subscription::query()->create([
        'tenant_id' => $tenant->id,
        'plan' => $plan,
        'status' => 'active',
    ]);
}

it('returns only the current tenant subscriptions when app.current_tenant_id is set', function (): void {
    $tenantA = createCentralTenant();
    $tenantB = createCentralTenant();

    $this->bypassRls();
    createSubscriptionForTenant($tenantA, 'starter');
    createSubscriptionForTenant($tenantB, 'growth');

    setRlsTenantId($tenantA->id);

    $visible = Subscription::query()
        ->whereIn('tenant_id', [$tenantA->id, $tenantB->id])
        ->pluck('tenant_id')
        ->unique()
        ->values()
        ->all();

    expect($visible)->toBe([$tenantA->id]);
});

it('returns all subscriptions when no tenant session variable is set', function (): void {
    $tenantA = createCentralTenant();
    $tenantB = createCentralTenant();

    $this->bypassRls();
    createSubscriptionForTenant($tenantA);
    createSubscriptionForTenant($tenantB);

    setRlsTenantId(null);

    expect(Subscription::query()->count())->toBeGreaterThanOrEqual(2);
});

it('does not throw assertTenantConnection when tenant matches', function (): void {
    $tenant = createCentralTenant();
    tenancy()->initialize($tenant);

    app(TenantConnectionAssertionService::class)->assertTenantConnection($tenant->id);

    tenancy()->end();
})->throwsNoExceptions();

it('throws assertTenantConnection on tenant mismatch in testing', function (): void {
    $tenantA = app(TenantCreationService::class)->createTenant([
        'company_name' => 'RLS Assert A '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@rls-assert-a.test',
        'plan' => 'starter',
    ]);
    $tenantB = createCentralTenant();

    tenancy()->initialize($tenantA);

    try {
        app(TenantConnectionAssertionService::class)->assertTenantConnection($tenantB->id);
    } finally {
        tenancy()->end();
    }
})->throws(RuntimeException::class);

it('sets and clears app.current_tenant_id around tenant middleware', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'RLS Middleware '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@rls.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);

    $middleware = app(TenantRlsMiddleware::class);
    $request = Request::create('/dashboard', 'GET');

    $metadataConn = TestingCentralCatalog::tenantMetadataConnectionInTests() ?? 'central';

    $middleware->handle($request, function () use ($tenant, $metadataConn) {
        $row = DB::connection($metadataConn)->selectOne(
            "SELECT current_setting('app.current_tenant_id', true) AS tenant_id"
        );

        expect($row->tenant_id)->toBe($tenant->id);

        return response('ok');
    });

    $cleared = DB::connection($metadataConn)->selectOne(
        "SELECT current_setting('app.current_tenant_id', true) AS tenant_id"
    );

    expect($cleared->tenant_id)->toBeIn([null, '']);

    tenancy()->end();
});
