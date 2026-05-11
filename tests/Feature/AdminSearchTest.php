<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Central\PlatformUser;
use App\Models\Central\Tenant;
use Illuminate\Support\Str;

beforeEach(function () {
    $this->superAdmin = PlatformUser::factory()->superAdmin()->create();
});

it('returns matching platform users on admin search', function () {
    PlatformUser::factory()->admin()->create([
        'name' => 'Elliot UniqueFinder',
        'email' => 'elliot@uniquefinder.test',
    ]);

    $this->actingAs($this->superAdmin, 'platform')
        ->getJson(route('admin.search', ['q' => 'UniqueFinder']))
        ->assertOk()
        ->assertJsonFragment(['title' => 'Elliot UniqueFinder']);
});

it('returns matching tenants on admin search', function () {
    $tenant = Tenant::withoutEvents(fn () => Tenant::query()->create([
        'id' => (string) Str::uuid(),
        'slug' => 'unique-tenant-search',
        'company_name' => 'Unique Tenant Foods Ltd',
        'owner_name' => 'Owner',
        'owner_email' => 'owner@uniquetenant.test',
        'plan' => 'starter',
        'is_active' => true,
        'trial_ends_at' => now()->addDays(14),
    ]));

    $tenant->domains()->create(['domain' => 'unique-tenant-search']);

    $this->actingAs($this->superAdmin, 'platform')
        ->getJson(route('admin.search', ['q' => 'Unique Tenant']))
        ->assertOk()
        ->assertJsonFragment(['title' => 'Unique Tenant Foods Ltd']);
});

it('rejects short queries', function () {
    $this->actingAs($this->superAdmin, 'platform')
        ->getJson(route('admin.search', ['q' => 'x']))
        ->assertStatus(422);
});

it('returns not found when platform admin search flag is disabled', function () {
    FeatureFlag::query()->where('key', 'platform_admin_search')->update(['enabled' => false]);

    try {
        $this->actingAs($this->superAdmin, 'platform')
            ->getJson(route('admin.search', ['q' => 'ab']))
            ->assertNotFound();
    } finally {
        FeatureFlag::query()->where('key', 'platform_admin_search')->update(['enabled' => true]);
    }
});
