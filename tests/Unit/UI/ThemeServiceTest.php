<?php

use App\Models\Central\PlatformSetting;
use App\Services\UI\ThemeService;
use Tests\Concerns\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    PlatformSetting::where('key', 'like', 'ui.%')->delete();
});

it('returns default theme when no platform settings exist', function () {
    $service = new ThemeService;
    $theme = $service->getTheme();

    expect($theme)->toMatchArray([
        'primary_color' => '#1a365d',
        'mode' => 'system',
        'font' => 'inter',
        'border_radius' => 'md',
    ]);
});

it('returns all available preset themes', function () {
    $themes = (new ThemeService)->getAvailableThemes();

    expect($themes)->toBeArray()->not->toBeEmpty();
    expect($themes[0])->toHaveKeys(['id', 'name', 'primary_color']);
});

it('returns font options for the theme UI', function () {
    $fonts = (new ThemeService)->getAvailableFonts();

    expect($fonts)->not->toBeEmpty();
    expect($fonts[0])->toHaveKeys(['id', 'label']);
    expect(collect($fonts)->pluck('id')->all())->toContain('inter', 'system');
});
