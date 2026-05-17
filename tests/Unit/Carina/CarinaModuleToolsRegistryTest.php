<?php

declare(strict_types=1);

use App\Services\Carina\CarinaToolRegistry;

it('registers 95 tenant carina agent tools including 73 module tools', function (): void {
    $registry = app(CarinaToolRegistry::class);
    $names = array_map(fn ($t) => $t->name(), $registry->all());

    expect(count($names))->toBe(95)
        ->and($names)->toContain('create_journal_entry')
        ->and($names)->toContain('generate_security_report')
        ->and($names)->toContain('run_calculator');
});
