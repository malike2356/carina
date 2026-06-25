<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\TenantSetting;
use App\Services\Integrations\PropreneurAivaEventWebhookService;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Support\Facades\Http;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::syncFromCatalogue();
});

it('posts signed email_processed payload when flag and settings are configured', function (): void {
    Http::fake([
        'https://core.carinaai.test/*' => Http::response(['ok' => true, 'delivered' => 1], 200),
    ]);

    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Webhook Emit '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@aiva-event.test',
        'plan' => 'starter',
    ]);

    FeatureFlag::query()->where('key', 'propreneur_event_webhooks')->update(['enabled' => true]);
    $flag = FeatureFlag::query()->where('key', 'propreneur_event_webhooks')->firstOrFail();
    $flag->setTenantOverride((string) $tenant->getTenantKey(), true);

    tenancy()->initialize($tenant);

    TenantSetting::setValue('integrations.aiva.webhook_url', 'https://core.carinaai.test/api/aiva/webhooks/propreneur', 'integrations');
    TenantSetting::setValue('integrations.aiva.webhook_secret', 'shared-hmac-secret', 'integrations');
    TenantSetting::setValue('integrations.aiva.worker_id', '11111111-1111-4111-8111-111111111111', 'integrations');

    app(PropreneurAivaEventWebhookService::class)->dispatch('email_processed', [
        'log_id' => 42,
        'subject' => 'Monthly rent',
        'sender' => 'agent@test.com',
        'classification' => 'rent_statement',
    ]);

    Http::assertSent(function ($request): bool {
        $sig = $request->header('X-Propreneur-Signature')[0] ?? '';
        $body = $request->body();
        $expected = 'sha256='.hash_hmac('sha256', $body, 'shared-hmac-secret');

        return str_contains($request->url(), '/api/aiva/webhooks/propreneur')
            && $sig === $expected
            && str_contains($body, 'rent_statement');
    });

    tenancy()->end();
});

it('does not post when propreneur_event_webhooks flag is off', function (): void {
    Http::fake();

    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Webhook Off '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@aiva-event-off.test',
        'plan' => 'starter',
    ]);

    FeatureFlag::query()->where('key', 'propreneur_event_webhooks')->update(['enabled' => false]);

    tenancy()->initialize($tenant);
    TenantSetting::setValue('integrations.aiva.webhook_url', 'https://core.carinaai.test/api/aiva/webhooks/propreneur', 'integrations');
    TenantSetting::setValue('integrations.aiva.webhook_secret', 'shared-hmac-secret', 'integrations');
    TenantSetting::setValue('integrations.aiva.worker_id', '11111111-1111-4111-8111-111111111111', 'integrations');

    app(PropreneurAivaEventWebhookService::class)->dispatch('email_processed', ['log_id' => 1]);

    Http::assertNothingSent();
    tenancy()->end();
});
