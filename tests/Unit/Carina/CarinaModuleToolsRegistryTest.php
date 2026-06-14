<?php

declare(strict_types=1);

use App\Services\Carina\CarinaToolRegistry;

it('registers 144 tenant carina agent tools including clarify', function (): void {
    $registry = app(CarinaToolRegistry::class);
    $names = array_map(fn ($t) => $t->name(), $registry->all());

    expect(count($names))->toBe(144)
        ->and($names)->toContain('create_journal_entry')
        ->and($names)->toContain('generate_security_report')
        ->and($names)->toContain('run_calculator')
        ->and($names)->toContain('remember')
        ->and($names)->toContain('recall')
        ->and($names)->toContain('create_scheduled_task')
        ->and($names)->toContain('list_scheduled_tasks')
        ->and($names)->toContain('transcribe_audio')
        ->and($names)->toContain('webhook_subscribe')
        ->and($names)->toContain('list_webhooks')
        ->and($names)->toContain('clarify');
});
