<?php

declare(strict_types=1);

use App\Models\Central\Tenant;
use App\Services\Tenancy\TenantResolutionService;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

beforeEach(function () {
    $this->service = app(TenantResolutionService::class);
});

it('resolves tenant from a subdomain request', function () {
    $tenant = Tenant::withoutEvents(fn () => Tenant::query()->create([
        'id' => (string) Str::uuid(),
        'slug' => 'acme',
        'company_name' => 'Acme',
        'owner_name' => 'Owner',
        'owner_email' => 'owner@acme.test',
        'plan' => 'starter',
        'is_active' => true,
        'trial_ends_at' => now()->addDays(7),
    ]));

    $tenant->domains()->create(['domain' => 'acme']);

    $request = Request::create('http://acme.propreneur.test/dashboard', 'GET');

    $resolved = $this->service->getTenantFromRequest($request);

    expect($resolved)->not->toBeNull();
    expect($resolved->slug)->toBe('acme');
});

it('returns null for a central domain request', function () {
    $request = Request::create('http://propreneur.test/platform/login', 'GET');

    expect($this->service->getTenantFromRequest($request))->toBeNull();
});

it('returns null from getCurrentTenant when running in central context', function () {
    if (tenancy()->initialized) {
        tenancy()->end();
    }

    expect($this->service->getCurrentTenant())->toBeNull();
});

it('returns the active tenant from getCurrentTenant after initialization', function () {
    $tenant = Tenant::withoutEvents(fn () => Tenant::query()->create([
        'id' => (string) Str::uuid(),
        'slug' => 'init-test',
        'company_name' => 'Init Test',
        'owner_name' => 'Owner',
        'owner_email' => 'owner@init.test',
        'plan' => 'starter',
        'is_active' => true,
        'trial_ends_at' => now()->addDays(7),
    ]));

    $tenant->domains()->create(['domain' => 'init-test']);

    tenancy()->initialize($tenant);

    try {
        expect($this->service->getCurrentTenant()?->id)->toBe($tenant->id);
    } finally {
        tenancy()->end();
    }
});

it('identifies tenant requests correctly', function () {
    $tenantRequest = Request::create('http://acme.propreneur.test/login', 'GET');
    $centralRequest = Request::create('http://propreneur.test/', 'GET');

    expect($this->service->isTenantRequest($tenantRequest))->toBeTrue();
    expect($this->service->isTenantRequest($centralRequest))->toBeFalse();
});

it('aborts with 404 when subdomain has no matching domain record', function () {
    $this->get('http://unknown-tenant-xyz.propreneur.test/login')->assertStatus(404);
});
