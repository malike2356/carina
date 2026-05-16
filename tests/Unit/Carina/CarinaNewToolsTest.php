<?php

declare(strict_types=1);

use App\Models\Tenant\CarinaConversation;
use App\Models\Tenant\User;
use App\Services\Carina\CarinaToolRegistry;
use App\Services\Carina\Tools\GenerateDealPackTool;
use App\Services\Carina\Tools\RunDevelopmentCalculatorTool;
use App\Services\Carina\Tools\RunStrategyFinderTool;
use App\Services\Carina\Tools\SendCommunicationSequenceTool;

it('registers four new tools in the registry', function (): void {
    $registry = app(CarinaToolRegistry::class);
    $names = array_map(fn ($t) => $t->name(), $registry->all());

    expect($names)->toContain('run_development_calculator')
        ->toContain('send_communication_sequence')
        ->toContain('generate_deal_pack')
        ->toContain('run_strategy_finder');
});

it('run_development_calculator returns viable result for good deal', function (): void {
    $user = $this->createMock(User::class);
    $conversation = $this->createMock(CarinaConversation::class);
    $tool = app(RunDevelopmentCalculatorTool::class);

    $result = $tool->execute([
        'purchase_price' => 150000,
        'build_cost_per_unit' => 60000,
        'unit_count' => 7,
        'average_unit_value' => 140000,
        'average_monthly_rent' => 750,
    ], $user, $conversation);

    expect($result->success)->toBeTrue()
        ->and($result->data['viability']['is_viable'])->toBeTrue()
        ->and($result->summary)->toContain('viable');
});

it('run_development_calculator flags non-viable deal', function (): void {
    $user = $this->createMock(User::class);
    $conversation = $this->createMock(CarinaConversation::class);
    $tool = app(RunDevelopmentCalculatorTool::class);

    $result = $tool->execute([
        'purchase_price' => 900000,
        'build_cost_per_unit' => 80000,
        'unit_count' => 5,
        'average_unit_value' => 120000,
        'average_monthly_rent' => 600,
    ], $user, $conversation);

    expect($result->success)->toBeTrue()
        ->and($result->data['viability']['is_viable'])->toBeFalse();
});

it('generate_deal_pack requires confirmation', function (): void {
    $tool = app(GenerateDealPackTool::class);
    expect($tool->requiresConfirmation())->toBeTrue();
});

it('send_communication_sequence requires confirmation', function (): void {
    $tool = app(SendCommunicationSequenceTool::class);
    expect($tool->requiresConfirmation())->toBeTrue();
});

it('run_strategy_finder returns top three strategies', function (): void {
    $user = $this->createMock(User::class);
    $conversation = $this->createMock(CarinaConversation::class);
    $tool = app(RunStrategyFinderTool::class);

    $result = $tool->execute([
        'available_capital' => 50000,
        'monthly_income_target' => 1000,
        'time_horizon' => 10,
        'risk_tolerance' => 'medium',
        'hands_on_preference' => 'medium',
    ], $user, $conversation);

    expect($result->success)->toBeTrue()
        ->and($result->data['top_3'])->toHaveCount(3)
        ->and($result->data['top_strategy'])->toBeString()
        ->and($result->summary)->toContain('Strategy Finder complete');
});
