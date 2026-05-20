<?php

declare(strict_types=1);

use App\Support\Waitlist\MarketingWaitlistMapper;

it('maps marketing payloads to waitlist entry data', function (): void {
    $data = MarketingWaitlistMapper::toEntryData([
        'first_name' => 'Alex',
        'last_name' => 'Mentor',
        'email' => 'alex@example.test',
        'phone' => '',
        'role' => 'property_mentor',
        'plan' => 'academy',
        'message' => '',
        'source' => 'pricing_compare',
    ]);

    expect($data['name'])->toBe('Alex Mentor')
        ->and($data['user_type'])->toBe('mentor')
        ->and($data['interests']['interested_plan'])->toBe('academy')
        ->and($data['interests']['source'])->toBe('pricing_compare');
});

it('maps unsure plans using role heuristics', function (): void {
    $data = MarketingWaitlistMapper::toEntryData([
        'first_name' => 'Pat',
        'last_name' => '',
        'email' => 'pat@example.test',
        'role' => 'portfolio_investor',
        'plan' => 'unsure',
        'source' => '',
    ]);

    expect($data['user_type'])->toBe('investor')
        ->and($data['interests']['source'])->toBe('propreneur_waitlist');
});
