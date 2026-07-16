<?php

declare(strict_types=1);

use App\Models\Central\WaitlistEntry;
use App\Services\Waitlist\InterestScoringService;

it('scores interests from configured weights', function (): void {
    $svc = new InterestScoringService;
    $score = $svc->calculateScore([
        'capital_band' => 'high',
        'strategies' => ['btl', 'hmo', 'flip'],
        'timeline' => '0-3m',
    ]);
    expect($score)->toBeGreaterThan(50);
});

it('assigns segment tiers from score and user type', function (): void {
    $svc = new InterestScoringService;
    $entry = new WaitlistEntry;
    $entry->forceFill([
        'user_type' => 'investor',
        'interest_score' => 75,
    ]);
    expect($svc->getSegment($entry))->toStartWith('priority:');
});

it('prioritizes entries by score then id', function (): void {
    $svc = new InterestScoringService;
    $a = new WaitlistEntry;
    $a->forceFill(['id' => 1, 'interest_score' => 10, 'user_type' => 'investor']);
    $b = new WaitlistEntry;
    $b->forceFill(['id' => 2, 'interest_score' => 50, 'user_type' => 'investor']);
    $ordered = $svc->prioritize(collect([$a, $b]));
    expect($ordered->first()->id)->toBe(2);
});
