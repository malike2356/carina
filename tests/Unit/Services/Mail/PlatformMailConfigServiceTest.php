<?php

declare(strict_types=1);

use App\Models\Central\PlatformSetting;
use App\Services\Mail\PlatformMailConfigService;
use Illuminate\Support\Facades\Config;

it('uses resend from cached config when platform mail_mailer is smtp without host', function (): void {
    Config::set('mail.default', 'resend');
    Config::set('services.resend.key', 're_test_key');
    Config::set('mail.mailers.smtp.host', '127.0.0.1');

    PlatformSetting::query()->updateOrCreate(
        ['key' => 'mail_mailer'],
        ['value' => 'smtp', 'group' => 'mail', 'is_encrypted' => false]
    );
    PlatformSetting::query()->where('key', 'smtp_host')->delete();

    app(PlatformMailConfigService::class)->bootstrap();

    expect(config('mail.default'))->toBe('resend');
});

it('rewrites propreneur.uk from address to resend verified domain', function (): void {
    Config::set('mail.default', 'resend');
    Config::set('mail.resend_verified_domain', 'propreneur.co.uk');
    Config::set('services.resend.key', 're_test_key');

    PlatformSetting::query()->updateOrCreate(
        ['key' => 'mail_mailer'],
        ['value' => 'resend', 'group' => 'mail', 'is_encrypted' => false]
    );
    PlatformSetting::query()->updateOrCreate(
        ['key' => 'email_from_address'],
        ['value' => 'contact@propreneur.uk', 'group' => 'mail', 'is_encrypted' => false]
    );

    app(PlatformMailConfigService::class)->bootstrap();

    expect(config('mail.from.address'))->toBe('contact@propreneur.co.uk');
});
