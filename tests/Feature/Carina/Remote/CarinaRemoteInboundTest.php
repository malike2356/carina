<?php

declare(strict_types=1);

use App\Jobs\CarinaRemoteDispatchJob;
use App\Models\Tenant\CarinaRemoteApiKey;
use App\Models\Tenant\TenantSetting;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Support\Facades\Bus;

function carinaRemoteTenantHost(object $tenant): string
{
    $domain = $tenant->domains()->first()?->domain ?? $tenant->slug;

    return $domain.'.'.config('tenancy.central_domains')[0] ?? 'propreneur.test';
}

it('returns 503 when whatsapp bridge is not configured', function (): void {
    config(['services.whatsapp_bridge.url' => null]);

    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'WA Remote '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'wa-'.uniqid().'@remote.test',
        'plan' => 'starter',
    ]);

    $host = carinaRemoteTenantHost($tenant);

    $this->postJson('http://'.$host.'/api/remote/inbound/whatsapp-web', [
        'from' => '447700900123',
        'message' => 'Hi',
        'session_id' => $tenant->slug,
    ])->assertStatus(503);
});

it('returns 401 when bridge secret is missing', function (): void {
    config([
        'services.whatsapp_bridge.url' => 'http://127.0.0.1:3001',
        'services.whatsapp_bridge.webhook_secret' => 'expected-secret',
    ]);

    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'WA Remote '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'wa-'.uniqid().'@remote.test',
        'plan' => 'starter',
    ]);

    $host = carinaRemoteTenantHost($tenant);

    $this->postJson('http://'.$host.'/api/remote/inbound/whatsapp-web', [
        'from' => '447700900123',
        'message' => 'Hi',
        'session_id' => $tenant->slug,
    ])->assertUnauthorized();
});

it('dispatches job when secret and channel key are valid', function (): void {
    Bus::fake();

    config([
        'services.whatsapp_bridge.url' => 'http://127.0.0.1:3001',
        'services.whatsapp_bridge.webhook_secret' => 'expected-secret',
        'services.whatsapp_bridge.api_key' => 'bridge-key',
    ]);

    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'WA Remote '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'wa-'.uniqid().'@remote.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    [$plain, $key] = CarinaRemoteApiKey::mint('WhatsApp inbound');
    TenantSetting::query()->create([
        'key' => 'carina_remote_channel_key_whatsapp-web',
        'value' => (string) $key->id,
        'group' => 'carina_remote',
    ]);
    tenancy()->end();

    $host = carinaRemoteTenantHost($tenant);

    $this->postJson('http://'.$host.'/api/remote/inbound/whatsapp-web', [
        'from' => '447700900123',
        'message' => 'List my deals',
        'session_id' => $tenant->slug,
    ], [
        'X-Bridge-Secret' => 'expected-secret',
    ])->assertOk()->assertJson(['ok' => true]);

    Bus::assertDispatched(CarinaRemoteDispatchJob::class);
});

it('settings whatsapp status returns 503 when bridge not configured', function (): void {
    config(['services.whatsapp_bridge.url' => null]);

    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'WA Settings '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'wa-settings-'.uniqid().'@remote.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->first();
    tenancy()->end();

    $host = carinaRemoteTenantHost($tenant);

    $this->actingAs($user, 'web')
        ->getJson('http://'.$host.'/settings/carina-remote/whatsapp/status')
        ->assertStatus(503);
});
