<?php

declare(strict_types=1);

use App\Services\Security\TenantAuthArtifactPurger;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Stancl\Tenancy\Jobs\CreateDatabase;

it('clears tenant sessions when tenancy is initialized', function () {
    $tenant = createCentralTenant(['slug' => 'purge-test-'.uniqid()]);

    app()->call([new CreateDatabase($tenant), 'handle']);

    $this->artisan('tenants:migrate', ['--tenants' => [$tenant->id], '--force' => true])->assertSuccessful();

    tenancy()->initialize($tenant);
    try {
        expect(Schema::connection('tenant')->hasTable('sessions'))->toBeTrue();
        DB::connection('tenant')->table('sessions')->insert([
            'id' => 'sess-test-1',
            'user_id' => null,
            'ip_address' => '127.0.0.1',
            'user_agent' => 'test',
            'payload' => 'a:0:{}',
            'last_activity' => time(),
        ]);
        expect(DB::connection('tenant')->table('sessions')->count())->toBe(1);
    } finally {
        tenancy()->end();
    }

    $results = [];
    (new TenantAuthArtifactPurger)->purgeAllInto($results);

    expect($results)->toHaveKey('tenant_'.$tenant->id.'_sessions')
        ->and($results['tenant_'.$tenant->id.'_sessions'])->toBe('cleared');

    tenancy()->initialize($tenant);
    try {
        expect(DB::connection('tenant')->table('sessions')->count())->toBe(0);
    } finally {
        tenancy()->end();
    }
});
