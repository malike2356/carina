<?php

declare(strict_types=1);

use App\Models\Central\PlatformUser;

it('renders the feature flags admin page with theme-aware markup', function () {
    $user = PlatformUser::factory()->superAdmin()->create();

    $this->actingAs($user, 'platform')
        ->get(route('admin.flags.index'))
        ->assertOk()
        ->assertSee('Feature flags', false)
        ->assertSee('Sync catalogue', false)
        ->assertSee('PlatformFeatureCatalogue', false);
});
