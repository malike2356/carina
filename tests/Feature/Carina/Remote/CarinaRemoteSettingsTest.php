<?php

declare(strict_types=1);

use App\Models\Tenant\CarinaRemoteApiKey;
use App\Models\Tenant\CarinaRemoteChannelMapping;
use App\Models\Tenant\TenantRole;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Database\Factories\Tenant\UserFactory;

it('workspace admin can generate key and full key shown once', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Remote Settings '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@remote-settings.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $admin = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $response = $this->actingAs($admin, 'web')
        ->post('http://'.$host.'/settings/carina-remote/keys', [
            'name' => 'Integration',
            'user_id' => $admin->id,
        ]);

    $response->assertRedirect();
    expect(session('carina_remote_new_key'))->toStartWith('crm_');

    tenancy()->initialize($tenant);
    expect(CarinaRemoteApiKey::query()->count())->toBe(1);
    $stored = CarinaRemoteApiKey::query()->first();
    expect($stored->key_hash)->not->toBe(session('carina_remote_new_key'));
    tenancy()->end();

    $index = $this->actingAs($admin, 'web')->get('http://'.$host.'/settings/carina-remote');
    $index->assertOk();
    $index->assertDontSee(session('carina_remote_new_key'));
});

it('workspace admin can revoke key and chat returns 401', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Remote Revoke '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@remote-revoke.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $admin = User::query()->firstOrFail();
    [$plain, $key] = CarinaRemoteApiKey::mint('revoke me', $admin->id);
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($admin, 'web')
        ->delete('http://'.$host.'/settings/carina-remote/keys/'.$key->id)
        ->assertRedirect();

    $this->postJson('http://'.$host.'/api/remote/carina/chat', [
        'message' => 'Hi',
    ], [
        'Authorization' => 'Bearer '.$plain,
    ])->assertUnauthorized();
});

it('workspace admin can create and delete channel mappings', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Remote Map '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@remote-map.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $admin = User::query()->firstOrFail();
    $other = UserFactory::new()->createOne();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($admin, 'web')
        ->post('http://'.$host.'/settings/carina-remote/mappings', [
            'channel' => 'slack',
            'external_id' => 'U123',
            'user_id' => $other->id,
        ])
        ->assertRedirect();

    tenancy()->initialize($tenant);
    $mapping = CarinaRemoteChannelMapping::query()->first();
    expect($mapping)->not->toBeNull();
    tenancy()->end();

    $this->actingAs($admin, 'web')
        ->delete('http://'.$host.'/settings/carina-remote/mappings/'.$mapping->id)
        ->assertRedirect();

    tenancy()->initialize($tenant);
    expect(CarinaRemoteChannelMapping::query()->count())->toBe(0);
    tenancy()->end();
});

it('non admin gets 403 on settings routes', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Remote Viewer '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@remote-viewer.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    TenantRole::findOrCreate('viewer', 'web');
    $viewer = UserFactory::new()->createOne();
    $viewer->syncRoles(['viewer']);
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($viewer, 'web')
        ->get('http://'.$host.'/settings/carina-remote')
        ->assertForbidden();
});
