<?php

declare(strict_types=1);

use App\Services\Deals\Calculators\DealCalculatorRegistry;
use App\Support\Refurb\PublicRefurbCatalogue;

test('public refurb catalogue loads active items for js', function () {
    expect(PublicRefurbCatalogue::isAvailable())->toBeTrue();

    $items = PublicRefurbCatalogue::itemsForJs();

    expect($items)->not->toBeEmpty()
        ->and($items[0])->toHaveKeys(['code', 'label', 'category', 'unit', 'default_unit_cost', 'default_quantity']);
});

test('deal calculator registry exposes refurb budget field mapping', function () {
    expect(DealCalculatorRegistry::supportsPublicRefurbBuilder('brr'))->toBeTrue()
        ->and(DealCalculatorRegistry::refurbBudgetFieldFor('flip'))->toBe('renovation_cost')
        ->and(DealCalculatorRegistry::refurbBudgetFieldFor('btl'))->toBe('refurb_budget')
        ->and(DealCalculatorRegistry::supportsPublicRefurbBuilder('hmo'))->toBeFalse();
});

test('public brr calculator page includes refurb budget builder', function () {
    $response = $this->get(route('public.calculators.show', ['slug' => 'brr']));

    $response->assertOk()
        ->assertSee('Build from items', false)
        ->assertSee('Build renovation budget', false)
        ->assertSee('refurbCatalogue', false);
});
