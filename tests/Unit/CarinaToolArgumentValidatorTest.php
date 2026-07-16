<?php

declare(strict_types=1);

use App\Services\Carina\Security\CarinaToolArgumentValidator;

it('passes clean arguments', function () {
    $validator = new CarinaToolArgumentValidator;
    $result = $validator->validate('search_contacts', ['query' => 'John Smith', 'limit' => 10]);
    expect($result->valid)->toBeTrue();
    expect($result->violations)->toBeEmpty();
});

it('rejects shell metacharacters in string arguments', function () {
    $validator = new CarinaToolArgumentValidator;
    $result = $validator->validate('search_contacts', ['query' => 'John; DROP TABLE contacts;--']);
    expect($result->valid)->toBeFalse();
    expect($result->violations)->not->toBeEmpty();
});

it('rejects SQL injection fragments', function () {
    $validator = new CarinaToolArgumentValidator;
    $result = $validator->validate('get_property', ['id' => '1 OR 1=1']);
    expect($result->valid)->toBeFalse();
});

it('rejects strings exceeding max length', function () {
    $validator = new CarinaToolArgumentValidator;
    $result = $validator->validate('search_contacts', ['query' => str_repeat('a', 2001)]);
    expect($result->valid)->toBeFalse();
});

it('strips null bytes from string values', function () {
    $validator = new CarinaToolArgumentValidator;
    $result = $validator->validate('get_property', ['id' => "42\x00"]);
    expect(json_encode($result->sanitized['id']))->not->toContain('\u0000');
});
