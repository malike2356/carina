<?php

declare(strict_types=1);

use App\Models\Tenant\Property;
use App\Models\Tenant\PropertyTenancy;
use App\Models\Tenant\TenantSetting;
use App\Models\Tenant\User;
use App\Services\Onboarding\WealthOnboardingService;
use App\Services\Persona\PersonaService;
use App\Services\Reporting\DashboardWidgetService;
use App\Services\Tenancy\TenantCreationService;
use App\Support\Persona\PersonaModuleMap;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;

beforeEach(function (): void {
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

it('loads wealth persona config with correct modules and widgets', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Wealth Persona '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@wealth.test',
        'plan' => 'professional',
        'persona' => 'wealth',
    ]);

    $service = app(PersonaService::class);
    $cfg = $service->config($tenant);

    expect($cfg['slug'])->toBe('wealth')
        ->and($cfg['carina_persona'])->toBe('wealth')
        ->and($service->isFeatureVisible('deal_sourcing', $tenant))->toBeFalse()
        ->and($service->isFeatureVisible('pipeline', $tenant))->toBeFalse()
        ->and($service->isFeatureVisible('mentoring', $tenant))->toBeFalse();

    $widgetTypes = $service->allowedDashboardWidgetTypes($tenant);
    expect($widgetTypes)->toContain('wealth_net_worth_trend')
        ->and($widgetTypes)->toContain('wealth_compliance_health');

    foreach (config('personas.wealth.dashboard_widgets', []) as $key) {
        expect(PersonaModuleMap::dashboardWidgetTypes((string) $key))->not->toBeEmpty();
    }
});

it('returns portfolio tenancy index across all properties', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Wealth Ten '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@wealth-ten.test',
        'plan' => 'professional',
        'persona' => 'wealth',
    ]);

    tenancy()->initialize($tenant);
    $user = User::query()->firstOrFail();
    TenantSetting::setValue(WealthOnboardingService::COMPLETED_KEY, true, 'onboarding');

    $p1 = Property::query()->create([
        'address_line1' => '1 Alpha St',
        'city' => 'London',
        'postcode' => 'E1 1AA',
        'created_by' => $user->id,
    ]);
    $p2 = Property::query()->create([
        'address_line1' => '2 Beta Rd',
        'city' => 'Leeds',
        'postcode' => 'LS1 1BB',
        'created_by' => $user->id,
    ]);

    PropertyTenancy::query()->create([
        'property_id' => $p1->id,
        'tenant_name' => 'Tenant A',
        'rent_amount' => 1200,
        'start_date' => now()->subMonth(),
    ]);
    PropertyTenancy::query()->create([
        'property_id' => $p2->id,
        'tenant_name' => 'Tenant B',
        'rent_amount' => 950,
        'start_date' => now()->subMonth(),
    ]);

    $host = $tenant->domains->firstOrFail()->domain.'.propreneur.test';

    $this->actingAs($user, 'web')
        ->get('http://'.$host.'/portfolio/tenancies')
        ->assertOk()
        ->assertSee('Tenant A')
        ->assertSee('Tenant B');

    tenancy()->end();
});

it('reports wealth onboarding incomplete before step 4', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Wealth OB '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@wealth-ob.test',
        'plan' => 'professional',
        'persona' => 'wealth',
    ]);

    tenancy()->initialize($tenant);

    $service = app(WealthOnboardingService::class);
    expect($service->isComplete($tenant))->toBeFalse();

    TenantSetting::setValue(WealthOnboardingService::SETTINGS_KEY, [
        'max_unlocked_step' => 2,
        'step_1' => ['property_count' => 3],
    ], 'onboarding');

    expect($service->isComplete($tenant))->toBeFalse()
        ->and($service->getProgress()['max_unlocked_step'])->toBe(2);

    tenancy()->end();
});

it('shows wealth dashboard widgets for wealth persona workspace', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Wealth Dash '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@wealth-dash.test',
        'plan' => 'professional',
        'persona' => 'wealth',
    ]);

    tenancy()->initialize($tenant);
    TenantSetting::setValue(WealthOnboardingService::COMPLETED_KEY, true, 'onboarding');

    $types = collect(app(DashboardWidgetService::class)->getWidgetData())->pluck('type')->all();

    expect($types)->toContain('wealth_net_worth_trend')
        ->and($types)->toContain('wealth_rent_roll_overview');

    tenancy()->end();
});
