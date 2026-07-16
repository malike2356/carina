<?php

declare(strict_types=1);

use App\Models\Central\PlatformUser;
use App\Notifications\PlatformResetPassword;
use Illuminate\Support\Facades\Notification;

it('shows platform forgot password form', function () {
    $this->get(route('central.password.request'))
        ->assertOk()
        ->assertSee('Reset platform password', false);
});

it('sends a reset notification for a platform user email', function () {
    Notification::fake();

    $user = PlatformUser::factory()->superAdmin()->create([
        'email' => 'reset-test@platform.example',
    ]);

    $this->post(route('central.password.email'), ['email' => $user->email])
        ->assertSessionHas('status');

    Notification::assertSentTo($user, PlatformResetPassword::class, function (PlatformResetPassword $notification) use ($user): bool {
        $mail = $notification->toMail($user);

        return str_contains((string) $mail->subject, 'Reset your')
            && is_array($mail->view)
            && ($mail->view['html'] ?? null) === 'mail.auth.reset-password-html';
    });
});
