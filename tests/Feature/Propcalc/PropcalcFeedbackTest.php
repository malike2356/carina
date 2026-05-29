<?php

declare(strict_types=1);

use App\Models\Central\PropcalcFeedback;
use App\Models\Central\WaitlistEntry;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Tests\Concerns\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

it('stores propcalc feedback and links to waitlist with score boost', function (): void {
    $response = $this->postJson(route('public.calculators.feedback'), [
        'email' => 'feedback.user@example.test',
        'name' => 'Feedback User',
        'calculator_slug' => 'brr',
        'rating' => 5,
        'show_working_helpful' => 'yes',
        'would_recommend' => 'yes',
        'message' => 'Show working made the refinance step clear.',
        'source_page' => 'calculator:brr',
    ]);

    $response->assertOk()->assertJson(['ok' => true]);

    $feedback = PropcalcFeedback::query()->where('email', 'feedback.user@example.test')->first();
    expect($feedback)->not->toBeNull()
        ->and($feedback->rating)->toBe(5)
        ->and($feedback->calculator_slug)->toBe('brr')
        ->and($feedback->status)->toBe(PropcalcFeedback::STATUS_NEW)
        ->and($feedback->message)->toContain('refinance');

    $entry = WaitlistEntry::query()->where('email', 'feedback.user@example.test')->first();
    expect($entry)->not->toBeNull()
        ->and($entry->segment)->toBe('propcalc')
        ->and($entry->interest_score)->toBeGreaterThanOrEqual(15)
        ->and($entry->interests)->toContain('propcalc_feedback');
});

it('rejects invalid ratings', function (): void {
    $this->postJson(route('public.calculators.feedback'), [
        'email' => 'bad@example.test',
        'rating' => 0,
    ])->assertStatus(422);

    expect(PropcalcFeedback::query()->where('email', 'bad@example.test')->exists())->toBeFalse();
});

it('silently accepts honeypot spam submissions', function (): void {
    $this->postJson(route('public.calculators.feedback'), [
        'email' => 'spam@example.test',
        'rating' => 5,
        'website' => 'http://spam.test',
    ])->assertOk();

    expect(PropcalcFeedback::query()->where('email', 'spam@example.test')->exists())->toBeFalse();
});
