<?php

declare(strict_types=1);

use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

it('redirects guests away from the extension zip download', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'ExtZip Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@extzip.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    $this->get('http://'.$host.'/deals/sourcing/extension/download')
        ->assertRedirect();
});

it('serves a zip containing the extension manifest for an authenticated tenant user', function (): void {
    if (! class_exists(ZipArchive::class)) {
        $this->markTestSkipped('ZipArchive extension not loaded.');
    }

    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'ExtZip Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@extzip.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($user, 'web');

    $response = $this->get('http://'.$host.'/deals/sourcing/extension/download');

    $response->assertOk();
    $response->assertDownload('propreneur-save-listing.zip');

    $tmp = tempnam(sys_get_temp_dir(), 'extzip-');
    assert(is_string($tmp));
    $zipPath = $tmp.'.zip';
    rename($tmp, $zipPath);
    file_put_contents($zipPath, $response->getContent());

    $zip = new ZipArchive;
    expect($zip->open($zipPath))->toBeTrue();
    expect($zip->locateName('propreneur-save-listing/manifest.json'))->toBeGreaterThanOrEqual(0);
    $zip->close();
    @unlink($zipPath);
});
