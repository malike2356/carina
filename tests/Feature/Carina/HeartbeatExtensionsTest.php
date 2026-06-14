<?php

declare(strict_types=1);

use App\Models\Central\Tenant;
use App\Models\Tenant\CarinaConversation;
use App\Models\Tenant\ComplianceItem;
use App\Models\Tenant\Property;
use App\Models\Tenant\PropertyTenancy;
use App\Models\Tenant\TenancyRentPayment;
use App\Models\Tenant\User;
use App\Services\Carina\ToolHandlers\ComplianceToolHandler;
use App\Services\Carina\ToolHandlers\FinanceToolHandler;
use App\Services\Carina\ToolHandlers\TenancyToolHandler;
use App\Services\Finance\BoeRateService;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Config;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
});

/**
 * @return array{0: Tenant, 1: User}
 */
function heartbeatTenant(): array
{
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Heartbeat '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@heartbeat.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    return [$tenant, $user];
}

it('get_upcoming_compliance returns items expiring within 30 days', function (): void {
    [$tenant, $user] = heartbeatTenant();
    tenancy()->initialize($tenant);

    $property = Property::query()->create([
        'created_by' => $user->id,
        'address_line1' => '14 Oak Street',
        'city' => 'Portsmouth',
        'postcode' => 'PO2 1AA',
        'property_type' => 'terraced',
        'bedrooms' => 3,
    ]);
    ComplianceItem::query()->create([
        'property_id' => $property->id,
        'created_by' => $user->id,
        'category' => 'safety',
        'type' => 'gas',
        'title' => 'Gas Safety Certificate',
        'expires_at' => now()->addDays(10),
        'status' => 'valid',
    ]);

    $conversation = CarinaConversation::query()->create([
        'tenant_id' => (string) $tenant->getTenantKey(),
        'user_id' => $user->id,
        'title' => 'Heartbeat test',
    ]);

    $result = app(ComplianceToolHandler::class)->handle(
        'get_upcoming_compliance',
        ['days_ahead' => 30],
        $user,
        $conversation,
    );

    expect($result->success)->toBeTrue()
        ->and($result->data['expiring_count'])->toBe(1)
        ->and($result->data['items'][0]['item'])->toBe('Gas Safety Certificate');

    tenancy()->end();
});

it('get_rent_arrears_summary returns portfolio-level arrears', function (): void {
    [$tenant, $user] = heartbeatTenant();
    tenancy()->initialize($tenant);

    $property = Property::query()->create([
        'created_by' => $user->id,
        'address_line1' => '14 Oak Street',
        'city' => 'Portsmouth',
        'postcode' => 'PO2 1AA',
        'property_type' => 'terraced',
        'bedrooms' => 3,
    ]);
    $tenancy = PropertyTenancy::query()->create([
        'property_id' => $property->id,
        'tenant_name' => 'James Brown',
        'start_date' => now()->subMonths(3)->toDateString(),
        'rent_amount' => 900,
        'tenancy_type' => 'ast',
        'rent_frequency' => 'monthly',
    ]);

    TenancyRentPayment::query()->create([
        'tenancy_id' => $tenancy->id,
        'property_id' => $property->id,
        'due_date' => now()->subDays(14)->toDateString(),
        'amount_minor' => 30000,
        'status' => 'late',
        'created_by' => $user->id,
    ]);

    $conversation = CarinaConversation::query()->create([
        'tenant_id' => (string) $tenant->getTenantKey(),
        'user_id' => $user->id,
        'title' => 'Arrears test',
    ]);

    $result = app(TenancyToolHandler::class)->handle('get_rent_arrears_summary', [], $user, $conversation);

    expect($result->success)->toBeTrue()
        ->and($result->data['tenancies_in_arrears'])->toBe(1)
        ->and($result->data['total_arrears_amount'])->toEqual(300.0)
        ->and($result->data['items'][0]['tenant'])->toBe('James Brown');

    tenancy()->end();
});

it('get_interest_rate_update returns a numeric rate', function (): void {
    Config::set('services.boe.base_rate_pct', 5.25);

    $conversation = new CarinaConversation;
    $result = app(FinanceToolHandler::class)->handle('get_interest_rate_update', [], null, $conversation);

    expect($result->success)->toBeTrue()
        ->and($result->data['current_rate_pct'])->toBe(5.25);
});

it('BoeRateService caches the result for 6 hours', function (): void {
    Cache::flush();
    Config::set('services.boe.base_rate_pct', 4.75);

    $service = app(BoeRateService::class);
    $first = $service->getCurrentRate();
    Config::set('services.boe.base_rate_pct', 9.99);
    $second = $service->getCurrentRate();

    expect($first)->not->toBeNull()
        ->and($second)->not->toBeNull()
        ->and($first['current_rate_pct'])->toBe(4.75)
        ->and($second['current_rate_pct'])->toBe(4.75);
});
