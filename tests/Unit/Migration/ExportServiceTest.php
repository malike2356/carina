<?php

declare(strict_types=1);

use App\Services\Migration\MigrationCacheService;
use App\Services\Migration\V1ExportService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

beforeEach(function () {
    if (! extension_loaded('pdo_sqlite')) {
        return;
    }

    Config::set('database.connections.v1_legacy', [
        'driver' => 'sqlite',
        'database' => ':memory:',
        'prefix' => '',
        'foreign_key_constraints' => true,
    ]);
    DB::purge('v1_legacy');

    Schema::connection('v1_legacy')->create('properties', function (Blueprint $table) {
        $table->id();
        $table->unsignedBigInteger('tenant_id');
        $table->string('address')->nullable();
        $table->string('postcode', 20)->nullable();
        $table->string('strategy', 50)->nullable();
        $table->timestamps();
    });

    DB::connection('v1_legacy')->table('properties')->insert([
        ['tenant_id' => 7, 'address' => '1 Lane', 'postcode' => 'E1 1AA', 'strategy' => 'btl', 'created_at' => now(), 'updated_at' => now()],
        ['tenant_id' => 8, 'address' => '2 Lane', 'postcode' => 'E2 2AA', 'strategy' => 'btl', 'created_at' => now(), 'updated_at' => now()],
    ]);

    $this->export = new V1ExportService(app(MigrationCacheService::class));
});

it('exports only rows for the requested v1 tenant id', function () {
    if (! extension_loaded('pdo_sqlite')) {
        $this->markTestSkipped('pdo_sqlite extension required for v1 legacy stub.');
    }
    $rows = $this->export->exportTable('properties', 7)->collect();

    expect($rows)->toHaveCount(1)
        ->and($rows->first()->address)->toBe('1 Lane');
});

it('returns schema metadata for a logical table', function () {
    if (! extension_loaded('pdo_sqlite')) {
        $this->markTestSkipped('pdo_sqlite extension required for v1 legacy stub.');
    }
    $schema = $this->export->getSchema('properties');

    expect($schema)->not->toBeEmpty()
        ->and(collect($schema)->pluck('name')->all())->toContain('tenant_id', 'postcode');
});
