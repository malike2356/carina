<?php

declare(strict_types=1);

use App\Services\Migration\DataTransformService;

beforeEach(function () {
    $this->service = new DataTransformService;
});

it('transforms v1 property rows with defaults', function () {
    $out = $this->service->transformProperty([
        'address' => '10 Test Street, Manchester',
        'postcode' => 'm1 1aa',
        'strategy' => 'HMO',
        'current_value' => '250000',
        'notes' => 'Legacy',
    ], 42);

    expect($out['address_line1'])->toBe('10 Test Street')
        ->and($out['city'])->toBe('Manchester')
        ->and($out['postcode'])->toBe('M1 1AA')
        ->and($out['strategy'])->toBe('hmo')
        ->and($out['created_by'])->toBe(42)
        ->and($out['country'])->toBe('GB');
});

it('transforms v1 deal rows', function () {
    $out = $this->service->transformDeal([
        'id' => 9,
        'address' => '1 High St',
        'strategy' => 'BRR',
        'notes' => 'Good',
    ], 3, 5);

    expect($out['property_id'])->toBe(3)
        ->and($out['created_by'])->toBe(5)
        ->and($out['strategy'])->toBe('brr')
        ->and($out['title'])->toBe('1 High St')
        ->and($out['metrics']['legacy']['v1_deal_id'])->toBe(9);
});

it('transforms v1 contact rows', function () {
    $out = $this->service->transformContact([
        'name' => 'Alex Smith',
        'type' => 'solicitor',
        'email' => 'a@example.test',
        'notes' => 'Hello',
    ], 1);

    expect($out['first_name'])->toBe('Alex')
        ->and($out['last_name'])->toBe('Smith')
        ->and($out['type'])->toBe('solicitor')
        ->and($out['notes'])->toBe(['text' => 'Hello']);
});

it('transforms v1 user rows', function () {
    $out = $this->service->transformUser([
        'name' => 'Pat',
        'email' => 'Pat@EXAMPLE.test',
        'password' => 'secret-hash',
    ]);

    expect($out['email'])->toBe('pat@example.test')
        ->and($out['password'])->toBe('secret-hash');
});
