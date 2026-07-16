<?php

declare(strict_types=1);

use App\Services\Carina\CarinaBrainModifierService;

it('maps labels for every allowed brain key', function (): void {
    $svc = app(CarinaBrainModifierService::class);
    $labels = $svc->labelsByKey();

    foreach ($svc->allowedKeys() as $key) {
        expect($labels)->toHaveKey($key)
            ->and($labels[$key])->not->toBe('');
    }
});
