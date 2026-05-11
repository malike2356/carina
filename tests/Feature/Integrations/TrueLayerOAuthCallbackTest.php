<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\IntegrationConfig;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Support\Facades\Http;

it('exchanges truelayer oauth callback and persists access token', function (): void {
    Http::fake([
        'https://auth.truelayer.com/connect/token' => Http::response([
            'access_token' => 'tl-access-token',
            'expires_in' => 3600,
            'refresh_token' => 'tl-refresh-token',
        ], 200),
    ]);

    $svc = app(TenantCreationService::class);
    $tenant = $svc->createTenant([
        'company_name' => 'TL OAuth '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@tl-oauth.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'integrations')->update(['enabled' => true]);

    IntegrationConfig::query()->create([
        'tenant_id' => (string) $tenant->getKey(),
        'provider' => 'truelayer',
        'credentials_encrypted' => [
            'client_id' => 'test-client-id',
            'client_secret' => 'test-client-secret',
        ],
        'settings' => [],
        'is_active' => true,
    ]);

    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $state = 'st-'.bin2hex(random_bytes(8));

    $this->actingAs($user, 'web')
        ->withSession(['integrations_truelayer_oauth_state' => $state])
        ->get('http://'.$host.'/settings/integrations/truelayer/callback?code=auth-code-123&state='.$state)
        ->assertStatus(302)
        ->assertSessionHas('integration_success');

    tenancy()->initialize($tenant);
    $cfg = IntegrationConfig::query()->where('provider', 'truelayer')->first();
    expect($cfg)->not->toBeNull()
        ->and($cfg->credentials_encrypted['access_token'] ?? null)->toBe('tl-access-token')
        ->and($cfg->credentials_encrypted['client_id'] ?? null)->toBe('test-client-id');
    tenancy()->end();
});
