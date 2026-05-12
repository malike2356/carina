<?php

declare(strict_types=1);

use App\Services\LeadFunnel\OAuthService;
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
