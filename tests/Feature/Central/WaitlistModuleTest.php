<?php

declare(strict_types=1);

use App\Mail\Waitlist\WaitlistConfirmationMailable;
use App\Mail\Waitlist\WaitlistUpdateMailable;
use App\Mail\Waitlist\WaitlistWelcomeMailable;
use App\Models\Central\MarketingCampaign;
use App\Models\Central\PlatformUser;
use App\Models\Central\WaitlistEntry;
use App\Models\Central\WaitlistReferral;
use App\Services\Waitlist\EmailSequenceService;
use App\Services\Waitlist\WaitlistService;
use Illuminate\Support\Facades\Mail;

it('accepts public signup and sends confirmation mail', function (): void {
    Mail::fake();

    $response = $this->postJson(route('public.waitlist.signup'), [
        'email' => 'waiter@example.test',
        'name' => 'Waiter Test',
        'user_type' => 'investor',
        'interests' => [
            'capital_band' => 'high',
            'strategies' => ['btl'],
            'timeline' => '0-3m',
        ],
    ]);

    $response->assertCreated();
    Mail::assertSent(WaitlistConfirmationMailable::class);

    $entry = WaitlistEntry::query()->where('email', 'waiter@example.test')->firstOrFail();
    expect($entry->confirmation_token)->not->toBeNull()
        ->and($entry->confirmed_at)->toBeNull();
});

it('confirms via token and sends welcome mail once', function (): void {
    Mail::fake();

    $entry = WaitlistEntry::factory()->create([
        'email' => 'confirm-me@example.test',
        'confirmation_token' => 'tokentokentokentokentokentokentokentokentokentok',
    ]);

    $this->get(route('public.waitlist.confirm', ['token' => $entry->confirmation_token]))
        ->assertRedirect(route('central.login'));

    $entry->refresh();
    expect($entry->confirmed_at)->not->toBeNull()
        ->and($entry->confirmation_token)->toBeNull();

    Mail::assertSent(WaitlistWelcomeMailable::class);
});

it('tracks referral and completes on confirm', function (): void {
    Mail::fake();

    $referrer = WaitlistEntry::factory()->confirmed()->create([
        'email' => 'ref@example.test',
        'referral_code' => 'REFCODE123',
    ]);

    app(WaitlistService::class)->addEntry([
        'email' => 'friend@example.test',
        'name' => 'Friend',
        'user_type' => 'operator',
        'interests' => [],
    ], 'REFCODE123');

    $friend = WaitlistEntry::query()->where('email', 'friend@example.test')->firstOrFail();
    expect($friend->referrer_id)->toBe($referrer->id);

    $refRow = WaitlistReferral::query()
        ->where('referrer_id', $referrer->id)
        ->where('referred_email', 'friend@example.test')
        ->firstOrFail();
    expect($refRow->status)->toBe(WaitlistReferral::STATUS_REGISTERED);

    app(WaitlistService::class)->confirmByToken((string) $friend->fresh()->confirmation_token);

    $refRow->refresh();
    expect($refRow->status)->toBe(WaitlistReferral::STATUS_COMPLETED);
});

it('allows super admin to view waitlist admin', function (): void {
    $admin = PlatformUser::factory()->superAdmin()->create();

    $this->actingAs($admin, 'platform')
        ->get(route('admin.waitlist.index'))
        ->assertOk()
        ->assertSee('Waitlist', false);
});

it('filters waitlist admin by propcalc origin and feedback tag', function (): void {
    $admin = PlatformUser::factory()->superAdmin()->create();

    WaitlistEntry::factory()->create([
        'email' => 'propcalc-only@example.test',
        'segment' => 'propcalc',
        'user_type' => 'propcalc',
        'interests' => ['brr', 'propcalc_pdf'],
    ]);
    WaitlistEntry::factory()->create([
        'email' => 'propcalc-feedback@example.test',
        'segment' => 'propcalc',
        'user_type' => 'propcalc',
        'interests' => ['propcalc_feedback'],
    ]);
    WaitlistEntry::factory()->create([
        'email' => 'prelaunch@example.test',
        'segment' => 'launch',
        'user_type' => 'investor',
        'interests' => ['source' => 'website'],
    ]);

    $this->actingAs($admin, 'platform')
        ->get(route('admin.waitlist.index', ['origin' => 'propcalc']))
        ->assertOk()
        ->assertSee('propcalc-only@example.test', false)
        ->assertSee('propcalc-feedback@example.test', false)
        ->assertDontSee('prelaunch@example.test', false);

    $this->actingAs($admin, 'platform')
        ->get(route('admin.waitlist.index', ['origin' => 'propcalc', 'has_feedback' => 1]))
        ->assertOk()
        ->assertSee('propcalc-feedback@example.test', false)
        ->assertDontSee('propcalc-only@example.test', false);
});

it('returns json status for known email', function (): void {
    WaitlistEntry::factory()->confirmed()->create(['email' => 'status@example.test']);

    $this->getJson(route('public.waitlist.status', ['email' => rawurlencode('status@example.test')]))
        ->assertOk()
        ->assertJsonPath('found', true)
        ->assertJsonPath('confirmed', true);
});

it('sends campaign broadcast to confirmed segment', function (): void {
    Mail::fake();

    WaitlistEntry::factory()->confirmed()->create([
        'email' => 'seg@example.test',
        'user_type' => 'investor',
    ]);

    $campaign = MarketingCampaign::query()->create([
        'name' => 'T1',
        'subject' => 'Hello',
        'content' => 'Body line',
        'segment' => 'user_type:investor',
    ]);

    $n = app(EmailSequenceService::class)->sendCampaignBroadcast($campaign);

    expect($n)->toBe(1);
    Mail::assertSent(WaitlistUpdateMailable::class);
    expect($campaign->fresh()->sent_at)->not->toBeNull();
});
