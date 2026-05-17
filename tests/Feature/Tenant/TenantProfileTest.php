<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Illuminate\Support\Facades\Hash;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    $this->withoutMiddleware(VerifyCsrfToken::class);

    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Profile Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@profile.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';
    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($user, 'web');
    $this->baseUrl = 'http://'.$host;
    $this->tenant = $tenant;
    $this->user = $user;
});

it('tenant profile page returns 200', function (): void {
    $response = $this->get($this->baseUrl.'/profile');

    $response->assertOk();
    $response->assertSee('My Profile', false);
    $response->assertSee($this->user->name, false);
});

it('tenant can update profile name email and phone', function (): void {
    $response = $this->put($this->baseUrl.'/profile', [
        'name' => 'Updated Name',
        'email' => 'updated-'.uniqid().'@profile.test',
        'phone' => '+44 7700 900123',
    ]);

    $response->assertRedirect();
    $response->assertSessionHas('success');

    tenancy()->initialize($this->tenant);
    $fresh = User::query()->findOrFail($this->user->id);
    expect($fresh->name)->toBe('Updated Name')
        ->and($fresh->phone)->toBe('+44 7700 900123');
    tenancy()->end();
});

it('tenant can update password with current password', function (): void {
    tenancy()->initialize($this->tenant);
    $this->user->update(['password' => Hash::make('old-password-1')]);
    tenancy()->end();

    $response = $this->put($this->baseUrl.'/profile', [
        'name' => $this->user->name,
        'email' => $this->user->email,
        'phone' => $this->user->phone,
        'current_password' => 'old-password-1',
        'password' => 'new-password-2',
        'password_confirmation' => 'new-password-2',
    ]);

    $response->assertRedirect();
    $response->assertSessionHas('success');

    tenancy()->initialize($this->tenant);
    $fresh = User::query()->findOrFail($this->user->id);
    expect(Hash::check('new-password-2', (string) $fresh->password))->toBeTrue();
    tenancy()->end();
});
