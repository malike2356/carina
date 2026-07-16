<?php

declare(strict_types=1);

use App\Services\Automation\WorkspaceAutomationConditionEvaluator;

it('matches when conditions are empty', function (): void {
    $e = new WorkspaceAutomationConditionEvaluator;
    expect($e->matches(null, []))->toBeTrue();
    expect($e->matches([], ['to_stage_is_won' => true]))->toBeTrue();
});

it('evaluates stage flags and pipeline id', function (): void {
    $e = new WorkspaceAutomationConditionEvaluator;

    $ctx = [
        'to_stage_is_won' => true,
        'to_stage_is_lost' => false,
        'from_stage_is_won' => false,
        'from_stage_is_lost' => false,
        'pipeline_id' => 3,
        'deal_value' => 100000,
    ];

    expect($e->matches(['to_stage_is_won' => true], $ctx))->toBeTrue();
    expect($e->matches(['to_stage_is_lost' => true], $ctx))->toBeFalse();
    expect($e->matches(['pipeline_id' => 3], $ctx))->toBeTrue();
    expect($e->matches(['min_deal_value' => 50000], $ctx))->toBeTrue();
    expect($e->matches(['min_deal_value' => 200000], $ctx))->toBeFalse();
});
