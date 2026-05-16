<?php

declare(strict_types=1);

use App\Services\Vcal\VcalIntakeDisqualifiedException;
use App\Services\Vcal\VcalIntakeValidator;

it('throws when answer matches disqualify_values', function (): void {
    $v = new VcalIntakeValidator;
    $schema = [
        [
            'key' => 'budget',
            'label' => 'Budget',
            'type' => 'select',
            'choices' => ['Under 10k', 'Over 10k'],
            'disqualify_values' => ['Under 10k'],
            'disqualify_message' => 'We only work with larger budgets.',
        ],
    ];

    expect(fn () => $v->validateAndNormalise($schema, ['budget' => 'Under 10k']))
        ->toThrow(VcalIntakeDisqualifiedException::class, 'We only work with larger budgets.');
});

it('accepts non-disqualified answers', function (): void {
    $v = new VcalIntakeValidator;
    $schema = [
        [
            'key' => 'budget',
            'label' => 'Budget',
            'type' => 'select',
            'choices' => ['Under 10k', 'Over 10k'],
            'disqualify_values' => ['Under 10k'],
        ],
    ];

    $out = $v->validateAndNormalise($schema, ['budget' => 'Over 10k']);
    expect($out['budget'])->toBe('Over 10k');
});
