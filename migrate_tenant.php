<?php

require __DIR__.'/vendor/autoload.php';

$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

echo "=== Migrating tenant test -> xelox ===\n\n";

// 1. Check current state
$old = DB::connection('central')->select('SELECT * FROM tenants WHERE id = ?', ['test']);
if (empty($old)) {
    echo "ERROR: Tenant 'test' not found.\n";
    exit(1);
}
$old = $old[0];
echo "Found tenant: {$old->id} / {$old->slug} / plan={$old->plan}\n";
$oldData = json_decode($old->data ?? '{}', true);
echo 'Old DB name: '.($oldData['tenancy_db_name'] ?? 'not set')."\n";

// 2. Insert new tenant record directly (DB already exists, so bypass tenancy events)
$xelox = DB::connection('central')->select('SELECT id FROM tenants WHERE id = ?', ['xelox']);
if (! empty($xelox)) {
    echo "ERROR: Tenant 'xelox' already exists.\n";
    exit(1);
}

DB::connection('central')->insert(
    'INSERT INTO tenants (id, slug, company_name, owner_name, owner_email, plan, is_active, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())',
    [
        'xelox',
        'xelox',
        'Xelox Properties',
        'Laud Paul',
        'xeloxproperties@gmail.com',
        'starter',
        true,
        json_encode([
            'created_at' => date('Y-m-d H:i:s'),
            'updated_at' => date('Y-m-d H:i:s'),
            'tenancy_db_name' => 'propreneur_t_xelox',
        ]),
    ]
);
echo "Created new tenant record: xelox\n";

// 3. Update domain
$domain = DB::connection('central')->select('SELECT * FROM domains WHERE tenant_id = ?', ['test']);
if (! empty($domain)) {
    DB::connection('central')->update(
        'UPDATE domains SET tenant_id = ?, domain = ? WHERE id = ?',
        ['xelox', 'xelox', $domain[0]->id]
    );
    echo "Domain updated: xelox\n";
} else {
    DB::connection('central')->insert(
        'INSERT INTO domains (tenant_id, domain, created_at, updated_at) VALUES (?, ?, NOW(), NOW())',
        ['xelox', 'xelox']
    );
    echo "Domain created: xelox\n";
}

// 4. Delete old tenant
DB::connection('central')->delete('DELETE FROM tenants WHERE id = ?', ['test']);
echo "Old tenant 'test' deleted.\n";

// 5. Verify
$verify = DB::connection('central')->select('SELECT * FROM tenants WHERE id = ?', ['xelox']);
if (! empty($verify)) {
    $v = $verify[0];
    echo "\n=== Tenant record verified ===\n";
    echo "  ID: {$v->id}\n";
    echo "  Slug: {$v->slug}\n";
    echo "  Company: {$v->company_name}\n";
    echo "  Owner: {$v->owner_name}\n";
    echo "  Email: {$v->owner_email}\n";
    echo "  Plan: {$v->plan}\n";
    echo '  Active: '.($v->is_active ? 'Yes' : 'No')."\n";
    $vData = json_decode($v->data ?? '{}', true);
    echo '  DB: '.($vData['tenancy_db_name'] ?? 'not set')."\n";

    $d = DB::connection('central')->select('SELECT * FROM domains WHERE tenant_id = ?', ['xelox']);
    if (! empty($d)) {
        echo "  Domain: {$d[0]->domain}\n";
    }

    echo "\n=== Migrating tenant database admin user ===\n";

    // 6. Create admin user in tenant database
    // The tenant database already exists (was renamed from propreneur_t_test)
    // We need to connect to it and create the admin user
    try {
        // Configure dynamic connection
        config(['database.connections.tenant_xelox' => [
            'driver' => 'pgsql',
            'host' => env('DB_HOST', '127.0.0.1'),
            'port' => env('DB_PORT', '5432'),
            'database' => 'propreneur_t_xelox',
            'username' => env('DB_USERNAME', 'propreneur'),
            'password' => env('DB_PASSWORD', 'local_dev_password'),
            'charset' => 'utf8',
            'prefix' => '',
            'schema' => 'public',
        ]]);

        // Check if users table exists
        $userTableExists = DB::connection('tenant_xelox')->select(
            "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') AS exists"
        );

        if ($userTableExists[0]->exists) {
            echo "  Users table exists in tenant database.\n";

            // Check if user already exists
            $existingUser = DB::connection('tenant_xelox')->select(
                'SELECT id, name, email FROM users WHERE email = ?',
                ['xeloxproperties@gmail.com']
            );

            if (! empty($existingUser)) {
                echo "  User already exists: {$existingUser[0]->name} ({$existingUser[0]->email})\n";
            } else {
                // Create the admin user
                DB::connection('tenant_xelox')->insert(
                    'INSERT INTO users (name, email, password, is_admin, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())',
                    ['Laud Paul', 'xeloxproperties@gmail.com', Hash::make(env('DEV_ACCOUNT_PASSWORD', 'password')), true]
                );
                echo "  Admin user created: Laud Paul (xeloxproperties@gmail.com)\n";
            }
        } else {
            echo "  Users table not found. You may need to run tenant migrations.\n";
            echo "  Run: php artisan tenants:migrate --tenant=xelox\n";
        }
    } catch (Exception $e) {
        echo '  Error connecting to tenant DB: '.$e->getMessage()."\n";
        echo "  You can still create the user manually via tinker.\n";
    }

    echo "\n=== Done! ===\n";
} else {
    echo "ERROR: Verification failed - tenant xelox not found!\n";
    exit(1);
}
