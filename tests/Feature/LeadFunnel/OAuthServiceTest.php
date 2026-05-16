<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\LeadFunnel\PlatformIntegration;
use App\Models\Tenant\User;
use App\Services\LeadFunnel\OAuthService;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Redis;

it('generates meta oauth url with required scopes', function (): void {
    Redis::shouldReceive('setex')->once();
    config([
        'lead_funnel.meta.app_id' => 'meta-app',
        'lead_funnel.meta.redirect_uri' => 'https://app.test/callback',
        'lead_funnel.meta.graph_version' => 'v18.0',
    ]);

    $url = app(OAuthService::class)->getAuthUrl('facebook', 'tenant-1', 1);

    expect($url)->toContain('ads_management')
        ->and($url)->toContain('leads_retrieval');
});

it('rejects callback with invalid oauth state', function (): void {
    Redis::shouldReceive('exists')->once()->andReturn(false);

    app(OAuthService::class)->handleCallback('facebook', 'code', base64_encode('{}'));
})->throws(RuntimeException::class);

it('generates linkedin oauth url with required scopes', function (): void {
    Redis::shouldReceive('setex')->once();
    config([
        'lead_funnel.linkedin.client_id' => 'li-client',
        'lead_funnel.linkedin.redirect_uri' => 'https://app.test/callback/linkedin',
    ]);

    $url = app(OAuthService::class)->getAuthUrl('linkedin', 'tenant-1', 1);

    expect($url)
        ->toContain('r_ads')
        ->and($url)->toContain('rw_ads')
        ->and($url)->toContain('r_liteprofile')
        ->and($url)->toContain('r_emailaddress');
});

it('generates tiktok oauth url pointing to the tiktok business api portal', function (): void {
    Redis::shouldReceive('setex')->once();
    config([
        'lead_funnel.tiktok.app_id' => 'tt-app-999',
        'lead_funnel.tiktok.redirect_uri' => 'https://app.test/callback/tiktok',
    ]);

    $url = app(OAuthService::class)->getAuthUrl('tiktok', 'tenant-1', 1);

    expect($url)
        ->toContain('business-api.tiktok.com')
        ->and($url)->toContain('tt-app-999');
});

it('callback creates a platform integration record for linkedin', function (): void {
    $tenantService = app(TenantCreationService::class);
    $tenant = $tenantService->createTenant([
        'company_name' => 'OAuth Cb Test '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'oauth-cb-'.uniqid().'@test.test',
        'plan' => 'starter',
    ]);
    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();

    $user = User::factory()->create();

    $state = base64_encode(json_encode([
        'tenant_id' => (string) $tenant->getKey(),
        'user_id' => $user->id,
        'platform' => 'linkedin',
        'nonce' => 'test-nonce',
    ], JSON_THROW_ON_ERROR));

    Redis::shouldReceive('exists')->once()->andReturn(true);
    Redis::shouldReceive('del')->once();

    Http::fake([
        'https://www.linkedin.com/oauth/v2/accessToken' => Http::response([
            'access_token' => 'li-token-abc',
            'expires_in' => 7200,
            'account_id' => 'li-acct-001',
        ], 200),
    ]);

    $integration = app(OAuthService::class)->handleCallback('linkedin', 'auth-code', $state);

    expect($integration)->toBeInstanceOf(PlatformIntegration::class)
        ->and($integration->platform)->toBe('linkedin')
        ->and($integration->access_token)->toBe('li-token-abc');

    tenancy()->end();
});

it('callback throws when state platform does not match requested platform', function (): void {
    $state = base64_encode(json_encode([
        'tenant_id' => 'tenant-x',
        'user_id' => 1,
        'platform' => 'linkedin',
        'nonce' => 'mismatch-test',
    ], JSON_THROW_ON_ERROR));

    Redis::shouldReceive('exists')->once()->andReturn(true);
    Redis::shouldReceive('del')->once();

    app(OAuthService::class)->handleCallback('facebook', 'auth-code', $state);
})->throws(RuntimeException::class);
