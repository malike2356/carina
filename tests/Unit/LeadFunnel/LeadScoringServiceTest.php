<?php

declare(strict_types=1);

use App\Events\LeadFunnel\HotLeadDetected;
use App\Models\Central\FeatureFlag;
use App\Models\Tenant\Contact;
use App\Services\LeadFunnel\LeadScoringService;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;

uses(RefreshDatabase::class);

it('scores linkedin leads higher than tiktok leads', function (): void {
    $service = app(LeadScoringService::class);

    $linkedin = new Contact(['source' => 'linkedin', 'type' => 'other', 'custom_fields' => [], 'last_lead_activity_at' => now()]);
    $tiktok = new Contact(['source' => 'tiktok', 'type' => 'other', 'custom_fields' => [], 'last_lead_activity_at' => now()]);

    expect($service->calculateScore($linkedin))->toBeGreaterThan($service->calculateScore($tiktok));
});

it('never returns a negative score', function (): void {
    $service = app(LeadScoringService::class);
    $contact = new Contact([
        'source' => 'tiktok',
        'type' => 'tenant',
        'custom_fields' => [],
        'last_lead_activity_at' => now()->subDays(60),
    ]);

    expect($service->calculateScore($contact))->toBeGreaterThanOrEqual(0);
});

it('adds investor segment modifier', function (): void {
    $service = app(LeadScoringService::class);
    $base = new Contact(['source' => 'facebook', 'type' => 'other', 'custom_fields' => [], 'last_lead_activity_at' => now()]);
    $investor = new Contact(['source' => 'facebook', 'type' => 'investor', 'custom_fields' => [], 'last_lead_activity_at' => now()]);

    expect($service->calculateScore($investor))->toBeGreaterThan($service->calculateScore($base));
});

it('adds engagement points from custom fields', function (): void {
    $service = app(LeadScoringService::class);

    $cold = new Contact([
        'source' => 'facebook',
        'type' => 'other',
        'custom_fields' => [],
        'last_lead_activity_at' => now(),
    ]);

    $hot = new Contact([
        'source' => 'facebook',
        'type' => 'other',
        'custom_fields' => [
            'email_opens' => 3,
            'email_clicks' => 2,
            'reply_received' => true,
        ],
        'last_lead_activity_at' => now(),
    ]);

    expect($service->calculateScore($hot))->toBeGreaterThan($service->calculateScore($cold));
});

it('can exceed the configured hot lead threshold with strong engagement', function (): void {
    config(['lead_funnel.hot_lead_score_threshold' => 120]);

    $service = app(LeadScoringService::class);
    $contact = new Contact([
        'source' => 'linkedin',
        'type' => 'investor',
        'custom_fields' => [
            'email_opens' => 3,
            'email_clicks' => 3,
            'reply_received' => true,
            'trial_started' => true,
        ],
        'last_lead_activity_at' => now(),
    ]);

    expect($service->calculateScore($contact))->toBeGreaterThanOrEqual(120);
});

it('hot_lead_notification_fires_when_score_crosses_120', function (): void {
    Event::fake([HotLeadDetected::class]);
    config(['lead_funnel.hot_lead_score_threshold' => 120]);

    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Score Test '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'score-'.uniqid().'@test.test',
        'plan' => 'starter',
    ]);
    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();

    $contact = Contact::factory()->create([
        'source' => 'linkedin',
        'type' => 'investor',
        'lead_score' => 0,
        'custom_fields' => [
            'email_opens' => 3,
            'email_clicks' => 3,
            'reply_received' => true,
            'trial_started' => true,
        ],
        'last_lead_activity_at' => now(),
    ]);

    app(LeadScoringService::class)->updateContactScore($contact);

    Event::assertDispatched(HotLeadDetected::class);

    tenancy()->end();
});
