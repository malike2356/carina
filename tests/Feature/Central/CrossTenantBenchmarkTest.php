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
        ->getJson(route('admin.analytics.cross-tenant-benchmark'))
        ->assertOk()
        ->assertJson([
            'ok' => false,
            'reason' => 'below_minimum_cohort',
        ]);
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
        ->getJson(route('admin.analytics.cross-tenant-benchmark'));

    $response->assertOk()
        ->assertJsonPath('ok', true)
        ->assertJsonPath('disclaimer', '[Analysis based on anonymised aggregated data. No individual tenant data has been used.]');

    $rows = $response->json('rows');
    expect($rows)->toBeArray()->not->toBeEmpty();

    foreach ($rows as $row) {
        expect($row)->not->toHaveKey('company_name')
            ->not->toHaveKey('owner_email')
            ->not->toHaveKey('owner_name')
            ->and($row)->toHaveKey('plan')
            ->and($row)->toHaveKey('is_active');
    }
});
