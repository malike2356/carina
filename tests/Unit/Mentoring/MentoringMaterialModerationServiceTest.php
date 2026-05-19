<?php

declare(strict_types=1);

use App\Services\Mentoring\MentoringMaterialModerationService;

it('flags guaranteed returns pattern', function (): void {
    $service = new MentoringMaterialModerationService;
    $result = $service->scan('This investment offers guaranteed returns every year.');

    expect($result->cleared)->toBeFalse()
        ->and($result->flags)->toContain('guaranteed_returns');
});

it('flags no stamp duty misrepresentation', function (): void {
    $service = new MentoringMaterialModerationService;
    $result = $service->scan('Buy this deal with no stamp duty required.');

    expect($result->cleared)->toBeFalse()
        ->and($result->flags)->toContain('no_stamp_duty');
});

it('passes clean property investment text', function (): void {
    $service = new MentoringMaterialModerationService;
    $result = $service->scan('BTL yield analysis for a three-bed terrace in Leeds.');

    expect($result->cleared)->toBeTrue()
        ->and($result->flags)->toBeEmpty();
});
