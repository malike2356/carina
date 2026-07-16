<?php

declare(strict_types=1);

use App\Models\Central\WaitlistEntry;
use App\Services\Propcalc\PropcalcWaitlistTouchService;
use Tests\Concerns\RefreshDatabase;

uses(RefreshDatabase::class);

it('creates a waitlist entry with required fields for propcalc pdf capture', function () {
    $entry = app(PropcalcWaitlistTouchService::class)->touch('lordsesame@gmail.com', 'brr');

    expect($entry->email)->toBe('lordsesame@gmail.com')
        ->and($entry->name)->toBe('Lordsesame')
        ->and($entry->user_type)->toBe('propcalc')
        ->and($entry->segment)->toBe('propcalc')
        ->and($entry->referral_code)->not->toBeEmpty()
        ->and($entry->interests)->toContain('brr', 'propcalc_pdf');

    expect(WaitlistEntry::query()->where('email', 'lordsesame@gmail.com')->count())->toBe(1);
});

it('merges interests when the email already exists on the waitlist', function () {
    WaitlistEntry::query()->create([
        'email' => 'repeat@example.test',
        'name' => 'Repeat User',
        'user_type' => 'operator',
        'interests' => ['newsletter'],
        'referral_code' => 'EXISTING1234',
        'interest_score' => 0,
        'segment' => 'warm',
    ]);

    $entry = app(PropcalcWaitlistTouchService::class)->touch('repeat@example.test', 'btl');

    expect($entry->name)->toBe('Repeat User')
        ->and($entry->referral_code)->toBe('EXISTING1234')
        ->and($entry->interests)->toContain('newsletter', 'btl', 'propcalc_pdf');
});

it('stores supplied name and optional phone for calculator follow up', function () {
    $entry = app(PropcalcWaitlistTouchService::class)->touch(
        'lead@example.test',
        'strategy_finder',
        'save_results_follow_up',
        'Amina Mensah',
        '07123 456789',
    );

    expect($entry->email)->toBe('lead@example.test')
        ->and($entry->name)->toBe('Amina Mensah')
        ->and($entry->phone)->toBe('07123 456789')
        ->and($entry->phone_contact_requested_at)->not->toBeNull()
        ->and($entry->interests)->toContain('strategy_finder', 'propcalc_lead', 'save_results_follow_up');
});

it('does not overwrite an existing phone when no phone is supplied', function () {
    WaitlistEntry::query()->create([
        'email' => 'existing-phone@example.test',
        'name' => 'Existing Phone',
        'phone' => '07000 000000',
        'phone_contact_requested_at' => now()->subDay(),
        'user_type' => 'operator',
        'interests' => ['newsletter'],
        'referral_code' => 'PHONE1234',
        'interest_score' => 0,
        'segment' => 'warm',
    ]);

    $entry = app(PropcalcWaitlistTouchService::class)->touch(
        'existing-phone@example.test',
        'brr',
        'save_results_follow_up',
        'Existing Phone',
    );

    expect($entry->phone)->toBe('07000 000000')
        ->and($entry->interests)->toContain('newsletter', 'brr', 'save_results_follow_up');
});
