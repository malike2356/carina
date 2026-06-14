<?php

declare(strict_types=1);

use App\Billing\BillingModule;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Support\Facades\Hash;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
});

it('returns coach opt-in status and allows PATCH updates via mobile API', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Mobile Coach '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@mobile-coach.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->where('email', $tenant->owner_email)->firstOrFail();
    $user->forceFill([
        'password' => Hash::make('secret-coach'),
        'coach_enabled' => false,
    ])->save();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $token = $this->postJson('http://'.$host.'/api/v1/mobile/auth/login', [
        'email' => $tenant->owner_email,
        'password' => 'secret-coach',
        'device_uuid' => '88888888-8888-8888-8888-888888888888',
    ])->assertOk()->json('access_token');

    $headers = ['Authorization' => 'Bearer '.$token];

    $this->getJson('http://'.$host.'/api/v1/mobile/coach/status', $headers)
        ->assertOk()
        ->assertJsonPath('data.enabled', false)
        ->assertJsonPath('data.persona', fn ($value) => is_string($value) && $value !== '')
        ->assertJsonStructure(['data' => ['enabled', 'persona', 'checkin_times']]);

    $this->patchJson('http://'.$host.'/api/v1/mobile/coach/status', [
        'enabled' => true,
    ], $headers)
        ->assertOk()
        ->assertJsonPath('ok', true)
        ->assertJsonPath('coach_enabled', true);

    tenancy()->initialize($tenant);
    expect($user->fresh()->coach_enabled)->toBeTrue();
    tenancy()->end();

    $this->getJson('http://'.$host.'/api/v1/mobile/coach/status', $headers)
        ->assertOk()
        ->assertJsonPath('data.enabled', true);
})->group('mobile', BillingModule::CarinaAi->value);
