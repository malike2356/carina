<?php

declare(strict_types=1);

use App\Jobs\LeadFunnel\CreateCrmContactJob;
use App\Jobs\LeadFunnel\ProcessMetaWebhookJob;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Support\Facades\Queue;

it('meta verify returns challenge with correct token', function (): void {
    config(['lead_funnel.meta.webhook_verify_token' => 'verify-token']);

    $response = $this->get('/api/webhooks/meta/verify?hub_mode=subscribe&hub_verify_token=verify-token&hub_challenge=12345');

    $response->assertOk()->assertSee('12345', false);
});

it('meta receive dispatches job when signature is valid', function (): void {
    Queue::fake();
    config(['lead_funnel.meta.app_secret' => 'secret']);
    $payload = json_encode(['entry' => []]);
    $signature = 'sha256='.hash_hmac('sha256', (string) $payload, 'secret');

    $response = $this->post('/api/webhooks/meta/receive', [], [
        'X-Hub-Signature-256' => $signature,
        'CONTENT_TYPE' => 'application/json',
    ]);

    $response->assertOk();
    Queue::assertPushed(ProcessMetaWebhookJob::class);
});

it('meta receive returns forbidden on invalid signature', function (): void {
    config(['lead_funnel.meta.app_secret' => 'secret']);

    $response = $this->postJson('/api/webhooks/meta/receive', ['entry' => []], [
        'X-Hub-Signature-256' => 'sha256=invalid',
    ]);

    $response->assertForbidden();
});

it('meta verify returns forbidden when verify token does not match', function (): void {
    config(['lead_funnel.meta.webhook_verify_token' => 'correct-token']);

    $response = $this->get('/api/webhooks/meta/verify?hub_mode=subscribe&hub_verify_token=wrong-token&hub_challenge=99999');

    $response->assertForbidden();
});

it('landing page ingest creates a captured prospect and dispatches person-link job', function (): void {
    Queue::fake();
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'LP Ingest Test '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'lp-ingest-'.uniqid().'@test.test',
        'plan' => 'starter',
    ]);

    $response = $this->postJson('/api/leads/ingest', [
        'name' => 'Test Lead',
        'email' => 'testlead@example.test',
        'phone' => '07700900000',
        'tenant_slug' => $tenant->slug,
    ]);

    $response->assertOk()->assertJson(['status' => 'received']);
    Queue::assertPushed(CreateCrmContactJob::class);
});

it('landing page ingest returns received when tenant slug is not found', function (): void {
    $response = $this->postJson('/api/leads/ingest', [
        'name' => 'Ghost Lead',
        'email' => 'ghost@example.test',
        'tenant_slug' => 'no-such-tenant-xyz',
    ]);

    $response->assertOk()->assertJson(['status' => 'received']);
});

it('landing page ingest returns received when required fields are missing', function (): void {
    $response = $this->postJson('/api/leads/ingest', [
        'name' => 'No Email',
        'tenant_slug' => 'some-slug',
    ]);

    $response->assertOk()->assertJson(['status' => 'received']);
});

it('landing page ingest accepts faq-style fields with first name last name subject and message', function (): void {
    Queue::fake();
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'FAQ Ingest Test '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'faq-ingest-'.uniqid().'@test.test',
        'plan' => 'starter',
    ]);

    $response = $this->postJson('/api/leads/ingest', [
        'first_name' => 'Jane',
        'last_name' => 'Doe',
        'email' => 'jane.doe@example.test',
        'subject' => 'Guaranteed rent',
        'message' => 'I have a 3-bed in Portsmouth.',
        'source' => 'xeloxproperties.co.uk/faq',
        'segment' => 'landlord',
        'tenant_slug' => $tenant->slug,
    ]);

    $response->assertOk()->assertJson(['status' => 'received']);
    Queue::assertPushed(CreateCrmContactJob::class);
});
