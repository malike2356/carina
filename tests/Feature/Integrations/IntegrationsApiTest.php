<?php

declare(strict_types=1);

use App\Jobs\Integrations\DispatchWebhookJob;
use App\Models\Central\FeatureFlag;
use App\Models\Tenant\IntegrationConfig;
use App\Models\Tenant\User;
use App\Models\Tenant\WebhookDelivery;
use App\Models\Tenant\WebhookEndpoint;
use App\Services\Integrations\WebhookDispatchService;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;

it('supports integrations api and webhook dispatch', function (): void {
    Http::preventStrayRequests();

    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Integrations API '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@integrations-api.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'integrations')->update(['enabled' => true]);

    IntegrationConfig::query()->create([
        'tenant_id' => (string) $tenant->getKey(),
        'provider' => 'zoom',
        'credentials_encrypted' => ['access_token' => 'z'],
        'settings' => ['region' => 'eu'],
        'is_active' => true,
    ]);

    $endpoint = WebhookEndpoint::query()->create([
        'tenant_id' => (string) $tenant->getKey(),
        'name' => 'Primary',
        'url' => 'https://hooks.example.test/inbox',
        'events' => ['deal.created'],
        'is_active' => true,
    ]);

    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($user, 'web');

    $page = $this->get('http://'.$host.'/settings/integrations');
    $page->assertOk()
        ->assertSee('Third-party integrations', false)
        ->assertSee('Outbound webhooks', false)
        ->assertSee('Add endpoint', false)
        ->assertSee('Webhook delivery log', false);

    $list = $this->getJson('http://'.$host.'/api/integrations');
    $list->assertOk()
        ->assertJsonPath('data.0.provider', 'zoom')
        ->assertJsonPath('data.0.has_credentials', true);

    $connect = $this->postJson('http://'.$host.'/api/integrations/propertydata/connect', [
        'credentials' => ['api_key' => 'secret-pd'],
        'settings' => ['tier' => 'pro'],
    ]);

    $connect->assertCreated()
        ->assertJsonPath('data.provider', 'propertydata');

    tenancy()->initialize($tenant);
    expect(IntegrationConfig::query()->where('provider', 'propertydata')->exists())->toBeTrue();
    tenancy()->end();

    Queue::fake();
    tenancy()->initialize($tenant);
    $count = app(WebhookDispatchService::class)->dispatchEvent('deal.created', ['id' => 1]);
    tenancy()->end();

    expect($count)->toBe(1);
    Queue::assertPushed(DispatchWebhookJob::class, fn (DispatchWebhookJob $job): bool => $job->deliveryId > 0
        && $job->tenantCentralId === (string) $tenant->getKey());

    Http::fake([
        'https://hooks.example.test/inbox' => Http::response('ok', 200),
    ]);

    tenancy()->initialize($tenant);
    $endpoint2 = WebhookEndpoint::query()->create([
        'tenant_id' => (string) $tenant->getKey(),
        'name' => 'Http',
        'url' => 'https://hooks.example.test/inbox',
        'events' => ['*'],
        'is_active' => true,
    ]);
    $delivery = WebhookDelivery::query()->create([
        'endpoint_id' => $endpoint2->id,
        'event' => 'ping',
        'payload' => ['x' => 1],
        'status' => 'queued',
    ]);
    tenancy()->end();

    (new DispatchWebhookJob($delivery->id, (string) $tenant->getKey()))->handle();

    tenancy()->initialize($tenant);
    $delivery->refresh();
    tenancy()->end();

    expect($delivery->status)->toBe('delivered')
        ->and($delivery->response_code)->toBe(200);
});
