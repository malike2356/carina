<?php

declare(strict_types=1);

use App\Models\Tenant\CarinaConversation;
use App\Models\Tenant\User;
use App\Services\Carina\CarinaToolRegistry;
use App\Services\Carina\Tools\GetDealSourcingIntelligenceTool;

it('registers get_deal_sourcing_intelligence in the tool registry', function (): void {
    $names = array_map(fn ($t) => $t->name(), app(CarinaToolRegistry::class)->all());

    expect($names)->toContain('get_deal_sourcing_intelligence');
});

it('get_deal_sourcing_intelligence requires a valid deal id', function (): void {
    $user = $this->createMock(User::class);
    $conversation = $this->createMock(CarinaConversation::class);
    $tool = app(GetDealSourcingIntelligenceTool::class);

    $result = $tool->execute(['deal_id' => 0], $user, $conversation);

    expect($result->success)->toBeFalse()
        ->and($result->error)->toBe('invalid_id');
});
