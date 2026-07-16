<?php

declare(strict_types=1);

use App\Models\Tenant\AssetMaintenanceSchedule;
use App\Models\Tenant\DealAnalysis;
use App\Models\Tenant\DealRefurbLine;
use App\Models\Tenant\Expense;
use App\Models\Tenant\Property;
use App\Models\Tenant\PropertyAsset;
use App\Models\Tenant\PropertyMaintenanceRequest;
use App\Models\Tenant\PropertyTenancy;
use App\Models\Tenant\RefurbCatalogueItem;
use App\Models\Tenant\RefurbishmentProject;
use App\Models\Tenant\RefurbishmentProjectLine;
use App\Models\Tenant\User;
use App\Models\Tenant\WorksOrder;
use App\Services\Accounting\ChartOfAccountsService;
use App\Services\Portfolio\MaintenanceAlertService;
use App\Services\Portfolio\RefurbishmentProjectService;
use App\Services\Portfolio\WorksOrderService;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;

beforeEach(function (): void {
    $this->withoutMiddleware(VerifyCsrfToken::class);
    $this->seed(FeatureFlagSeeder::class);
});

function portfolioTenantHost(): array
{
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Portfolio '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@portfolio.test',
        'plan' => 'mentor_network',
    ]);
    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    return [$tenant, $host, $user];
}

function portfolioProperty(User $user): Property
{
    return Property::query()->create([
        'address_line1' => '1 Asset Lane',
        'city' => 'Leeds',
        'postcode' => 'LS2 2BB',
        'property_type' => 'flat',
        'status' => 'managing',
        'strategy' => 'btl',
        'created_by' => $user->id,
    ]);
}

it('creates a property asset', function (): void {
    [$tenant, $host, $user] = portfolioTenantHost();

    tenancy()->initialize($tenant);
    $property = portfolioProperty($user);
    tenancy()->end();

    $this->actingAs($user, 'web');
    $this->post('http://'.$host.'/properties/'.$property->id.'/assets', [
        'name' => 'Worcester Bosch Boiler',
        'category' => 'boiler',
        'status' => 'active',
    ])->assertRedirect();

    tenancy()->initialize($tenant);
    expect(PropertyAsset::query()->where('name', 'Worcester Bosch Boiler')->exists())->toBeTrue();
    tenancy()->end();
});

it('advances maintenance schedule on record log', function (): void {
    [$tenant, , $user] = portfolioTenantHost();
    tenancy()->initialize($tenant);

    $property = portfolioProperty($user);
    $asset = PropertyAsset::query()->create([
        'property_id' => $property->id,
        'name' => 'Boiler',
        'category' => 'boiler',
        'status' => 'active',
        'created_by' => $user->id,
    ]);
    $schedule = AssetMaintenanceSchedule::query()->create([
        'property_asset_id' => $asset->id,
        'title' => 'Annual service',
        'frequency_unit' => 'yearly',
        'frequency_value' => 1,
        'next_due_at' => now()->subDay()->toDateString(),
        'is_active' => true,
    ]);

    $schedule->advanceSchedule();
    expect($schedule->fresh()->next_due_at->year)->toBe(now()->addYear()->year);
    tenancy()->end();
});

it('detects overdue maintenance schedules', function (): void {
    [$tenant, , $user] = portfolioTenantHost();
    tenancy()->initialize($tenant);

    $property = portfolioProperty($user);
    $asset = PropertyAsset::query()->create([
        'property_id' => $property->id,
        'name' => 'Roof',
        'category' => 'roof',
        'status' => 'active',
        'created_by' => $user->id,
    ]);
    AssetMaintenanceSchedule::query()->create([
        'property_asset_id' => $asset->id,
        'title' => 'Inspection',
        'next_due_at' => now()->subWeek()->toDateString(),
        'is_active' => true,
    ]);

    $overdue = app(MaintenanceAlertService::class)->overdueWorkspaceWide();
    expect($overdue)->toHaveCount(1);
    tenancy()->end();
});

it('stores a maintenance request with tenancy link', function (): void {
    [$tenant, $host, $user] = portfolioTenantHost();

    tenancy()->initialize($tenant);
    $property = portfolioProperty($user);
    $tenancy = PropertyTenancy::query()->create([
        'property_id' => $property->id,
        'tenant_name' => 'Jane Tenant',
        'rent_amount' => 800,
        'start_date' => now()->subMonth()->toDateString(),
    ]);
    tenancy()->end();

    $this->actingAs($user, 'web');
    $this->post('http://'.$host.'/properties/'.$property->id.'/maintenance', [
        'title' => 'Boiler not working',
        'category' => 'plumbing',
        'priority' => 'high',
        'status' => 'open',
        'reported_at' => now()->toDateString(),
        'property_tenancy_id' => $tenancy->id,
    ])->assertRedirect();

    tenancy()->initialize($tenant);
    expect(PropertyMaintenanceRequest::query()->where('property_tenancy_id', $tenancy->id)->exists())->toBeTrue();
    tenancy()->end();
});

it('creates an expense when a works order is completed', function (): void {
    [$tenant, , $user] = portfolioTenantHost();
    tenancy()->initialize($tenant);

    app(ChartOfAccountsService::class)->ensureDefaultAccounts();
    $property = portfolioProperty($user);
    $wo = WorksOrder::query()->create([
        'property_id' => $property->id,
        'title' => 'Fix leak',
        'status' => 'in_progress',
        'actual_amount' => 450.00,
        'created_by' => $user->id,
    ]);

    $completed = app(WorksOrderService::class)->complete($wo, $user, createExpense: true);
    expect($completed->status)->toBe('completed');
    expect($completed->expense_id)->not()->toBeNull();
    expect(Expense::query()->where('works_order_id', $wo->id)->exists())->toBeTrue();
    tenancy()->end();
});

it('syncs actual_total from actual project lines', function (): void {
    [$tenant, , $user] = portfolioTenantHost();
    tenancy()->initialize($tenant);

    $property = portfolioProperty($user);
    $project = RefurbishmentProject::query()->create([
        'property_id' => $property->id,
        'title' => 'Kitchen refit',
        'actual_total' => 0,
        'created_by' => $user->id,
    ]);
    RefurbishmentProjectLine::query()->create([
        'refurbishment_project_id' => $project->id,
        'description' => 'Units',
        'quantity' => 2,
        'unit_cost' => 500,
        'is_estimate' => false,
    ]);
    RefurbishmentProjectLine::query()->create([
        'refurbishment_project_id' => $project->id,
        'description' => 'Labour',
        'quantity' => 1,
        'unit_cost' => 300,
        'is_estimate' => false,
    ]);

    app(RefurbishmentProjectService::class)->syncActualFromLines($project);
    expect((float) $project->fresh()->actual_total)->toBe(1300.0);
    tenancy()->end();
});

it('imports deal refurb lines into a refurbishment project', function (): void {
    [$tenant, , $user] = portfolioTenantHost();
    tenancy()->initialize($tenant);

    $property = portfolioProperty($user);
    $analysis = DealAnalysis::query()->create([
        'property_id' => $property->id,
        'created_by' => $user->id,
        'strategy' => 'brr',
        'title' => 'Deal refurb import',
        'metrics' => [],
    ]);
    foreach (range(1, 3) as $i) {
        DealRefurbLine::query()->create([
            'deal_analysis_id' => $analysis->id,
            'description' => 'Line '.$i,
            'quantity' => 1,
            'unit_cost' => 100 * $i,
            'vat_mode' => 'exempt',
            'sort_order' => $i,
        ]);
    }
    $project = RefurbishmentProject::query()->create([
        'property_id' => $property->id,
        'source_deal_analysis_id' => $analysis->id,
        'title' => 'Post-acquisition refurb',
        'created_by' => $user->id,
    ]);

    $count = app(RefurbishmentProjectService::class)->importFromDealLines($project, $analysis);
    expect($count)->toBe(3);
    expect(RefurbishmentProjectLine::query()->where('refurbishment_project_id', $project->id)->count())->toBe(3);
    tenancy()->end();
});

it('applies catalogue items to a refurbishment project', function (): void {
    [$tenant, , $user] = portfolioTenantHost();
    tenancy()->initialize($tenant);

    $property = portfolioProperty($user);
    $project = RefurbishmentProject::query()->create([
        'property_id' => $property->id,
        'title' => 'Catalogue project',
        'created_by' => $user->id,
    ]);
    $items = collect(range(1, 2))->map(fn ($i) => RefurbCatalogueItem::query()->create([
        'code' => 'CAT-'.$i,
        'label' => 'Item '.$i,
        'category' => 'finishes',
        'default_unit_cost' => 50,
        'default_quantity' => 1,
        'unit' => 'each',
        'sort_order' => $i,
        'is_active' => true,
    ]));

    app(RefurbishmentProjectService::class)->applyFromCatalogue($project, $items->pluck('id')->all());
    expect(RefurbishmentProjectLine::query()->where('refurbishment_project_id', $project->id)->count())->toBe(2);
    tenancy()->end();
});
