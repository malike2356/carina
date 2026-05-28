<?php

declare(strict_types=1);

use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;

beforeEach(function (): void {
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

it('runs public utility calculators', function (): void {
    $this->postJson(route('public.calculators.run', ['slug' => 'rental_yield']), [
        'purchase_price' => 200000,
        'monthly_rent' => 1200,
    ])->assertOk()
        ->assertJsonPath('outputs.gross_yield_pct', fn ($v) => $v > 0);

    $this->postJson(route('public.calculators.run', ['slug' => 'void_period']), [
        'monthly_rent' => 1000,
        'void_weeks' => 2,
    ])->assertOk()
        ->assertJsonPath('outputs.total_void_cost', fn ($v) => $v > 0);
});

it('serves utility calculator pages', function (): void {
    $this->get(route('public.calculators.show', ['slug' => 'skip_hire']))
        ->assertOk()
        ->assertSee('Skip hire', false);

    $this->get(route('public.calculators.show', ['slug' => 'snagging_list']))
        ->assertOk()
        ->assertSee('Snagging', false);
});
