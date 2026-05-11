<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Central\MigrationMapping;
use App\Models\Central\PlatformUser;
use App\Models\Central\Tenant;
use App\Models\Tenant\Contact;
use App\Models\Tenant\DealAnalysis;
use App\Models\Tenant\Property;
use App\Models\Tenant\User;
use App\Services\Migration\MigrationOrchestratorService;
use App\Services\Migration\V2ImportService;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Database\QueryException;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * @param  array<string, mixed>  $payload
 */
function migrationIntegrationCreateTenant(array $payload): Tenant
{
    $service = app(TenantCreationService::class);
    $last = null;

    for ($i = 0; $i < 8; $i++) {
        try {
            return $service->createTenant($payload);
        } catch (QueryException $e) {
            $last = $e;
            $sqlState = (string) ($e->errorInfo[0] ?? '');
            if ($sqlState !== '40P01' && ! str_contains(strtolower($e->getMessage()), 'deadlock')) {
                throw $e;
            }
            usleep(150000 * ($i + 1));
        }
    }

    throw $last ?? new RuntimeException('Tenant creation failed after retries');
}

function seedV1LegacySqliteForMigrationTest(): void
{
    Config::set('database.connections.v1_legacy', [
        'driver' => 'sqlite',
        'database' => ':memory:',
        'prefix' => '',
        'foreign_key_constraints' => true,
    ]);
    DB::purge('v1_legacy');

    Schema::connection('v1_legacy')->create('users', function (Blueprint $table) {
        $table->id();
        $table->unsignedBigInteger('tenant_id')->nullable();
        $table->string('name');
        $table->string('email');
        $table->string('password');
        $table->timestamps();
    });

    Schema::connection('v1_legacy')->create('properties', function (Blueprint $table) {
        $table->id();
        $table->unsignedBigInteger('tenant_id');
        $table->unsignedBigInteger('deal_id')->nullable();
        $table->string('address')->nullable();
        $table->string('postcode', 20)->nullable();
        $table->string('strategy', 50)->nullable();
        $table->decimal('current_value', 15, 2)->nullable();
        $table->timestamps();
    });

    Schema::connection('v1_legacy')->create('deals', function (Blueprint $table) {
        $table->id();
        $table->unsignedBigInteger('tenant_id')->nullable();
        $table->string('address')->nullable();
        $table->string('postcode', 20)->nullable();
        $table->string('strategy', 50)->nullable();
        $table->string('stage', 50)->default('lead');
        $table->timestamps();
    });

    Schema::connection('v1_legacy')->create('contacts', function (Blueprint $table) {
        $table->id();
        $table->unsignedBigInteger('tenant_id')->nullable();
        $table->string('type', 50)->default('investor');
        $table->string('name');
        $table->string('email')->nullable();
        $table->timestamps();
    });

    DB::connection('v1_legacy')->table('users')->insert([
        ['tenant_id' => 99, 'name' => 'Legacy', 'email' => 'legacy-'.Str::random(6).'@v1.test', 'password' => bcrypt('x'), 'created_at' => now(), 'updated_at' => now()],
    ]);

    DB::connection('v1_legacy')->table('properties')->insert([
        ['tenant_id' => 99, 'deal_id' => 1, 'address' => '88 River Rd', 'postcode' => 'B1 1AA', 'strategy' => 'btl', 'current_value' => 100000, 'created_at' => now(), 'updated_at' => now()],
    ]);

    DB::connection('v1_legacy')->table('deals')->insert([
        ['tenant_id' => 99, 'address' => '88 River Rd', 'postcode' => 'B1 1AA', 'strategy' => 'btl', 'stage' => 'lead', 'created_at' => now(), 'updated_at' => now()],
    ]);

    DB::connection('v1_legacy')->table('contacts')->insert([
        ['tenant_id' => 99, 'type' => 'broker', 'name' => 'Sam Broker', 'email' => 'sam@v1.test', 'created_at' => now(), 'updated_at' => now()],
    ]);
}

it('covers admin migration routes, import service, and v1 orchestration', function () {
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'v1_data_migration_tools')->update(['enabled' => true]);
    $superAdmin = PlatformUser::factory()->superAdmin()->create();

    $this->withServerVariables(['HTTP_HOST' => 'propreneur.test'])
        ->actingAs($superAdmin, 'platform')
        ->getJson(route('admin.migration.status'))
        ->assertOk()
        ->assertJsonStructure(['logs']);

    FeatureFlag::query()->where('key', 'v1_data_migration_tools')->update(['enabled' => false]);

    try {
        $this->withServerVariables(['HTTP_HOST' => 'propreneur.test'])
            ->actingAs($superAdmin, 'platform')
            ->getJson(route('admin.migration.status'))
            ->assertNotFound();
    } finally {
        FeatureFlag::query()->where('key', 'v1_data_migration_tools')->update(['enabled' => true]);
    }

    $workspace = migrationIntegrationCreateTenant([
        'company_name' => 'Migration Test Ltd '.Str::random(4),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.Str::lower(Str::random(8)).'@migration-test.test',
        'plan' => 'starter',
    ]);

    $this->withServerVariables(['HTTP_HOST' => 'propreneur.test'])
        ->actingAs($superAdmin, 'platform')
        ->postJson(route('admin.migration.validate', ['module' => 'properties']), [
            'tenant_id' => $workspace->id,
        ])
        ->assertOk()
        ->assertJsonPath('module', 'properties')
        ->assertJsonPath('integrity.ok', true);

    tenancy()->initialize($workspace);

    try {
        $user = User::query()->where('email', $workspace->owner_email)->firstOrFail();
        $import = app(V2ImportService::class);
        $batch = (string) Str::uuid();
        $id = $import->importProperty([
            'address_line1' => '99 Import Rd',
            'city' => 'Leeds',
            'postcode' => 'LS1 1AA',
            'country' => 'GB',
            'property_type' => 'terraced',
            'status' => 'lead',
            'garden' => false,
            'hmo_license_required' => false,
            'created_by' => $user->id,
        ], $workspace->id, $batch, 'v1-999', false);

        expect($id)->toBeInt()
            ->and(Property::query()->count())->toBeGreaterThanOrEqual(1);

        $this->assertDatabaseHas('migration_mappings', [
            'tenant_id' => $workspace->id,
            'batch_id' => $batch,
            'source_id' => 'v1-999',
        ], 'central');
    } finally {
        tenancy()->end();
    }

    $report = app(V2ImportService::class)->validateImport($workspace);
    expect($report['ok'])->toBeTrue()
        ->and($report['counts']['users'])->toBeGreaterThanOrEqual(1);

    if (! extension_loaded('pdo_sqlite')) {
        return;
    }

    seedV1LegacySqliteForMigrationTest();

    $orchTenant = migrationIntegrationCreateTenant([
        'company_name' => 'V1 Orchestration Ltd '.Str::random(4),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.Str::lower(Str::random(8)).'@v1-orch.test',
        'plan' => 'starter',
    ]);

    Config::set('v1_migration.tenant_slug_to_v1_id', [$orchTenant->slug => 99]);

    $orch = app(MigrationOrchestratorService::class);
    $batchAll = $orch->runMigration($orchTenant, 'all', false);

    tenancy()->initialize($orchTenant);
    try {
        expect(Property::query()->count())->toBeGreaterThanOrEqual(1)
            ->and(DealAnalysis::query()->count())->toBeGreaterThanOrEqual(1)
            ->and(Contact::query()->count())->toBeGreaterThanOrEqual(1)
            ->and(User::query()->count())->toBeGreaterThanOrEqual(1);

        expect(app(V2ImportService::class)->validateImport($orchTenant)['ok'])->toBeTrue();
    } finally {
        tenancy()->end();
    }

    expect(MigrationMapping::on('central')->where('batch_id', $batchAll)->count())->toBeGreaterThan(0);

    $orch->rollbackMigration($batchAll, $orchTenant->id);

    tenancy()->initialize($orchTenant);
    try {
        expect(Property::query()->count())->toBe(0)
            ->and(DealAnalysis::query()->count())->toBe(0)
            ->and(Contact::query()->count())->toBe(0);
    } finally {
        tenancy()->end();
    }

    expect(MigrationMapping::on('central')->where('batch_id', $batchAll)->count())->toBe(0);
});
