<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\TenantSetting;
use App\Models\Tenant\User;
use App\Services\Deals\WorkspaceCalculatorDefaultsService;
use App\Services\Tenancy\TenantCreationService;
use Database\Seeders\Central\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;

beforeEach(function (): void {
    $this->seed(FeatureFlagSeeder::class);
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', 'deal_engine')->update([
        'enabled' => true,
        'tenant_overrides' => null,
    ]);
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

it('lets workspace admin view and save deal calculator defaults', function (): void {
    $service = app(TenantCreationService::class);
    $tenant = $service->createTenant([
        'company_name' => 'Calc Defaults Co '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@calcdefaults.test',
        'plan' => 'starter',
    ]);

    $host = $tenant->domains->first()->domain.'.propreneur.test';

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    completeTenantWorkspaceOnboarding();
    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->get('http://'.$host.'/settings/deal-calculators')->assertOk();

    $this->put('http://'.$host.'/settings/deal-calculators', [
        'default_management_pct_rent' => 0.1,
        'default_void_months_per_year' => 1.5,
        'default_maintenance_pct_value' => 0.015,
        'default_stress_rent_factor' => 0.8,
        'default_stress_mortgage_factor' => 1.2,
        'default_sdlt_profile' => 'first_time_buyer',
    ])->assertSessionHas('success');

    tenancy()->initialize($tenant);
    $row = TenantSetting::query()->where('key', WorkspaceCalculatorDefaultsService::SETTINGS_KEY)->first();
    expect($row)->not->toBeNull();
    $decoded = json_decode((string) $row->value, true);
    expect((float) $decoded['default_management_pct_rent'])->toBe(0.1)
        ->and((string) $decoded['default_sdlt_profile'])->toBe('first_time_buyer');
    tenancy()->end();
});
