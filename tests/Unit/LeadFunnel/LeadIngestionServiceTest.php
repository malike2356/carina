<?php

declare(strict_types=1);

use App\Services\LeadFunnel\LeadIngestionService;
use App\Support\LeadFunnel\LeadFunnelSegment;

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
