<?php

declare(strict_types=1);

use App\Support\UiThemeVariables;

it('converts hex primary colours to RGB triplets', function () {
    expect(UiThemeVariables::hexToRgbTriplet('#4f46e5'))->toBe([79, 70, 229]);
    expect(UiThemeVariables::hexToRgbTriplet('#fff'))->toBe([255, 255, 255]);
    expect(UiThemeVariables::hexToRgbTriplet('invalid'))->toBeNull();
});

it('builds a css block containing primary channels', function () {
    $css = UiThemeVariables::cssBlock([
        'primary_color' => '#059669',
        'mode' => 'system',
        'font' => 'inter',
        'border_radius' => 'md',
    ]);

    expect($css)->toContain('--color-primary:');
    expect($css)->toContain('--color-link:');
    expect($css)->toContain('5 150 105');
});

it('embeds a google font stack when font is not inter', function () {
    $css = UiThemeVariables::cssBlock([
        'primary_color' => '#059669',
        'mode' => 'system',
        'font' => 'dm_sans',
        'border_radius' => 'md',
    ]);

    expect($css)->toContain("'DM Sans'");
    expect($css)->toContain('--font-sans:');
});

it('normalises unknown font ids in client payload', function () {
    $payload = UiThemeVariables::clientPayload([
        'primary_color' => '#000000',
        'mode' => 'light',
        'font' => 'typo_typo_typo',
        'border_radius' => 'md',
    ]);

    expect($payload['font'])->toBe('inter');
});
