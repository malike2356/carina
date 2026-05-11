<?php

declare(strict_types=1);

use App\Support\Theme\WorkspaceThemePresetCatalog;

it('loads seven workspace presets from JSON', function () {
    $defs = WorkspaceThemePresetCatalog::definitions();

    expect($defs)->toHaveCount(7);
    expect(array_column($defs, 'slug'))->toContain('property-blue', 'forest');
});
