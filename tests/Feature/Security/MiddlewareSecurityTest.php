<?php

declare(strict_types=1);

use App\Http\Middleware\EnsureTenancyInitialised;
use App\Http\Middleware\SecurityHeaders;
use App\Models\Central\FeatureFlag;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Route;
use Symfony\Component\HttpKernel\Exception\HttpException;

it('returns 403 from EnsureTenancyInitialised when tenancy is not initialised', function (): void {
    $middleware = app(EnsureTenancyInitialised::class);
    $request = Request::create('/dashboard', 'GET');

    expect(fn () => $middleware->handle($request, fn () => response('ok')))
        ->toThrow(HttpException::class);
});

it('allows EnsureTenancyInitialised through when tenancy is initialised', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Middleware Tenancy '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@middleware-tenancy.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);

    $middleware = app(EnsureTenancyInitialised::class);
    $request = Request::create('/dashboard', 'GET');

    $response = $middleware->handle($request, fn () => response('ok'));

    expect($response->getStatusCode())->toBe(200);

    tenancy()->end();
});

it('passes valid Meta webhook signatures', function (): void {
    config(['lead_funnel.meta.app_secret' => 'meta-test-secret']);

    $body = '{"entry":[]}';
    $signature = 'sha256='.hash_hmac('sha256', $body, 'meta-test-secret');

    Route::middleware(['webhook.verify:meta'])->post('/_test/meta-webhook', fn () => response('ok'));

    $response = $this->call(
        'POST',
        '/_test/meta-webhook',
        [],
        [],
        [],
        ['HTTP_X-Hub-Signature-256' => $signature, 'CONTENT_TYPE' => 'application/json'],
        $body,
    );

    $response->assertOk();
});

it('rejects Stripe webhooks without a valid signature with 403', function (): void {
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => true]);
    config(['services.stripe.webhook_secret' => 'whsec_test_secret']);

    $response = $this->postJson('/api/billing/webhook/stripe', ['id' => 'evt_test'], [
        'Stripe-Signature' => 't=0,v1=invalid',
    ]);

    $response->assertForbidden();
});

it('rejects invalid Meta webhook signatures with 403', function (): void {
    config(['lead_funnel.meta.app_secret' => 'meta-test-secret']);

    Route::middleware(['webhook.verify:meta'])->post('/_test/meta-webhook-invalid', fn () => response('ok'));

    $response = $this->post('/_test/meta-webhook-invalid', [], [
        'X-Hub-Signature-256' => 'sha256=invalid',
    ]);

    $response->assertForbidden();
});

it('sets X-Frame-Options on SecurityHeaders responses', function (): void {
    $middleware = app(SecurityHeaders::class);
    $request = Request::create('/', 'GET');

    $response = $middleware->handle($request, fn () => response('ok'));

    expect($response->headers->get('X-Frame-Options'))->toBe('SAMEORIGIN');
});

it('omits Content-Security-Policy until Blade nonces are wired', function (): void {
    // CSP deferred: existing Blade layouts do not carry nonce attributes on
    // <script>/<style> tags. Re-enable once nonces are injected.
    $middleware = app(SecurityHeaders::class);
    $request = Request::create('/', 'GET');

    $response = $middleware->handle($request, fn () => response('ok'));

    expect($response->headers->has('Content-Security-Policy'))->toBeFalse();
});

it('throttles tenant_api per tenant not per ip', function (): void {
    RateLimiter::clear('tenant_api');

    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Rate Limit '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@rate-limit.test',
        'plan' => 'starter',
    ]);

    $host = actingAsTenant($tenant);

    for ($i = 0; $i < 120; $i++) {
        $this->withServerVariables(['HTTP_HOST' => $host, 'REMOTE_ADDR' => '203.0.113.1'])
            ->get('http://'.$host.'/api/locale/current')
            ->assertOk();
    }

    $this->withServerVariables(['HTTP_HOST' => $host, 'REMOTE_ADDR' => '198.51.100.99'])
        ->get('http://'.$host.'/api/locale/current')
        ->assertStatus(429);
});
