<?php

declare(strict_types=1);

use App\Services\Carina\CarinaBaselineContextService;

it('includes writing rules in carina persona config', function (): void {
    $persona = (string) config('ai.carina_persona');

    expect($persona)->toContain('WRITING RULES (hard constraint, no exceptions)')
        ->and($persona)->toContain('Never use em dashes (U+2014) or en dashes (U+2013)')
        ->and($persona)->toContain('Never use emojis of any kind');
});

it('exposes writing style rules constant for baseline context', function (): void {
    $rules = CarinaBaselineContextService::writingStyleRules();

    expect($rules)->toContain('WRITING RULES (hard constraint, no exceptions)')
        ->and($rules)->toContain('Never use emojis')
        ->and($rules)->toContain('Never use em dashes');
});

it('scan-writing-style script exists and is executable', function (): void {
    $script = base_path('scripts/scan-writing-style.php');

    expect(is_file($script))->toBeTrue();

    $output = [];
    $exitCode = 0;
    exec('php '.escapeshellarg($script).' 2>&1', $output, $exitCode);

    expect(implode("\n", $output))->toMatch('/violations:|No violations found/');
});
