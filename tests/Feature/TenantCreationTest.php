<?php

declare(strict_types=1);

use App\Models\Central\Domain;
use App\Models\Central\Tenant;
use App\Models\Tenant\TenantRole;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Stancl\Tenancy\TenantDatabaseManagers\PostgreSQLDatabaseManager;
use Tests\Support\ThrowingPostgreSQLDatabaseManager;

beforeEach(function () {
    $this->service = app(TenantCreationService::class);
});

function tenantCreationPayload(): array
{
    $label = Str::lower(Str::random(10));

    return [
        'company_name' => 'Acme Property Ltd '.$label,
        'owner_name' => 'Jane Owner',
        'owner_email' => 'jane+'.$label.'@acme-properties.test',
        'plan' => 'starter',
    ];
}

it('creates a tenant record with required columns', function () {
    $payload = tenantCreationPayload();
    $tenant = $this->service->createTenant($payload);

    $expectedSlug = Str::slug($payload['company_name']);

    expect($tenant->slug)->toBe($expectedSlug)
        ->and($tenant->plan)->toBe('starter')
        ->and($tenant->owner_email)->toBe($payload['owner_email']);

    expect(Domain::query()->where('tenant_id', $tenant->id)->where('domain', $tenant->slug)->exists())->toBeTrue();
});

it('provisions a separate database for the tenant', function () {
    $tenant = $this->service->createTenant(tenantCreationPayload());

    $dbName = $tenant->database()->getName();

    expect($dbName)->toStartWith('propreneur_t_');

    $rows = DB::connection('tenant_template')
        ->select('select 1 from pg_database where datname = ?', [$dbName]);

    expect($rows)->not->toBeEmpty();
});

it('seeds default roles into the tenant database', function () {
    $tenant = $this->service->createTenant(tenantCreationPayload());

    tenancy()->initialize($tenant);

    try {
        expect(TenantRole::query()->where('name', 'tenant_admin')->where('guard_name', 'web')->exists())->toBeTrue()
            ->and(TenantRole::query()->where('name', 'mentor')->where('guard_name', 'web')->exists())->toBeTrue()
            ->and(TenantRole::query()->where('name', 'mentee')->where('guard_name', 'web')->exists())->toBeTrue();
    } finally {
        tenancy()->end();
    }
});

it('marks the tenant as inactive when trial has expired', function () {
    $tenant = Tenant::withoutEvents(fn () => Tenant::query()->create([
        'id' => (string) Str::uuid(),
        'slug' => 'past-trial',
        'company_name' => 'Past Trial Ltd',
        'owner_name' => 'Owner',
        'owner_email' => 'owner@past-trial.test',
        'plan' => 'starter',
        'is_active' => true,
        'trial_ends_at' => now()->subDay(),
    ]));

    $tenant->domains()->create(['domain' => 'past-trial']);

    expect($tenant->fresh()->isActive())->toBeFalse();
});

it('rolls back central record if database provisioning fails', function () {
    config([
        'tenancy.database.managers.pgsql' => ThrowingPostgreSQLDatabaseManager::class,
    ]);

    try {
        expect(fn () => $this->service->createTenant([
            'company_name' => 'Rollback Co',
            'owner_name' => 'Owner',
            'owner_email' => 'owner@rollback.test',
            'plan' => 'starter',
        ]))->toThrow(RuntimeException::class);
    } finally {
        config([
            'tenancy.database.managers.pgsql' => PostgreSQLDatabaseManager::class,
        ]);
    }

    expect(Tenant::query()->where('slug', 'rollback-co')->exists())->toBeFalse();
});
