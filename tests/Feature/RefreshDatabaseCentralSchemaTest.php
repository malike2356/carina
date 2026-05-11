<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Schema;

it('has central tenancy tables after refresh database', function () {
    expect(Schema::connection('central')->hasTable('tenants'))->toBeTrue()
        ->and(Schema::connection('central')->hasTable('domains'))->toBeTrue()
        ->and(Schema::connection('central')->hasTable('feature_flags'))->toBeTrue();
});
