<?php

declare(strict_types=1);

it('has phpstan.neon with larastan extension', function (): void {
    $path = base_path('phpstan.neon');

    expect($path)->toBeReadableFile();

    $contents = file_get_contents($path);

    expect($contents)
        ->toContain('vendor/larastan/larastan/extension.neon')
        ->and($contents)->toContain('level: 6');
});

it('has psalm.xml with taint analysis handlers enabled', function (): void {
    $path = base_path('psalm.xml');

    expect($path)->toBeReadableFile();

    $contents = file_get_contents($path);

    expect($contents)
        ->toContain('<TaintedInput errorLevel="error" />')
        ->toContain('<TaintedSql errorLevel="error" />')
        ->toContain('<TaintedHtml errorLevel="error" />');
});

it('has an executable security lint script', function (): void {
    $path = base_path('scripts/security-lint.sh');

    expect($path)->toBeReadableFile()
        ->and(is_executable($path))->toBeTrue();
});

it('defines composer audit and security-audit job in the CI workflow', function (): void {
    $workflow = file_get_contents(base_path('.github/workflows/test.yml'));

    expect($workflow)
        ->toContain('composer audit')
        ->toContain('security-audit:');
});

it('defines secrets-scan job in the CI workflow', function (): void {
    $workflow = file_get_contents(base_path('.github/workflows/test.yml'));

    expect($workflow)->toContain('secrets-scan:');
});
