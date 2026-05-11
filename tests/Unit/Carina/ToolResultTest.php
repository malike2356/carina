<?php

declare(strict_types=1);

use App\Services\Carina\Tools\ToolResult;

it('includes success, summary, and data in toJson when all present', function (): void {
    $result = new ToolResult(true, 'Contact created.', ['id' => 42, 'name' => 'Test'], null);

    $json = json_decode($result->toJson(), true);

    expect($json)
        ->success->toBeTrue()
        ->summary->toBe('Contact created.')
        ->data->toBe(['id' => 42, 'name' => 'Test'])
        ->error->toBeNull();
});

it('omits empty data and null error in toJson', function (): void {
    $result = new ToolResult(true, 'Done.');

    $json = json_decode($result->toJson(), true);

    expect($json)
        ->toHaveKeys(['success', 'summary'])
        ->not->toHaveKey('data')
        ->not->toHaveKey('error');
});

it('serialises error code for failure ToolResult', function (): void {
    $result = new ToolResult(false, 'Not found.', [], 'not_found');

    $json = json_decode($result->toJson(), true);

    expect($json)
        ->success->toBeFalse()
        ->summary->toBe('Not found.')
        ->error->toBe('not_found')
        ->not->toHaveKey('data');
});
