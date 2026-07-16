<?php

declare(strict_types=1);

use App\Models\Tenant\MobileSyncQueue;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Support\Facades\Hash;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
});

it('processes sync actions and lists pending queue rows', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Mobile sync '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@mobile-sync.test',
        'plan' => 'mentor_network',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';
    $deviceUuid = '44444444-4444-4444-4444-444444444444';

    tenancy()->initialize($tenant);
    $user = User::query()->where('email', $tenant->owner_email)->firstOrFail();
    $user->forceFill(['password' => Hash::make('secret-password')])->save();
    tenancy()->end();

    $login = $this->postJson('http://'.$host.'/api/v1/mobile/auth/login', [
        'email' => $tenant->owner_email,
        'password' => 'secret-password',
        'device_uuid' => $deviceUuid,
    ]);
    $login->assertOk();
    $access = (string) $login->json('access_token');

    $sync = $this->postJson('http://'.$host.'/api/v1/mobile/sync', [
        'actions' => [
            ['action' => 'noop', 'payload' => []],
        ],
    ], [
        'Authorization' => 'Bearer '.$access,
        'X-Device-UUID' => $deviceUuid,
    ]);
    $sync->assertOk()->assertJsonPath('applied', 1)->assertJsonPath('errors', []);

    tenancy()->initialize($tenant);
    MobileSyncQueue::query()->create([
        'user_id' => $user->id,
        'tenant_id' => (string) $tenant->getTenantKey(),
        'action' => 'noop',
        'payload' => [],
    ]);
    expect(MobileSyncQueue::query()->pending()->count())->toBe(1);
    tenancy()->end();

    $pending = $this->getJson('http://'.$host.'/api/v1/mobile/sync/pending', [
        'Authorization' => 'Bearer '.$access,
        'X-Device-UUID' => $deviceUuid,
    ]);
    $pending->assertOk();
    expect($pending->json('data'))->toHaveCount(1);

    $id = (int) $pending->json('data.0.id');

    $marked = $this->postJson('http://'.$host.'/api/v1/mobile/sync/mark-synced', [
        'ids' => [$id],
    ], [
        'Authorization' => 'Bearer '.$access,
        'X-Device-UUID' => $deviceUuid,
    ]);
    $marked->assertOk()->assertJsonPath('marked', 1);

    tenancy()->initialize($tenant);
    expect(MobileSyncQueue::query()->pending()->count())->toBe(0);
    tenancy()->end();
});
