<?php

declare(strict_types=1);

use App\Models\Central\PlatformUser;

it('tenant stats widget renders on ops console without throwing', function (): void {
    $admin = PlatformUser::factory()->admin()->create();

    $response = $this->actingAs($admin, 'platform')->get('/filament');

    $response->assertOk();
});
