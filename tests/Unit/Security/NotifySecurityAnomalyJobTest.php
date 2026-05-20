<?php

declare(strict_types=1);

use App\Jobs\Security\NotifySecurityAnomalyJob;
use App\Models\Central\PlatformUser;
use App\Models\Central\SecurityEvent;
use App\Notifications\Security\SecurityAnomalyNotification;
use Illuminate\Support\Facades\Notification;

it('sends mail to SECURITY_ALERT_EMAIL and database to super admins', function (): void {
    config(['security.alert_email' => 'security-ops@propreneur.test']);

    $admin = PlatformUser::factory()->superAdmin()->create();

    Notification::fake();

    (new NotifySecurityAnomalyJob(
        'signup_honeypot',
        null,
        ['ip' => '203.0.113.1'],
        SecurityEvent::SEVERITY_HIGH,
    ))->handle();

    Notification::assertSentOnDemand(
        SecurityAnomalyNotification::class,
        function (SecurityAnomalyNotification $notification, array $channels, object $notifiable): bool {
            return $notifiable->routes['mail'] === 'security-ops@propreneur.test'
                && in_array('mail', $channels, true);
        }
    );

    Notification::assertSentTo(
        $admin,
        SecurityAnomalyNotification::class,
        function (SecurityAnomalyNotification $notification, array $channels): bool {
            return $channels === ['database'];
        }
    );
});

it('sends mail and database to super admins when SECURITY_ALERT_EMAIL is unset', function (): void {
    config(['security.alert_email' => null]);

    $admin = PlatformUser::factory()->superAdmin()->create();

    Notification::fake();

    (new NotifySecurityAnomalyJob(
        'brute_force_login',
        'tenant-1',
        ['ip' => '203.0.113.2'],
        SecurityEvent::SEVERITY_HIGH,
    ))->handle();

    Notification::assertSentTo(
        $admin,
        SecurityAnomalyNotification::class,
        function (SecurityAnomalyNotification $notification, array $channels): bool {
            return $channels === ['mail', 'database'];
        }
    );

    Notification::assertSentOnDemandTimes(SecurityAnomalyNotification::class, 0);
});
