<?php

declare(strict_types=1);

use App\Services\Carina\BusinessStructureAdvisorService;

it('recommends personal ownership for low income short horizon profile', function (): void {
    $service = new BusinessStructureAdvisorService;
    $scored = $service->score([
        'tax_bracket' => 'retired_or_low',
        'investment_horizon_years' => 3,
        'target_property_count' => 1,
        'strategies' => ['investment'],
        'generational_intent' => false,
        'non_resident_intent' => false,
        'income_extraction_urgency' => 'immediate',
        'existing_companies' => 0,
    ]);

    expect($scored['recommendation'])->toBe('personal');
});

it('recommends limited company for higher rate long horizon profile', function (): void {
    $service = new BusinessStructureAdvisorService;
    $scored = $service->score([
        'tax_bracket' => 'higher',
        'investment_horizon_years' => 15,
        'target_property_count' => 6,
        'strategies' => ['investment'],
        'generational_intent' => false,
        'non_resident_intent' => false,
        'income_extraction_urgency' => 'medium',
        'existing_companies' => 0,
    ]);

    expect($scored['recommendation'])->toBe('limited_company');
});

it('recommends group path for ambitious generational developer profile', function (): void {
    $service = new BusinessStructureAdvisorService;
    $scored = $service->score([
        'tax_bracket' => 'additional',
        'investment_horizon_years' => 25,
        'target_property_count' => 15,
        'strategies' => ['investment', 'development', 'trading'],
        'generational_intent' => true,
        'non_resident_intent' => false,
        'income_extraction_urgency' => 'low',
        'existing_companies' => 2,
    ]);

    expect(in_array($scored['recommendation'], ['group_structure', 'group_fic_path'], true))->toBeTrue();
});
