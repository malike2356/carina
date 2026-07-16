<?php

declare(strict_types=1);

use App\Models\Central\WaitlistEntry;
use App\Services\Waitlist\WaitlistService;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\ValidationException;

it('rejects duplicate signup for confirmed email', function (): void {
    Mail::fake();

    WaitlistEntry::factory()->confirmed()->create(['email' => 'taken@example.test']);

    $svc = app(WaitlistService::class);

    expect(fn () => $svc->addEntry([
        'email' => 'taken@example.test',
        'name' => 'X',
        'user_type' => 'investor',
        'interests' => [],
    ], null))->toThrow(ValidationException::class);
});

it('refreshes unconfirmed signup instead of duplicating row', function (): void {
    Mail::fake();

    $svc = app(WaitlistService::class);
    $svc->addEntry([
        'email' => 'twice@example.test',
        'name' => 'First',
        'user_type' => 'mentor',
        'interests' => [],
    ], null);

    $firstId = WaitlistEntry::query()->where('email', 'twice@example.test')->value('id');

    $svc->addEntry([
        'email' => 'twice@example.test',
        'name' => 'Second',
        'user_type' => 'mentor',
        'interests' => [],
    ], null);

    expect(WaitlistEntry::query()->where('email', 'twice@example.test')->count())->toBe(1)
        ->and(WaitlistEntry::query()->where('email', 'twice@example.test')->value('id'))->toBe($firstId)
        ->and(WaitlistEntry::query()->where('email', 'twice@example.test')->value('name'))->toBe('Second');
});
