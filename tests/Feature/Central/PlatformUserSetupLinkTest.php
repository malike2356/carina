<?php

declare(strict_types=1);

use App\Models\Central\PlatformUser;
use App\Notifications\PlatformResetPassword;
use Illuminate\Support\Facades\Notification;

it('admin can send password setup link to platform user', function (): void {
    Notification::fake();

    $admin = PlatformUser::factory()->superAdmin()->create();
    $target = PlatformUser::factory()->create(['email' => 'setup-'.uniqid().'@platform.test']);

    $this->actingAs($admin, 'platform')
        ->post(route('admin.users.send-setup-link', $target))
        ->assertRedirect()
        ->assertSessionHas('success');

    Notification::assertSentTo($target, PlatformResetPassword::class);
});
