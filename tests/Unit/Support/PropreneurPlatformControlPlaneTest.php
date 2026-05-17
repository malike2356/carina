<?php

declare(strict_types=1);

use App\Support\Auth\PropreneurPlatformControlPlane;

it('defines grouped platform admin capabilities', function (): void {
    $groups = PropreneurPlatformControlPlane::capabilityGroups();

    expect($groups)->toHaveCount(5);

    $itemCount = 0;
    foreach ($groups as $group) {
        expect($group)->toHaveKeys(['title', 'items']);
        expect($group['items'])->not->toBeEmpty();

        foreach ($group['items'] as $item) {
            expect($item)->toHaveKeys(['label', 'hint']);
            $itemCount++;
        }
    }

    expect($itemCount)->toBeGreaterThanOrEqual(16);
});
