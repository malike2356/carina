<?php

declare(strict_types=1);

use App\Jobs\LeadFunnel\CreateCrmContactJob;
use App\Models\Central\FeatureFlag;
use App\Models\Tenant\LeadFunnel\InboundLead;
use App\Services\LeadFunnel\LeadIngestionService;
use App\Services\Tenancy\TenantCreationService;
use App\Support\LeadFunnel\LeadFunnelSegment;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;

uses(RefreshDatabase::class);

it('determines segment from qualifying answer', function (): void {
    $service = app(LeadIngestionService::class);

    $segment = $service->determineSegment([
        'Which best describes you?' => 'I buy and hold properties',
    ]);

    expect($segment)->toBe('investor');
});

it('defaults segment to unknown when answer missing', function (): void {
    $service = app(LeadIngestionService::class);

    expect($service->determineSegment([]))->toBe('unknown');
});

it('normalises linkedin lead fields', function (): void {
    $service = app(LeadIngestionService::class);
    $normalised = $service->normaliseLinkedInLead([
        'id' => 'li-1',
        'firstName' => 'Sam',
        'lastName' => 'Agent',
        'emailAddress' => 'sam@example.test',
        'phoneNumbers' => ['07123456789'],
    ]);

    expect($normalised['first_name'])->toBe('Sam')
        ->and($normalised['email'])->toBe('sam@example.test');
});

it('normalises tiktok lead fields', function (): void {
    $service = app(LeadIngestionService::class);
    $normalised = $service->normaliseTikTokLead([
        'lead_id' => 'tt-1',
        'answers' => [
            'first_name' => 'Tia',
            'last_name' => 'Tok',
            'email' => 'tia@example.test',
        ],
    ]);

    expect($normalised['platform_lead_id'])->toBe('tt-1')
        ->and($normalised['email'])->toBe('tia@example.test');
});

it('maps known answers via segment helper', function (): void {
    expect(LeadFunnelSegment::fromAnswer('I own rental properties'))->toBe('landlord');
});

it('ingest creates a captured prospect record in the tenant database', function (): void {
    Queue::fake();

    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Ingest Test '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'ingest-'.uniqid().'@test.test',
        'plan' => 'starter',
    ]);
    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    $tenantId = (string) $tenant->getKey();

    $lead = app(LeadIngestionService::class)->ingest([
        'field_data' => [
            ['name' => 'full_name', 'values' => ['Jane Smith']],
            ['name' => 'email', 'values' => ['jane@example.test']],
        ],
        'id' => 'meta-lead-100',
    ], 'facebook', $tenantId);

    expect($lead)->toBeInstanceOf(InboundLead::class)
        ->and($lead->email)->toBe('jane@example.test')
        ->and($lead->platform)->toBe('facebook')
        ->and($lead->status)->toBe('processing');

    tenancy()->end();
});

it('ingest deduplicates by platform_lead_id and marks the second as duplicate', function (): void {
    Queue::fake();

    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Dedup PID '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'dedup-pid-'.uniqid().'@test.test',
        'plan' => 'starter',
    ]);
    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    $tenantId = (string) $tenant->getKey();

    $raw = [
        'field_data' => [
            ['name' => 'full_name', 'values' => ['Bob']],
            ['name' => 'email', 'values' => ['bob@test.test']],
        ],
        'id' => 'meta-lead-200',
    ];

    $first = app(LeadIngestionService::class)->ingest($raw, 'facebook', $tenantId);
    $second = app(LeadIngestionService::class)->ingest($raw, 'facebook', $tenantId);

    expect($second->id)->toBe($first->id)
        ->and($second->status)->toBe('duplicate');

    tenancy()->end();
});

it('ingest deduplicates by email within 24 hours', function (): void {
    Queue::fake();

    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Dedup Email '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'dedup-email-'.uniqid().'@test.test',
        'plan' => 'starter',
    ]);
    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    $tenantId = (string) $tenant->getKey();

    $ingestion = app(LeadIngestionService::class);

    $first = $ingestion->ingest([
        'field_data' => [
            ['name' => 'full_name', 'values' => ['Alice']],
            ['name' => 'email', 'values' => ['alice@test.test']],
        ],
        'id' => 'fb-lead-300',
    ], 'facebook', $tenantId);

    $second = $ingestion->ingest([
        'field_data' => [
            ['name' => 'full_name', 'values' => ['Alice 2']],
            ['name' => 'email', 'values' => ['alice@test.test']],
        ],
        'id' => 'fb-lead-301',
    ], 'facebook', $tenantId);

    expect($second->id)->toBe($first->id)
        ->and($second->status)->toBe('duplicate');

    tenancy()->end();
});

it('ingest dispatches a CreateCrmContactJob after persisting the lead', function (): void {
    Queue::fake();

    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'CRM Job Test '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'crmjob-'.uniqid().'@test.test',
        'plan' => 'starter',
    ]);
    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    $tenantId = (string) $tenant->getKey();

    app(LeadIngestionService::class)->ingest([
        'field_data' => [
            ['name' => 'full_name', 'values' => ['Dave Jones']],
            ['name' => 'email', 'values' => ['dave@test.test']],
        ],
        'id' => 'meta-lead-400',
    ], 'facebook', $tenantId);

    Queue::assertPushed(CreateCrmContactJob::class);

    tenancy()->end();
});
