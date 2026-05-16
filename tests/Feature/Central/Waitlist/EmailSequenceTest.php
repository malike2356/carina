<?php

declare(strict_types=1);

use App\Mail\Waitlist\WaitlistWelcomeMailable;
use App\Models\Central\WaitlistEntry;
use App\Services\Waitlist\EmailSequenceService;
use Illuminate\Support\Facades\Mail;

it('does not resend welcome when already sent', function (): void {
    Mail::fake();

    $entry = WaitlistEntry::factory()->confirmed()->create([
        'welcome_sent_at' => now(),
    ]);

    app(EmailSequenceService::class)->sendWelcome($entry);

    Mail::assertNothingSent();
});

it('sends welcome for confirmed entry without welcome timestamp', function (): void {
    Mail::fake();

    $entry = WaitlistEntry::factory()->confirmed()->create([
        'welcome_sent_at' => null,
    ]);

    app(EmailSequenceService::class)->sendWelcome($entry);

    Mail::assertSent(WaitlistWelcomeMailable::class);
});
