<?php

declare(strict_types=1);

use App\Models\Central\PlatformUser;

it('allows platform support staff to open the blade admin dashboard', function () {
    $support = PlatformUser::factory()->create([
        'role' => PlatformUser::ROLE_SUPPORT,
    ]);

    $this->actingAs($support, 'platform')
        ->get(route('admin.dashboard'))
        ->assertOk()
        ->assertSee('Support sign-in', false)
        ->assertSee('manage-platform-users', false);
});

it('denies platform support staff filament panel access when they are not ai-key admins', function () {
    $support = PlatformUser::factory()->create([
        'role' => PlatformUser::ROLE_SUPPORT,
    ]);

    $this->actingAs($support, 'platform')
        ->get('/filament')
        ->assertForbidden();
});
