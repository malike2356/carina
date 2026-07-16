<?php

declare(strict_types=1);

use App\Jobs\LeadFunnel\CreateCrmContactJob;
use App\Models\Central\FeatureFlag;
use App\Models\Tenant\Contact;
use App\Models\Tenant\LeadFunnel\InboundLead;
use App\Services\LeadFunnel\LeadFunnelEmailTrackingService;
use App\Services\LeadFunnel\LeadIngestionService;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Support\Facades\Queue;

it('ingests landing page leads and dispatches CRM job', function (): void {
    Queue::fake();

    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Marketing Intake '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@lead-funnel.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'lead_funnel')->update(['enabled' => true]);

    $ingestion = app(LeadIngestionService::class);
    $lead = $ingestion->ingest([
        'name' => 'Alex Investor',
        'email' => 'alex@example.test',
        'segment_answer' => 'I buy and hold properties',
    ], 'landing_page', (string) $tenant->getKey());

    expect($lead->segment)->toBe('investor')
        ->and($lead->status)->toBe('processing');

    Queue::assertPushed(CreateCrmContactJob::class);
    tenancy()->end();
});

it('deduplicates by platform lead id', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Dedup '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@dedup.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    $ingestion = app(LeadIngestionService::class);
    $tenantId = (string) $tenant->getKey();

    $first = $ingestion->ingest(['id' => 'lead-1', 'field_data' => []], 'facebook', $tenantId);
    $second = $ingestion->ingest(['id' => 'lead-1', 'field_data' => []], 'facebook', $tenantId);

    expect($second->id)->toBe($first->id)
        ->and($second->status)->toBe('duplicate');
    tenancy()->end();
});

it('normalises meta lead fields', function (): void {
    $ingestion = app(LeadIngestionService::class);
    $normalised = $ingestion->normaliseMetaLead([
        'id' => 'meta-1',
        'field_data' => [
            ['name' => 'full_name', 'values' => ['Alex Investor']],
            ['name' => 'email', 'values' => ['alex@example.test']],
            ['name' => 'phone_number', 'values' => ['07123456789']],
            ['name' => 'which_best_describes_you', 'values' => ['I buy and hold properties']],
        ],
    ]);

    expect($normalised['first_name'])->toBe('Alex')
        ->and($normalised['email'])->toBe('alex@example.test')
        ->and($normalised['platform_lead_id'])->toBe('meta-1');
});

it('meta verify returns challenge with correct token', function (): void {
    config(['lead_funnel.meta.webhook_verify_token' => 'verify-token']);

    $response = $this->get('/api/webhooks/meta/verify?hub_mode=subscribe&hub_verify_token=verify-token&hub_challenge=12345');

    $response->assertOk()->assertSee('12345', false);
});

it('meta verify rejects wrong token', function (): void {
    config(['lead_funnel.meta.webhook_verify_token' => 'verify-token']);

    $response = $this->get('/api/webhooks/meta/verify?hub_mode=subscribe&hub_verify_token=wrong&hub_challenge=12345');

    $response->assertForbidden();
});

it('records email open engagement from tracking route', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Track '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@track.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    $contact = Contact::query()->create([
        'first_name' => 'Track',
        'last_name' => 'Lead',
        'name' => 'Track Lead',
        'email' => 'track-'.uniqid().'@example.test',
        'source' => 'facebook',
        'type' => 'investor',
        'lead_funnel_stage_id' => 1,
        'custom_fields' => [],
    ]);
    $token = app(LeadFunnelEmailTrackingService::class)
        ->register((string) $tenant->getKey(), $contact->id);
    tenancy()->end();

    $response = $this->get('/api/lead-funnel/track/open/'.$token);

    $response->assertOk();

    tenancy()->initialize($tenant);
    $contact->refresh();
    expect((int) ($contact->custom_fields['email_opens'] ?? 0))->toBe(1);
    tenancy()->end();
});

it('meta receive rejects invalid signature', function (): void {
    config(['lead_funnel.meta.app_secret' => 'secret']);

    $response = $this->postJson('/api/webhooks/meta/receive', ['entry' => []], [
        'X-Hub-Signature-256' => 'sha256=invalid',
    ]);

    $response->assertForbidden();
});

it('landing page ingest accepts valid payload', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Landing '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@landing.test',
        'plan' => 'starter',
    ]);

    $response = $this->postJson('/api/leads/ingest', [
        'name' => 'Sam Agent',
        'email' => 'sam@example.test',
        'tenant_slug' => $tenant->slug,
    ]);

    $response->assertOk()->assertJsonPath('status', 'received');

    tenancy()->initialize($tenant);
    expect(InboundLead::query()->where('email', 'sam@example.test')->exists())->toBeTrue();
    tenancy()->end();
});
