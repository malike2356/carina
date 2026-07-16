<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    Storage::fake('local');
});

it('uploads lists and retrieves a document via the mobile API', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Mobile Docs '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@mobile-docs.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    $user = User::query()->where('email', $tenant->owner_email)->firstOrFail();
    $user->forceFill(['password' => Hash::make('secret-docs')])->save();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $token = $this->postJson('http://'.$host.'/api/v1/mobile/auth/login', [
        'email' => $tenant->owner_email,
        'password' => 'secret-docs',
        'device_uuid' => 'ffffffff-6666-6666-6666-ffffffffffff',
    ])->assertOk()->json('access_token');

    $headers = ['Authorization' => 'Bearer '.$token];

    $create = $this->postJson('http://'.$host.'/api/v1/mobile/documents', [
        'file' => UploadedFile::fake()->create('lease.pdf', 100, 'application/pdf'),
        'title' => 'Lease Agreement',
        'category' => 'legal',
    ], $headers);
    $create->assertCreated()
        ->assertJsonPath('data.title', 'Lease Agreement')
        ->assertJsonPath('data.category', 'legal');

    $docId = (int) $create->json('data.id');

    $this->getJson('http://'.$host.'/api/v1/mobile/documents', $headers)
        ->assertOk()
        ->assertJsonStructure(['data', 'meta' => ['current_page', 'last_page', 'per_page', 'total']]);

    $this->getJson('http://'.$host.'/api/v1/mobile/documents/'.$docId, $headers)
        ->assertOk()
        ->assertJsonPath('data.title', 'Lease Agreement');
});

it('updates document metadata via the mobile API', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Mobile Docs Update '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@mobile-docs-upd.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    $user = User::query()->where('email', $tenant->owner_email)->firstOrFail();
    $user->forceFill(['password' => Hash::make('secret-docs-upd')])->save();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $token = $this->postJson('http://'.$host.'/api/v1/mobile/auth/login', [
        'email' => $tenant->owner_email,
        'password' => 'secret-docs-upd',
        'device_uuid' => '11111111-aaaa-aaaa-aaaa-111111111111',
    ])->assertOk()->json('access_token');

    $headers = ['Authorization' => 'Bearer '.$token];

    $docId = (int) $this->postJson('http://'.$host.'/api/v1/mobile/documents', [
        'file' => UploadedFile::fake()->create('contract.pdf', 50, 'application/pdf'),
        'title' => 'Contract Draft',
        'category' => 'legal',
    ], $headers)->assertCreated()->json('data.id');

    $this->putJson('http://'.$host.'/api/v1/mobile/documents/'.$docId, [
        'title' => 'Contract Final',
    ], $headers)
        ->assertOk()
        ->assertJsonPath('data.title', 'Contract Final');

    $this->deleteJson('http://'.$host.'/api/v1/mobile/documents/'.$docId, [], $headers)
        ->assertNoContent();
});

it('stores and lists document versions via the mobile API', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Mobile Docs Versions '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@mobile-docs-ver.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    $user = User::query()->where('email', $tenant->owner_email)->firstOrFail();
    $user->forceFill(['password' => Hash::make('secret-docs-ver')])->save();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $token = $this->postJson('http://'.$host.'/api/v1/mobile/auth/login', [
        'email' => $tenant->owner_email,
        'password' => 'secret-docs-ver',
        'device_uuid' => '22222222-bbbb-bbbb-bbbb-222222222222',
    ])->assertOk()->json('access_token');

    $headers = ['Authorization' => 'Bearer '.$token];

    $docId = (int) $this->postJson('http://'.$host.'/api/v1/mobile/documents', [
        'file' => UploadedFile::fake()->create('policy-v1.pdf', 30, 'application/pdf'),
        'title' => 'Insurance Policy v1',
        'category' => 'insurance',
    ], $headers)->assertCreated()->json('data.id');

    $this->postJson('http://'.$host.'/api/v1/mobile/documents/'.$docId.'/versions', [
        'file' => UploadedFile::fake()->create('policy-v2.pdf', 35, 'application/pdf'),
        'title' => 'Insurance Policy v2',
    ], $headers)->assertCreated();

    $this->getJson('http://'.$host.'/api/v1/mobile/documents/'.$docId.'/versions', $headers)
        ->assertOk()
        ->assertJsonCount(2, 'data');
});
