<?php

declare(strict_types=1);

use App\Models\Central\PlatformUser;

it('platform health widget renders on ops console for platform admin', function (): void {
    $admin = PlatformUser::factory()->admin()->create();
    $response = $this->actingAs($admin, 'platform')->get('/filament');
    $response->assertOk();
});

it('platform health widget does not expose widget to guests', function (): void {
    $response = $this->get('/filament');
    $response->assertRedirect();
});
