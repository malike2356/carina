<?php

declare(strict_types=1);

use App\DemoData\Services\DemoDataService;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;

beforeEach(function (): void {
    tenancy()->end();
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

it('import endpoint returns 409 when demo data is already loaded', function (): void {
    $host = actingAsTenant();

    tenancy()->initialize(tenant());
    app(DemoDataService::class)->import('hmo_investor');
    tenancy()->end();

    $this->postJson(tenantHttpUrl($host, 'admin/demo-data/import'), ['profile' => 'btl_landlord'])
        ->assertStatus(409)
        ->assertJsonPath('ok', false);
});

it('remove endpoint returns 404 when no demo data exists', function (): void {
    $host = actingAsTenant();

    $this->postJson(tenantHttpUrl($host, 'admin/demo-data/remove'))
        ->assertStatus(404)
        ->assertJsonPath('ok', false);
});

it('status endpoint returns demo_loaded false on fresh tenant', function (): void {
    $host = actingAsTenant();

    $this->getJson(tenantHttpUrl($host, 'admin/demo-data/status'))
        ->assertOk()
        ->assertJsonPath('demo_loaded', false);
});

it('demo data index page loads for workspace admin', function (): void {
    $host = actingAsTenant();

    $this->get(tenantHttpUrl($host, 'admin/demo-data'))
        ->assertOk()
        ->assertSee('Demo Data', false)
        ->assertSee('Load this profile', false);
});
