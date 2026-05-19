<?php

declare(strict_types=1);

use App\Services\Carina\CarinaToolRegistry;
use App\Services\Carina\ToolHandlers\SourcingToolHandler;

it('registers search_local_listings in the Carina tool registry', function (): void {
    $names = array_map(fn ($tool) => $tool->name(), app(CarinaToolRegistry::class)->all());

    expect($names)->toContain('search_local_listings');
});

it('parses natural language listing search filters without an LLM call', function (): void {
    $handler = app(SourcingToolHandler::class);
    $method = new ReflectionMethod($handler, 'parseNlQuery');
    $method->setAccessible(true);

    $filters = $method->invoke($handler, 'Show me three-bed Manchester HMO under £200k with 8% yield');

    expect($filters['min_beds'])->toBe(3)
        ->and($filters['postcode_prefix'])->toBe('M')
        ->and($filters['strategy'])->toBe('hmo')
        ->and($filters['max_price'])->toBe(200000.0)
        ->and($filters['min_yield_pct'])->toBe(8.0);
});
