<?php

require __DIR__.'/vendor/autoload.php';

$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;

echo "=== Migrating tenant test -> xelox (central only) ===\n\n";

// 1. Check current state
$old = DB::connection('central')->select('SELECT * FROM tenants WHERE id = ?', ['test']);
if (empty($old)) {
    echo "ERROR: Tenant 'test' not found.\n";
    exit(1);
}
$old = $old[0];
echo "Found tenant: {$old->id} / {$old->slug}\n";

// 2. Insert new tenant record directly (bypass tenancy events since DB already exists)
$xeloxCount = DB::connection('central')->select('SELECT COUNT(*) AS cnt FROM tenants WHERE id = ?', ['xelox']);
if ($xeloxCount[0]->cnt > 0) {
    echo "ERROR: Tenant 'xelox' already exists.\n";
    exit(1);
}

DB::connection('central')->insert(
    'INSERT INTO tenants (id, slug, company_name, owner_name, owner_email, plan, is_active, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())',
    ['xelox', 'xelox', 'Xelox Properties', 'Laud Paul', 'xeloxproperties@gmail.com', 'starter', true, json_encode(['tenancy_db_name' => 'propreneur_t_xelox'])]
);
echo "Created new tenant record: xelox\n";

// 3. Update domain
$domain = DB::connection('central')->select('SELECT * FROM domains WHERE tenant_id = ?', ['test']);
if (! empty($domain)) {
    DB::connection('central')->update('UPDATE domains SET tenant_id = ?, domain = ? WHERE id = ?', ['xelox', 'xelox', $domain[0]->id]);
    echo "Domain updated: xelox\n";
} else {
    DB::connection('central')->insert('INSERT INTO domains (tenant_id, domain, created_at, updated_at) VALUES (?, ?, NOW(), NOW())', ['xelox', 'xelox']);
    echo "Domain created: xelox\n";
}

// 4. Delete old tenant
DB::connection('central')->delete('DELETE FROM tenants WHERE id = ?', ['test']);
echo "Old tenant 'test' deleted.\n";

// 5. Verify
$v = DB::connection('central')->select('SELECT * FROM tenants WHERE id = ?', ['xelox']);
if (! empty($v)) {
    $v = $v[0];
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
    echo "\n=== Central migration complete! ===\n";
} else {
    echo "ERROR: Verification failed!\n";
    exit(1);
}
