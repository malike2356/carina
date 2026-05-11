<?php

declare(strict_types=1);

use App\Services\Theme\CssVariableService;

it('merges overlay onto base', function () {
    $svc = new CssVariableService;
    $merged = $svc->mergeVariables(
        ['--color-primary' => '0 0 0', '--radius-md' => '4px'],
        ['--color-primary' => '26 54 93']
    );

    expect($merged['--color-primary'])->toBe('26 54 93');
    expect($merged['--radius-md'])->toBe('4px');
});

it('validates css variable keys', function () {
    $svc = new CssVariableService;
    expect($svc->validateVariables(['bad' => '1']))->not->toBeEmpty();
    expect($svc->validateVariables(['--color-primary' => '26 54 93']))->toBeEmpty();
});

it('generates a root css block', function () {
    $svc = new CssVariableService;
    $css = $svc->generateCssString([
        '--color-primary' => '26 54 93',
        '--radius-md' => '8px',
    ]);

    expect($css)->toContain(':root {');
    expect($css)->toContain('--color-primary: 26 54 93');
    expect($css)->toContain('--radius-md: 8px');
    expect($css)->not->toContain(':not(.dark)');
});

it('scopes semantic tokens so dark mode chrome is not overridden', function () {
    $svc = new CssVariableService;
    $css = $svc->generateCssString([
        '--color-primary' => '26 54 93',
        '--text-secondary' => '71 85 105',
        '--surface-base' => '255 255 255',
    ]);

    expect($css)->toContain(':root {');
    expect($css)->toContain('--color-primary: 26 54 93');
    expect($css)->toContain(':root:not(.dark):not([data-theme="dark"])');
    expect($css)->toContain('--text-secondary: 71 85 105');
    expect($css)->toContain('--surface-base: 255 255 255');
});

it('converts rgb triplets to hex', function () {
    expect(CssVariableService::tripletToHex('26 54 93'))->toBe('#1a365d');
    expect(CssVariableService::tripletToHex('not rgb'))->toBeNull();
});
