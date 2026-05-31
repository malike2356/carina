<?php

declare(strict_types=1);

use App\Mail\Central\TenantProvisionedWelcomeMail;
use App\Models\Central\FeatureFlag;
use App\Models\Tenant\User;
use App\Services\Mail\TenantWelcomeEmailService;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Support\Facades\Mail;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    Mail::fake();
});

it('sends welcome email when admin provisions a tenant with flag enabled', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Welcome Email Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@welcome-tenant.test',
        'plan' => 'starter',
        'send_welcome_email' => true,
    ]);

    Mail::assertSent(TenantProvisionedWelcomeMail::class, function (TenantProvisionedWelcomeMail $mail) use ($tenant): bool {
        return $mail->hasTo($tenant->owner_email)
            && str_contains($mail->loginUrl, $tenant->slug)
            && $mail->magicLoginUrl !== null
            && str_contains((string) $mail->magicLoginUrl, 'login/magic');
    });
});

it('skips welcome email when send_welcome_email is false', function (): void {
    app(TenantCreationService::class)->createTenant([
        'company_name' => 'No Welcome Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@no-welcome.test',
        'plan' => 'starter',
        'send_welcome_email' => false,
    ]);

    Mail::assertNothingSent();
});

it('creates missing owner user when sending welcome email', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Missing Owner Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@missing-owner.test',
        'plan' => 'starter',
        'send_welcome_email' => false,
    ]);

    $tenant->run(function () use ($tenant): void {
        \App\Models\Tenant\User::query()
            ->whereRaw('LOWER(email) = ?', [strtolower((string) $tenant->owner_email)])
            ->update(['email' => 'orphaned-'.uniqid().'@missing-owner.test']);
    });

    expect(app(TenantWelcomeEmailService::class)->send($tenant)->sent)->toBeTrue();

    Mail::assertSent(TenantProvisionedWelcomeMail::class);
});

it('marks owner email verified when sending welcome mail so magic links work', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Verified Welcome Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@verified-welcome.test',
        'plan' => 'starter',
        'send_welcome_email' => false,
    ]);

    $tenant->run(function () use ($tenant): void {
        $user = User::query()->whereRaw('LOWER(email) = ?', [strtolower((string) $tenant->owner_email)])->firstOrFail();
        $user->forceFill(['email_verified_at' => null])->save();
    });

    expect(app(TenantWelcomeEmailService::class)->send($tenant)->sent)->toBeTrue();

    $tenant->run(function () use ($tenant): void {
        $user = User::query()->whereRaw('LOWER(email) = ?', [strtolower((string) $tenant->owner_email)])->firstOrFail();
        expect($user->email_verified_at)->not->toBeNull();
    });
});

it('welcome service sends mail with reset link', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Direct Welcome Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@direct-welcome.test',
        'plan' => 'starter',
        'send_welcome_email' => false,
    ]);

    expect(app(TenantWelcomeEmailService::class)->send($tenant)->sent)->toBeTrue();

    Mail::assertSent(TenantProvisionedWelcomeMail::class);
});
