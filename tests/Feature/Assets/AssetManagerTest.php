<?php

declare(strict_types=1);

use App\Billing\BillingModule;
use App\Models\Central\FeatureFlag;
use App\Models\Tenant\AssetIncome;
use App\Models\Tenant\Property;
use App\Models\Tenant\User;
use App\Services\Assets\AssetManagerService;
use App\Services\Assets\NetWorthService;
use App\Services\Carina\CarinaBaselineContextService;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;

beforeEach(function (): void {
    tenancy()->end();
    $this->withoutMiddleware(VerifyCsrfToken::class);
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', BillingModule::AssetManager->value)->update(['enabled' => true]);
});

function assetManagerTenant(): array
{
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Asset Manager '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@asset-manager.test',
        'plan' => 'operator',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    return [$tenant, $host, $user];
}

it('can create a non-property asset', function (): void {
    [$tenant, $host, $user] = assetManagerTenant();

    tenancy()->initialize($tenant);
    $asset = app(AssetManagerService::class)->createAsset([
        'name' => 'Barclays Savings',
        'category' => 'cash_account',
        'current_value' => 25000,
    ], $user);

    expect($asset->category)->toBe('cash_account')
        ->and((float) $asset->current_value)->toBe(25000.0)
        ->and($asset->valuations()->count())->toBeGreaterThanOrEqual(1);
    tenancy()->end();
});

it('net worth snapshot returns correct totals including properties', function (): void {
    [$tenant,, $user] = assetManagerTenant();

    tenancy()->initialize($tenant);
    Property::query()->create([
        'created_by' => $user->id,
        'address_line1' => '1 Test St',
        'city' => 'Leeds',
        'postcode' => 'LS1 1AA',
        'property_type' => 'terraced',
        'status' => 'owned',
        'strategy' => 'btl',
        'current_value' => 200000,
        'mortgage_balance' => 120000,
        'monthly_cashflow' => 500,
    ]);

    app(AssetManagerService::class)->createAsset([
        'name' => 'ISA',
        'category' => 'investment',
        'current_value' => 10000,
    ], $user);

    $snapshot = app(NetWorthService::class)->snapshot();
    tenancy()->end();

    expect($snapshot['property_value'])->toBe(200000.0)
        ->and($snapshot['non_property_value'])->toBe(10000.0)
        ->and($snapshot['net_worth'])->toBe(90000.0);
});

it('asset equity is value minus liabilities', function (): void {
    [$tenant,, $user] = assetManagerTenant();

    tenancy()->initialize($tenant);
    $asset = app(AssetManagerService::class)->createAsset([
        'name' => 'Van',
        'category' => 'vehicle',
        'current_value' => 15000,
    ], $user);

    app(AssetManagerService::class)->addLiability($asset, [
        'name' => 'HP',
        'liability_type' => 'hire_purchase',
        'outstanding_balance' => 8000,
    ]);

    expect($asset->fresh()->equity())->toBe(7000.0);
    tenancy()->end();
});

it('monthly income normalises quarterly and annual amounts', function (): void {
    $income = new AssetIncome(['amount' => 1200, 'frequency' => 'annual']);

    expect($income->normalizedMonthly())->toBe(100.0);

    $quarterly = new AssetIncome(['amount' => 300, 'frequency' => 'quarterly']);
    expect($quarterly->normalizedMonthly())->toBe(100.0);
});

it('allocation returns correct category percentages', function (): void {
    [$tenant,, $user] = assetManagerTenant();

    tenancy()->initialize($tenant);
    app(AssetManagerService::class)->createAsset([
        'name' => 'Cash',
        'category' => 'cash_account',
        'current_value' => 5000,
    ], $user);
    app(AssetManagerService::class)->createAsset([
        'name' => 'Shares',
        'category' => 'investment',
        'current_value' => 5000,
    ], $user);

    $allocation = app(NetWorthService::class)->allocation();
    tenancy()->end();

    $totalPct = collect($allocation)->sum('percentage');
    expect(round($totalPct, 0))->toBe(100.0);
});

it('property_ref asset value syncs from property current_value', function (): void {
    [$tenant,, $user] = assetManagerTenant();

    tenancy()->initialize($tenant);
    $property = Property::query()->create([
        'created_by' => $user->id,
        'address_line1' => '2 Sync Lane',
        'city' => 'Leeds',
        'postcode' => 'LS2 2BB',
        'property_type' => 'flat',
        'status' => 'owned',
        'strategy' => 'btl',
        'current_value' => 180000,
    ]);

    $asset = app(AssetManagerService::class)->createAsset([
        'name' => 'Flat asset',
        'category' => 'property_ref',
        'property_id' => $property->id,
    ], $user);

    expect((float) $asset->current_value)->toBe(180000.0);
    tenancy()->end();
});

it('adding a valuation records the history entry', function (): void {
    [$tenant,, $user] = assetManagerTenant();

    tenancy()->initialize($tenant);
    $asset = app(AssetManagerService::class)->createAsset([
        'name' => 'Fund',
        'category' => 'investment',
        'current_value' => 1000,
    ], $user);

    app(AssetManagerService::class)->addValuation($asset, [
        'valued_at' => now()->toDateString(),
        'value' => 1200,
        'method' => 'self_assessed',
    ], $user);

    expect($asset->valuations()->count())->toBeGreaterThanOrEqual(2)
        ->and((float) $asset->fresh()->current_value)->toBe(1200.0);
    tenancy()->end();
});

it('archiving an asset excludes it from net worth calculation', function (): void {
    [$tenant,, $user] = assetManagerTenant();

    tenancy()->initialize($tenant);
    $asset = app(AssetManagerService::class)->createAsset([
        'name' => 'Temp',
        'category' => 'other',
        'current_value' => 50000,
    ], $user);

    $before = app(NetWorthService::class)->snapshot()['non_property_value'];
    app(AssetManagerService::class)->archiveAsset($asset);
    $after = app(NetWorthService::class)->snapshot()['non_property_value'];
    tenancy()->end();

    expect($before)->toBe(50000.0)->and($after)->toBe(0.0);
});

it('maintenance items appear in open maintenance query when scheduled or in_progress', function (): void {
    [$tenant,, $user] = assetManagerTenant();

    tenancy()->initialize($tenant);
    $asset = app(AssetManagerService::class)->createAsset([
        'name' => 'Land',
        'category' => 'land',
        'current_value' => 100000,
    ], $user);

    app(AssetManagerService::class)->logMaintenance($asset, [
        'title' => 'Fence repair',
        'status' => 'scheduled',
        'priority' => 'high',
    ], $user);

    $open = app(NetWorthService::class)->openMaintenance();
    tenancy()->end();

    expect($open)->toHaveCount(1)
        ->and($open->first()->title)->toBe('Fence repair');
});

it('dashboard net worth widget is injected when module is active', function (): void {
    [$tenant, $host, $user] = assetManagerTenant();

    tenancy()->initialize($tenant);
    app(AssetManagerService::class)->createAsset([
        'name' => 'Cash',
        'category' => 'cash_account',
        'current_value' => 1000,
    ], $user);
    tenancy()->end();

    $this->actingAs($user, 'web');
    $this->get('http://'.$host.'/')->assertOk()->assertSee('Net worth');
});

it('carina baseline context includes asset summary when assets exist', function (): void {
    [$tenant,, $user] = assetManagerTenant();

    tenancy()->initialize($tenant);
    app(AssetManagerService::class)->createAsset([
        'name' => 'Cash',
        'category' => 'cash_account',
        'current_value' => 25000,
    ], $user);

    $appendix = app(CarinaBaselineContextService::class)->appendixForUser($user);
    tenancy()->end();

    expect($appendix)->toContain('asset portfolio')
        ->and($appendix)->toContain('Net worth');
});
