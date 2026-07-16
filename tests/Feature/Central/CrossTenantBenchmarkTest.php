<?php

declare(strict_types=1);

use App\Models\Central\PlatformUser;

beforeEach(function (): void {
    $this->superAdmin = PlatformUser::factory()->superAdmin()->create();
    $this->platformAdmin = PlatformUser::factory()->admin()->create();
});

it('returns 403 for non-super platform admins', function (): void {
    $this->actingAs($this->platformAdmin, 'platform')
        ->getJson(route('admin.analytics.cross-tenant-benchmark'))
        ->assertForbidden();
});

it('returns below_minimum_cohort when fewer than five active tenants exist', function (): void {
    createCentralTenant(['slug' => 'bench-one', 'is_active' => true]);

    $this->actingAs($this->superAdmin, 'platform')
        ->get(route('admin.analytics.cross-tenant-benchmark'))
        ->assertOk()
        ->assertSee('Cohort size below minimum')
        ->assertSee('Cross-tenant benchmark');
});

it('returns anonymised cohort rows for five or more active tenants', function (): void {
    for ($i = 0; $i < 5; $i++) {
        createCentralTenant([
            'slug' => 'bench-'.$i.'-'.uniqid(),
            'is_active' => true,
            'company_name' => 'Secret Co '.$i,
            'owner_email' => "secret{$i}@example.test",
        ]);
    }

    $response = $this->actingAs($this->superAdmin, 'platform')
        ->get(route('admin.analytics.cross-tenant-benchmark'));

    $response->assertOk()
        ->assertDontSee('Secret Co')
        ->assertDontSee('secret0@example.test')
        ->assertSee('total_workspaces')
        ->assertSee('plan')
        ->assertSee('is_active');
});
