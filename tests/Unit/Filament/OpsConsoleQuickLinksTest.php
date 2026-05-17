<?php

declare(strict_types=1);

use App\Filament\Widgets\OpsConsoleQuickLinks;
use App\Models\Central\FeatureFlag;

it('includes workspace people quick link when crm feature flag is enabled', function (): void {
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'crm')->update(['enabled' => true]);

    $labels = array_column((new OpsConsoleQuickLinks)->quickLinks(), 'label');

    expect($labels)->toContain('Workspace people');
});

it('omits workspace people quick link when crm feature flag is disabled', function (): void {
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'crm')->update(['enabled' => false]);

    $labels = array_column((new OpsConsoleQuickLinks)->quickLinks(), 'label');

    expect($labels)->not->toContain('Workspace people');
});
