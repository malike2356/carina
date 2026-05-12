<?php

declare(strict_types=1);

use App\Models\Tenant\Contact;
use App\Services\LeadFunnel\LeadScoringService;

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
