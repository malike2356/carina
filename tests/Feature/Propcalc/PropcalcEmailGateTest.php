<?php

declare(strict_types=1);

use App\Jobs\Propcalc\SendPropcalcDealPackJob;
use App\Models\Central\WaitlistEntry;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Illuminate\Support\Facades\Bus;
use Tests\Concerns\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->withoutMiddleware(VerifyCsrfToken::class);
    Bus::fake();
});

it('queues a deal pack email and records a propcalc waitlist touch', function (): void {
    $response = $this->postJson(route('public.calculators.email-gate'), [
        'email' => 'lordsesame@gmail.com',
        'slug' => 'brr',
        'outputs' => ['monthly_cashflow' => 100],
        'inputs' => ['purchase_price' => 200000],
        'assumptions' => ['Test assumption'],
    ]);

    $response->assertOk()
        ->assertJson(['ok' => true, 'queued' => true]);

    Bus::assertDispatched(SendPropcalcDealPackJob::class, function (SendPropcalcDealPackJob $job): bool {
        return $job->email === 'lordsesame@gmail.com'
            && ($job->snapshot['strategy'] ?? '') === 'brr';
    });

    $entry = WaitlistEntry::query()->where('email', 'lordsesame@gmail.com')->first();
    expect($entry)->not->toBeNull()
        ->and($entry->name)->not->toBe('')
        ->and($entry->referral_code)->not->toBeEmpty();
});

it('rejects pdf requests without a calculator run', function (): void {
    $this->postJson(route('public.calculators.email-gate'), [
        'email' => 'user@example.test',
        'outputs' => ['monthly_cashflow' => 100],
    ])->assertStatus(422)
        ->assertJsonFragment(['message' => 'Run the calculator first, then request your PDF.']);

    Bus::assertNothingDispatched();
});
