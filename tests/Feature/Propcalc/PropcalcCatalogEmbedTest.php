<?php

declare(strict_types=1);

use App\Services\Deals\Calculators\DealCalculatorRegistry;

it('returns a public calculator catalog with 27 tools', function (): void {
    $response = $this->getJson(route('public.calculators.catalog'));

    $response->assertOk()
        ->assertJsonPath('version', 1)
        ->assertJsonPath('count', 27)
        ->assertJsonStructure([
            'calculators' => [
                ['slug', 'label', 'kind', 'description', 'url', 'embed_url'],
            ],
            'groups' => ['strategies', 'tools', 'utilities'],
        ]);

    expect($response->json('calculators.0.slug'))->toBe('strategy_finder');
});

it('serves an iframe-friendly embed page for a calculator', function (): void {
    $response = $this->get(route('public.calculators.embed', ['slug' => 'brr']));

    $response->assertOk()
        ->assertSee('Run calculator', false)
        ->assertDontSee('propCALC.uk', false);

    $csp = (string) $response->headers->get('Content-Security-Policy');
    expect($csp)->toContain('frame-ancestors http: https:');
    expect($response->headers->get('X-Frame-Options'))->toBeNull();
});

it('builds catalog payload with custom base url', function (): void {
    $payload = DealCalculatorRegistry::publicCatalogPayload('https://propcalc.uk');

    expect($payload['count'])->toBe(27)
        ->and($payload['calculators'][1]['embed_url'])->toBe('https://propcalc.uk/calculators/btl/embed');
});
