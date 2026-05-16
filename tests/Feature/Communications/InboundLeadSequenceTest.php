<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\CommunicationEnrollment;
use App\Models\Tenant\CommunicationSequence;
use App\Models\Tenant\CommunicationStep;
use App\Models\Tenant\Contact;
use App\Models\Tenant\ContactInteraction;
use App\Models\Tenant\LeadFunnel\InboundLead;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use App\Support\Communications\CommunicationSequenceTriggers;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;

beforeEach(function (): void {
    Mail::fake();
    Queue::fake();
});

it('enrolls a matching CRM contact when an inbound lead is created with lead.created sequence', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Lead Comms '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@lead-comms.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'communications_hub')->update(['enabled' => true]);
    completeTenantWorkspaceOnboarding();

    $user = User::query()->firstOrFail();
    $email = 'lead-match-'.Str::lower(Str::random(8)).'@example.test';

    $contact = Contact::query()->create([
        'first_name' => 'Pat',
        'last_name' => 'Buyer',
        'email' => $email,
        'created_by' => $user->id,
    ]);

    $slug = 'lead_seq_'.Str::lower(Str::random(8));

    $sequence = CommunicationSequence::query()->create([
        'slug' => $slug,
        'name' => 'Lead intake sequence',
        'description' => null,
        'trigger_key' => CommunicationSequenceTriggers::LEAD_CREATED,
        'trigger_config' => null,
        'is_builtin' => false,
        'is_active' => true,
        'created_by' => $user->id,
    ]);

    CommunicationStep::query()->create([
        'sequence_id' => $sequence->id,
        'step_order' => 0,
        'delay_hours' => 0,
        'channel' => 'email',
        'subject' => 'Hello',
        'body' => 'Hi {{first_name}}',
        'is_active' => true,
    ]);

    InboundLead::query()->create([
        'tenant_id' => (string) $tenant->getKey(),
        'platform' => 'landing_page',
        'platform_lead_id' => null,
        'first_name' => 'Pat',
        'last_name' => 'Buyer',
        'email' => $email,
        'segment' => 'investor',
        'raw_payload' => [],
        'custom_answers' => null,
        'status' => 'new',
        'received_at' => now(),
    ]);

    expect(
        CommunicationEnrollment::query()
            ->where('sequence_id', $sequence->id)
            ->where('contact_id', $contact->id)
            ->exists()
    )->toBeTrue();

    expect(
        ContactInteraction::query()
            ->where('contact_id', $contact->id)
            ->where('type', 'task')
            ->exists()
    )->toBeTrue();

    tenancy()->end();
});

it('enrolls after CRM contact is linked on inbound lead update', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Lead Link '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@lead-link.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'communications_hub')->update(['enabled' => true]);
    completeTenantWorkspaceOnboarding();

    $user = User::query()->firstOrFail();
    $email = 'lead-link-'.Str::lower(Str::random(8)).'@example.test';

    $contact = Contact::query()->create([
        'first_name' => 'Sam',
        'last_name' => 'Seller',
        'email' => $email,
        'created_by' => $user->id,
    ]);

    $slug = 'lead_link_seq_'.Str::lower(Str::random(8));

    $sequence = CommunicationSequence::query()->create([
        'slug' => $slug,
        'name' => 'Lead linked sequence',
        'description' => null,
        'trigger_key' => CommunicationSequenceTriggers::LEAD_CREATED,
        'trigger_config' => null,
        'is_builtin' => false,
        'is_active' => true,
        'created_by' => $user->id,
    ]);

    CommunicationStep::query()->create([
        'sequence_id' => $sequence->id,
        'step_order' => 0,
        'delay_hours' => 0,
        'channel' => 'email',
        'subject' => 'Hello',
        'body' => 'Hi {{first_name}}',
        'is_active' => true,
    ]);

    $lead = InboundLead::query()->create([
        'tenant_id' => (string) $tenant->getKey(),
        'platform' => 'facebook',
        'platform_lead_id' => 'fb-'.Str::random(12),
        'first_name' => 'Sam',
        'last_name' => 'Seller',
        'email' => 'other-'.Str::lower(Str::random(6)).'@example.test',
        'segment' => 'seller',
        'raw_payload' => ['id' => 'x'],
        'custom_answers' => null,
        'status' => 'processing',
        'received_at' => now(),
    ]);

    expect(
        CommunicationEnrollment::query()
            ->where('sequence_id', $sequence->id)
            ->where('contact_id', $contact->id)
            ->exists()
    )->toBeFalse();

    $lead->forceFill([
        'crm_contact_id' => $contact->id,
        'status' => 'crm_created',
    ])->save();

    expect(
        CommunicationEnrollment::query()
            ->where('sequence_id', $sequence->id)
            ->where('contact_id', $contact->id)
            ->exists()
    )->toBeTrue();

    tenancy()->end();
});
