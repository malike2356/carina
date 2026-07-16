<?php

declare(strict_types=1);

use App\Support\DealSourcingIntelligence;

it('DealSourcingIntelligence returns all expected source channel keys', function (): void {
    $channels = DealSourcingIntelligence::sourceChannels();

    expect($channels)->toHaveKey('estate_agent')
        ->toHaveKey('auction_fail')
        ->toHaveKey('networking');
});

it('DealSourcingIntelligence returns motivation categories with urgency', function (): void {
    $urgency = DealSourcingIntelligence::motivationUrgency();

    expect($urgency['financial_distress'])->toBe('high')
        ->and($urgency['bailiff_eviction'])->toBe('very_high');
});
