<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Central\PlatformUser;

it('renders the v1 migration status admin page for html requests', function () {
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'v1_data_migration_tools')->update(['enabled' => true]);

    $superAdmin = PlatformUser::factory()->superAdmin()->create();

    $this->withServerVariables(['HTTP_HOST' => 'propreneur.test'])
        ->actingAs($superAdmin, 'platform')
        ->withHeaders(['Accept' => 'text/html'])
        ->get(route('admin.migration.status'))
        ->assertOk()
        ->assertSee('v1 to v2 data migration', false)
        ->assertSee('Recent migration logs', false)
        ->assertSee('Run migration', false)
        ->assertSee('v1 migration', false)
        ->assertSee('Console', false);

    FeatureFlag::query()->where('key', 'v1_data_migration_tools')->update(['enabled' => false]);
});
