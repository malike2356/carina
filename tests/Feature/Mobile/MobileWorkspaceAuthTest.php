<?php

declare(strict_types=1);

use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\PersonalAccessToken;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
});

it('issues a sanctum token and returns the workspace user profile', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Mobile API '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@mobile-ws.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->where('email', $tenant->owner_email)->firstOrFail();
    $user->forceFill(['password' => Hash::make('secret-password')])->save();
    tenancy()->end();

    $login = $this->postJson('http://'.$host.'/api/mobile/v1/token', [
        'email' => $tenant->owner_email,
        'password' => 'secret-password',
        'device_name' => 'pest',
    ]);

    $login->assertOk()
        ->assertJsonStructure(['token', 'token_type', 'user' => ['id', 'name', 'email']]);

    $token = (string) $login->json('token');

    tenancy()->initialize($tenant);
    expect(PersonalAccessToken::query()->count())->toBe(1);
    tenancy()->end();

    $me = $this->getJson('http://'.$host.'/api/mobile/v1/me', [
        'Authorization' => 'Bearer '.$token,
    ]);

    $me->assertOk()
        ->assertJsonPath('user.email', $tenant->owner_email);

    $revoke = $this->deleteJson('http://'.$host.'/api/mobile/v1/token', [], [
        'Authorization' => 'Bearer '.$token,
    ]);

    $revoke->assertOk();

    tenancy()->initialize($tenant);
    expect(PersonalAccessToken::query()->count())->toBe(0);
    tenancy()->end();
});
