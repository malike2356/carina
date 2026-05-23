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

    expect($labels)->toContain('Mobile app (Android)');

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
        ->assertSee('Download Android APK', false);
});

it('registers tenant mobile android route', function (): void {
    expect(Route::has('tenant.mobile.android'))->toBeTrue();
});
