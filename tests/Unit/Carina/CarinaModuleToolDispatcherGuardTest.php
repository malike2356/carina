<?php

declare(strict_types=1);

use App\Models\Tenant\CarinaConversation;
use App\Services\Carina\CarinaModuleToolDispatcher;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

it('blocks module tool dispatch when raw_sql is present in args', function (): void {
    Cache::flush();

    $conversation = new CarinaConversation;
    $conversation->forceFill([
        'tenant_id' => (string) Str::uuid(),
        'title' => 'Guard test',
        'context_type' => 'general',
    ]);

    $dispatcher = app(CarinaModuleToolDispatcher::class);
    $result = $dispatcher->dispatch(
        'create_journal_entry',
        ['raw_sql' => 'SELECT * FROM users'],
        null,
        $conversation,
        (string) Str::uuid(),
    );

    expect($result->success)->toBeFalse()
        ->and($result->error)->toBe('guard_blocked')
        ->and($result->summary)->toContain('raw_sql');
});
