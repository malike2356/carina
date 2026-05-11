<?php

declare(strict_types=1);

use App\Services\Crm\ContactService;

it('normalizes notes from plain string', function () {
    $svc = app(ContactService::class);

    expect($svc->normalizeNotes('  hello  '))->toBe(['text' => 'hello'])
        ->and($svc->normalizeNotes(''))->toBeNull()
        ->and($svc->normalizeNotes(null))->toBeNull();
});
