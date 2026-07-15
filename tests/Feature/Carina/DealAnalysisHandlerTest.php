<?php

declare(strict_types=1);

use App\Jobs\AnalyseFloorPlan;
use App\Models\Central\Tenant;
use App\Models\Tenant\BoqReport;
use App\Models\Tenant\CarinaConversation;
use App\Models\Tenant\FloorPlan;
use App\Models\Tenant\User;
use App\Services\Carina\CarinaModuleToolDispatcher;
use App\Services\Carina\ToolHandlers\DealAnalysisHandler;
use App\Services\Carina\ToolHandlers\FloorPlanToolHandler;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Storage;

/**
 * @return array{0: Tenant, 1: User}
 */
function dealAnalysisTenant(): array
{
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Deal Analysis '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@dealanalysis.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    return [$tenant, $user];
}

function dealAnalysisConversation(Tenant $tenant, User $user): CarinaConversation
{
    return CarinaConversation::query()->create([
        'tenant_id' => (string) $tenant->getTenantKey(),
        'user_id' => $user->id,
        'title' => 'Deal analysis test',
    ]);
}

it('analyze_deal returns cash flow ROI and rating using BTL calculator', function (): void {
    [$tenant, $user] = dealAnalysisTenant();
    tenancy()->initialize($tenant);

    $conversation = dealAnalysisConversation($tenant, $user);

    $result = app(DealAnalysisHandler::class)->handle(
        'analyze_deal',
        [
            'purchase_price' => 200000,
            'monthly_rent' => 1200,
            'interest_rate' => 4.5,
            'deposit_percent' => 25,
            'bedrooms' => 3,
            'location' => 'Bristol',
        ],
        $user,
        $conversation,
    );

    expect($result->success)->toBeTrue()
        ->and($result->data['returns']['monthly_cash_flow'])->toBeFloat()
        ->and($result->data['returns']['roi_percent'])->toBeFloat()
        ->and($result->data['rating']['label'])->toBeString()
        ->and($result->data['deal_summary']['location'])->toBe('Bristol');

    tenancy()->end();
});

it('analyze_deal flags HMO warning for five plus bedrooms', function (): void {
    [$tenant, $user] = dealAnalysisTenant();
    tenancy()->initialize($tenant);

    $conversation = dealAnalysisConversation($tenant, $user);

    $result = app(DealAnalysisHandler::class)->handle(
        'analyze_deal',
        [
            'purchase_price' => 350000,
            'monthly_rent' => 2800,
            'bedrooms' => 6,
            'property_type' => 'single_let',
        ],
        $user,
        $conversation,
    );

    expect($result->success)->toBeTrue()
        ->and($result->data['hmo_warning'])->toContain('HMO licensing');

    tenancy()->end();
});

it('analyze_deal rejects missing purchase price or rent', function (): void {
    [$tenant, $user] = dealAnalysisTenant();
    tenancy()->initialize($tenant);

    $conversation = dealAnalysisConversation($tenant, $user);

    $result = app(DealAnalysisHandler::class)->handle(
        'analyze_deal',
        ['purchase_price' => 200000],
        $user,
        $conversation,
    );

    expect($result->success)->toBeFalse();

    tenancy()->end();
});

it('compare_deals picks better ROI and cash flow', function (): void {
    [$tenant, $user] = dealAnalysisTenant();
    tenancy()->initialize($tenant);

    $conversation = dealAnalysisConversation($tenant, $user);

    $result = app(DealAnalysisHandler::class)->handle(
        'compare_deals',
        [
            'deal_a' => ['purchase_price' => 150000, 'monthly_rent' => 1100],
            'deal_b' => ['purchase_price' => 250000, 'monthly_rent' => 1200],
        ],
        $user,
        $conversation,
    );

    expect($result->success)->toBeTrue()
        ->and($result->data['deal_a']['purchase'])->toBe(150000.0)
        ->and($result->data['deal_b']['purchase'])->toBe(250000.0)
        ->and($result->data['verdict'])->toContain('Better ROI');

    tenancy()->end();
});

it('rateDeal returns Avoid for negative cash flow deals', function (): void {
    [$tenant, $user] = dealAnalysisTenant();
    tenancy()->initialize($tenant);

    $conversation = dealAnalysisConversation($tenant, $user);

    $result = app(DealAnalysisHandler::class)->handle(
        'analyze_deal',
        [
            'purchase_price' => 400000,
            'monthly_rent' => 800,
            'interest_rate' => 6.5,
            'deposit_percent' => 10,
        ],
        $user,
        $conversation,
    );

    expect($result->success)->toBeTrue()
        ->and($result->data['returns']['monthly_cash_flow'])->toBeLessThan(0)
        ->and($result->data['rating']['label'])->toBe('Avoid');

    tenancy()->end();
});

it('upload_floor_plan stores file and dispatches analysis job', function (): void {
    Bus::fake();
    Storage::fake('public');

    [$tenant, $user] = dealAnalysisTenant();
    tenancy()->initialize($tenant);

    $filePath = sys_get_temp_dir().'/floorplan_'.uniqid().'.png';
    file_put_contents($filePath, 'fake png content');

    $conversation = dealAnalysisConversation($tenant, $user);

    $result = app(FloorPlanToolHandler::class)->handle(
        'upload_floor_plan',
        [
            'file_path' => $filePath,
            'file_name' => 'flat-4-plan.png',
        ],
        $user,
        $conversation,
    );

    expect($result->success)->toBeTrue()
        ->and($result->data['floor_plan_id'])->toBeInt()
        ->and(FloorPlan::query()->count())->toBe(1);

    Bus::assertDispatched(AnalyseFloorPlan::class);

    @unlink($filePath);
    tenancy()->end();
});

it('check_floor_plan_status returns BOQ when analysis completed', function (): void {
    [$tenant, $user] = dealAnalysisTenant();
    tenancy()->initialize($tenant);

    $floorPlan = FloorPlan::query()->create([
        'original_filename' => 'plan.png',
        'storage_path' => 'floor-plans/test.png',
        'status' => 'completed',
        'extracted_rooms' => [['name' => 'Kitchen']],
        'overall_dimensions' => ['total_area_m2' => 72],
        'analysed_at' => now(),
    ]);

    BoqReport::query()->create([
        'floor_plan_id' => $floorPlan->id,
        'refurb_type' => 'light_refresh',
        'rooms_breakdown' => [['room' => 'Kitchen', 'cost' => 2500]],
        'property_summary' => ['total_area_m2' => 72],
        'grand_total' => 12500.50,
        'compliance_flags' => ['flags' => []],
    ]);

    $conversation = dealAnalysisConversation($tenant, $user);

    $result = app(FloorPlanToolHandler::class)->handle(
        'check_floor_plan_status',
        ['floor_plan_id' => $floorPlan->id],
        $user,
        $conversation,
    );

    expect($result->success)->toBeTrue()
        ->and($result->data['status'])->toBe('completed')
        ->and($result->data['boq']['grand_total'])->toEqual('12500.50');

    tenancy()->end();
});

it('dispatches analyze_deal via CarinaModuleToolDispatcher', function (): void {
    [$tenant, $user] = dealAnalysisTenant();
    tenancy()->initialize($tenant);

    app()->forgetInstance(CarinaModuleToolDispatcher::class);

    $conversation = dealAnalysisConversation($tenant, $user);

    $result = app(CarinaModuleToolDispatcher::class)->dispatch(
        'analyze_deal',
        ['purchase_price' => 180000, 'monthly_rent' => 950],
        $user,
        $conversation,
    );

    expect($result->success)->toBeTrue()
        ->and($result->data)->toHaveKey('rating');

    tenancy()->end();
});
