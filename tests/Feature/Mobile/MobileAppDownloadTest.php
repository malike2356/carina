<?php

declare(strict_types=1);

use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use App\Support\Mobile\MobileAppDownload;
use App\Support\Navigation\WorkspaceSettingsHubPresenter;
use Database\Seeders\ThemePresetSeeder;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\URL;

beforeEach(function (): void {
    $this->seed(ThemePresetSeeder::class);
});

it('redirects mobile android download to external url when configured', function (): void {
    config([
        'mobile.android_apk_url' => 'https://cdn.example.test/propreneur-mobile.apk',
        'mobile.android_apk_path' => null,
    ]);

    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Mobile DL '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@mobile-dl.test',
        'plan' => 'starter',
    ]);
    $host = actingAsTenant($tenant);

    $this->get(tenantHttpUrl($host, 'mobile/android'))
        ->assertRedirect('https://cdn.example.test/propreneur-mobile.apk');
});

it('serves mobile android download from configured path', function (): void {
    $apk = tempnam(sys_get_temp_dir(), 'propreneur-apk-');
    file_put_contents($apk, 'fake-apk-bytes');

    config([
        'mobile.android_apk_url' => null,
        'mobile.android_apk_path' => $apk,
    ]);

    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Mobile File '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@mobile-file.test',
        'plan' => 'starter',
    ]);
    $host = actingAsTenant($tenant);

    $this->get(tenantHttpUrl($host, 'mobile/android'))
        ->assertOk()
        ->assertDownload('propreneur-mobile.apk');

    @unlink($apk);
});

it('returns 404 when android download is not configured', function (): void {
    config([
        'mobile.android_apk_url' => null,
        'mobile.android_apk_path' => null,
    ]);

    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Mobile None '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@mobile-none.test',
        'plan' => 'starter',
    ]);
    $host = actingAsTenant($tenant);

    $this->get(tenantHttpUrl($host, 'mobile/android'))->assertNotFound();
});

it('includes mobile app in settings hub when download is configured', function (): void {
    config(['mobile.android_apk_url' => 'https://cdn.example.test/app.apk']);

    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Mobile Hub '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@mobile-hub.test',
        'plan' => 'starter',
    ]);

    URL::defaults(['tenant_subdomain' => $tenant->slug]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    $labels = collect(app(WorkspaceSettingsHubPresenter::class)->sections($tenant, $user))
        ->flatMap(static fn (array $section): array => array_column($section['items'], 'label'))
        ->all();

    expect($labels)->toContain('Propreneur Mobile (Android)');

    tenancy()->end();
});

it('exposes download route url only when configured', function (): void {
    URL::defaults(['tenant_subdomain' => 'fixturetenant']);

    config(['mobile.android_apk_url' => null, 'mobile.android_apk_path' => null]);
    expect(MobileAppDownload::downloadRouteUrl())->toBeNull();

    config(['mobile.android_apk_url' => 'https://cdn.example.test/app.apk']);
    expect(MobileAppDownload::downloadRouteUrl())->not->toBeNull();
    expect(MobileAppDownload::downloadRouteUrl())->toContain('/mobile/android');
});

it('syncs propreneur mobile app help article', function (): void {
    config(['mobile.android_apk_url' => 'https://cdn.example.test/app.apk']);

    $this->artisan('help:sync')->assertExitCode(0);

    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Mobile Help '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@mobile-help.test',
        'plan' => 'starter',
    ]);
    $host = actingAsTenant($tenant);

    $this->get(tenantHttpUrl($host, 'help/dashboard-navigation/propreneur-mobile-app'))
        ->assertOk()
        ->assertSee('Propreneur Mobile App', false)
        ->assertSee('Download Propreneur Mobile APK', false);
});

it('registers tenant mobile android route', function (): void {
    expect(Route::has('tenant.mobile.android'))->toBeTrue();
});

it('registers tenant mobile assistant route', function (): void {
    expect(Route::has('tenant.mobile.assistant'))->toBeTrue();
});

it('redirects assistant download to external url when configured', function (): void {
    config([
        'mobile.assistant_apk_url' => 'https://cdn.example.test/propreneur-assistant.apk',
        'mobile.assistant_apk_path' => null,
    ]);

    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Assistant DL '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@assistant-dl.test',
        'plan' => 'starter',
    ]);
    $host = actingAsTenant($tenant);

    $this->get(tenantHttpUrl($host, 'mobile/assistant'))
        ->assertRedirect('https://cdn.example.test/propreneur-assistant.apk');
});

it('serves assistant download from configured path', function (): void {
    $apk = tempnam(sys_get_temp_dir(), 'propreneur-assistant-apk-');
    file_put_contents($apk, 'fake-assistant-apk-bytes');

    config([
        'mobile.assistant_apk_url' => null,
        'mobile.assistant_apk_path' => $apk,
    ]);

    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Assistant File '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@assistant-file.test',
        'plan' => 'starter',
    ]);
    $host = actingAsTenant($tenant);

    $this->get(tenantHttpUrl($host, 'mobile/assistant'))
        ->assertOk()
        ->assertDownload('propreneur-assistant.apk');

    @unlink($apk);
});

it('returns 404 when assistant download is not configured', function (): void {
    config([
        'mobile.assistant_apk_url' => null,
        'mobile.assistant_apk_path' => null,
    ]);

    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Assistant None '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@assistant-none.test',
        'plan' => 'starter',
    ]);
    $host = actingAsTenant($tenant);

    $this->get(tenantHttpUrl($host, 'mobile/assistant'))->assertNotFound();
});

it('includes assistant in settings hub when configured', function (): void {
    config(['mobile.assistant_apk_url' => 'https://cdn.example.test/assistant.apk']);

    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Assistant Hub '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@assistant-hub.test',
        'plan' => 'starter',
    ]);

    URL::defaults(['tenant_subdomain' => $tenant->slug]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    $labels = collect(app(WorkspaceSettingsHubPresenter::class)->sections($tenant, $user))
        ->flatMap(static fn (array $section): array => array_column($section['items'], 'label'))
        ->all();

    expect($labels)->toContain('Propreneur Assistant (Android)');

    tenancy()->end();
});

it('exposes assistant download route url only when configured', function (): void {
    URL::defaults(['tenant_subdomain' => 'fixturetenant']);

    config(['mobile.assistant_apk_url' => null, 'mobile.assistant_apk_path' => null]);
    expect(MobileAppDownload::assistantDownloadRouteUrl())->toBeNull();

    config(['mobile.assistant_apk_url' => 'https://cdn.example.test/assistant.apk']);
    expect(MobileAppDownload::assistantDownloadRouteUrl())->not->toBeNull();
    expect(MobileAppDownload::assistantDownloadRouteUrl())->toContain('/mobile/assistant');
});
