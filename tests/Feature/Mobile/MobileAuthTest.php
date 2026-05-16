<?php

declare(strict_types=1);

use App\Models\Tenant\MobileSession;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\PersonalAccessToken;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
});

it('logs in via v1 mobile api and returns access and refresh tokens', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Mobile v1 '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@mobile-v1.test',
        'plan' => 'mentor_network',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';
    $deviceUuid = '11111111-1111-1111-1111-111111111111';

    tenancy()->initialize($tenant);
    $user = User::query()->where('email', $tenant->owner_email)->firstOrFail();
    $user->forceFill(['password' => Hash::make('secret-password')])->save();
    tenancy()->end();

    $login = $this->postJson('http://'.$host.'/api/v1/mobile/auth/login', [
        'email' => $tenant->owner_email,
        'password' => 'secret-password',
        'device_uuid' => $deviceUuid,
    ]);

    $login->assertOk()
        ->assertJsonStructure([
            'access_token',
            'refresh_token',
            'token_type',
            'expires_at',
            'refresh_expires_at',
            'user' => ['id', 'name', 'email'],
        ]);

    $access = (string) $login->json('access_token');
    $refresh = (string) $login->json('refresh_token');

    tenancy()->initialize($tenant);
    expect(MobileSession::query()->count())->toBe(1);
    expect(PersonalAccessToken::query()->count())->toBe(1);
    tenancy()->end();

    $me = $this->getJson('http://'.$host.'/api/v1/mobile/profile', [
        'Authorization' => 'Bearer '.$access,
        'X-Device-UUID' => $deviceUuid,
    ]);
    $me->assertOk()->assertJsonPath('user.email', $tenant->owner_email);

    $refreshResponse = $this->postJson('http://'.$host.'/api/v1/mobile/auth/refresh', [
        'refresh_token' => $refresh,
        'device_uuid' => $deviceUuid,
    ]);
    $refreshResponse->assertOk()->assertJsonStructure(['access_token', 'refresh_token']);

    $newAccess = (string) $refreshResponse->json('access_token');

    tenancy()->initialize($tenant);
    expect(MobileSession::query()->count())->toBe(1);
    expect(PersonalAccessToken::query()->count())->toBe(1);
    tenancy()->end();

    $this->postJson('http://'.$host.'/api/v1/mobile/auth/logout', [
        'refresh_token' => (string) $refreshResponse->json('refresh_token'),
    ], [
        'Authorization' => 'Bearer '.$newAccess,
        'X-Device-UUID' => $deviceUuid,
    ])->assertOk();

    tenancy()->initialize($tenant);
    expect(MobileSession::query()->count())->toBe(0);
    expect(PersonalAccessToken::query()->count())->toBe(0);
    tenancy()->end();
});

it('rejects mobile self-registration by default', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Mobile reg '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@mobile-reg.test',
        'plan' => 'mentor_network',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    $res = $this->postJson('http://'.$host.'/api/v1/mobile/auth/register', [
        'name' => 'New',
        'email' => 'new-'.uniqid().'@example.test',
        'password' => 'passwordpassword',
        'password_confirmation' => 'passwordpassword',
        'device_uuid' => '22222222-2222-2222-2222-222222222222',
    ]);

    $res->assertStatus(422);
});

it('allows mobile self-registration when enabled', function (): void {
    config(['mobile.allow_self_registration' => true]);

    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Mobile reg on '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@mobile-reg-on.test',
        'plan' => 'mentor_network',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';
    $email = 'joiner-'.uniqid().'@example.test';

    $res = $this->postJson('http://'.$host.'/api/v1/mobile/auth/register', [
        'name' => 'Joiner',
        'email' => $email,
        'password' => 'passwordpassword',
        'password_confirmation' => 'passwordpassword',
        'device_uuid' => '33333333-3333-3333-3333-333333333333',
    ]);

    $res->assertCreated()->assertJsonPath('user.email', $email);

    tenancy()->initialize($tenant);
    expect(User::query()->where('email', $email)->exists())->toBeTrue();
    tenancy()->end();
});
