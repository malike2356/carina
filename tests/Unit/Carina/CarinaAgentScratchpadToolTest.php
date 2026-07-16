<?php

declare(strict_types=1);

use App\Services\Carina\Tools\ReadScratchpadTool;
use App\Services\Carina\Tools\WriteToScratchpadTool;
use Database\Factories\Tenant\UserFactory;

it('authorizes any authenticated user', function (): void {
    $write = new WriteToScratchpadTool;
    $read = new ReadScratchpadTool;
    $user = UserFactory::new()->makeOne(['id' => 1]);

    expect($write->authorize($user))->toBeTrue()
        ->and($read->authorize($user))->toBeTrue();
});

it('rejects unauthenticated users', function (): void {
    $write = new WriteToScratchpadTool;
    $read = new ReadScratchpadTool;

    expect($write->authorize(null))->toBeFalse()
        ->and($read->authorize(null))->toBeFalse();
});

it('does not require confirmation for either scratchpad tool', function (): void {
    $write = new WriteToScratchpadTool;
    $read = new ReadScratchpadTool;

    expect($write->requiresConfirmation())->toBeFalse()
        ->and($read->requiresConfirmation())->toBeFalse();
});
