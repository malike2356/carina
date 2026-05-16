<?php

declare(strict_types=1);

use App\Models\Tenant\DealAnalysis;
use App\Services\Deals\MotivatedSellerScoringService;

it('scores a deal with price reduction, long DOM, and relisted signals as motivated', function (): void {
    $scorer = new MotivatedSellerScoringService;

    $deal = new DealAnalysis([
        'metrics' => [
            'asking_price' => 250000,
            'original_asking_price' => 300000,
            'listed_date' => now()->subDays(95)->toDateString(),
            'notes' => 'Back on market after previous sale fell through.',
            'listing_source_url' => 'https://www.rightmove.co.uk/properties/1',
        ],
    ]);

    $result = $scorer->score($deal);

    expect($result['score'])->toBeGreaterThanOrEqual(60)
        ->and($result['label'])->toBe('Motivated')
        ->and($result['signals'])->toContain('price_reduced')
        ->and($result['signals'])->toContain('listed_over_90_days')
        ->and($result['signals'])->toContain('relisted');
});

it('scores a fresh listing with no signals as low motivation', function (): void {
    $scorer = new MotivatedSellerScoringService;

    $deal = new DealAnalysis([
        'metrics' => [
            'asking_price' => 200000,
            'listing_source_url' => 'https://www.rightmove.co.uk/properties/2',
        ],
        'listed_at' => now()->subDays(5),
    ]);

    $result = $scorer->score($deal);

    expect($result['score'])->toBe(0)
        ->and($result['label'])->toBe('Low motivation')
        ->and($result['signals'])->toBe([]);
});

it('adds motivated_language when must sell appears in the description', function (): void {
    $scorer = new MotivatedSellerScoringService;

    $deal = new DealAnalysis([
        'metrics' => [
            'asking_price' => 180000,
            'notes' => 'Vendor must sell before relocation next month.',
            'listing_source_url' => 'https://www.zoopla.co.uk/for-sale/details/1',
        ],
    ]);

    $result = $scorer->score($deal);

    expect($result['signals'])->toContain('motivated_language')
        ->and($result['score'])->toBeGreaterThanOrEqual(10);
});

it('returns stable unique signals when scored twice', function (): void {
    $scorer = new MotivatedSellerScoringService;

    $deal = new DealAnalysis([
        'metrics' => [
            'asking_price' => 240000,
            'original_asking_price' => 260000,
            'notes' => 'Must sell quickly, chain free urgent.',
            'listing_source_url' => 'https://www.rightmove.co.uk/properties/rescore',
        ],
    ]);

    $first = $scorer->score($deal);
    $second = $scorer->score($deal);

    expect($first)->toBe($second)
        ->and($first['signals'])->not->toBeEmpty()
        ->and(count($first['signals']))->toBe(count(array_unique($first['signals'])));
});
