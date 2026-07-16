<?php

declare(strict_types=1);

use App\Support\Auth\PropreneurInvestorJourney;

it('defines a multi-phase investor journey with seven steps', function (): void {
    $steps = PropreneurInvestorJourney::steps();

    expect($steps)->toHaveCount(7)
        ->and(array_column($steps, 'phase'))->toContain('Acquire', 'Operate', 'Grow', 'Guide');

    foreach ($steps as $step) {
        expect($step)->toHaveKeys(['phase', 'label', 'hint'])
            ->and($step['label'])->not->toBe('')
            ->and($step['hint'])->not->toBe('');
    }
});
