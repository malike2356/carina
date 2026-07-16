<?php

declare(strict_types=1);

use App\Models\Tenant\TenantRole;
use App\Models\Tenant\User;
use App\Services\Carina\CarinaAccessGate;
use App\Services\Carina\PropertyCalculatorService;
use App\Services\Tenancy\TenantCreationService;
use Database\Factories\Tenant\UserFactory;
use Illuminate\Auth\Access\AuthorizationException;

it('maps tenant_admin to financial access in CarinaAccessGate', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Carina Gate '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@carina-gate.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);

    TenantRole::findOrCreate('tenant_admin', 'web');

    /** @var User $user */
    $user = UserFactory::new()->createOne([]);
    $user->syncRoles(['tenant_admin']);

    $gate = app(CarinaAccessGate::class);

    expect($gate->canAccessFinancialData($user))->toBeTrue();
    expect($gate->canModifySystemConfig($user))->toBeTrue();

    tenancy()->end();
});

it('blocks viewers from switching restricted brains', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Carina Viewer '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@carina-viewer.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);

    TenantRole::findOrCreate('viewer', 'web');

    /** @var User $user */
    $user = UserFactory::new()->createOne([]);
    $user->syncRoles(['viewer']);

    $gate = app(CarinaAccessGate::class);

    expect($gate->canSwitchBrain($user, 'sales'))->toBeFalse();

    tenancy()->end();
});

it('computes monthly cash flow with working assumptions payload', function (): void {
    $svc = app(PropertyCalculatorService::class);

    $result = $svc->monthlyCashFlow([
        'gross_rent' => 2000,
        'mortgage' => 900,
        'management_fee' => 120,
        'insurance' => 40,
        'maintenance' => 100,
        'void_allowance_pct' => 5,
        'ground_service' => 50,
    ]);

    expect($result)->toHaveKey('monthly_cash_flow');
    expect($result['monthly_cash_flow'])->toBeFloat();
});

it('denies monthlyCashFlowForUser to viewers', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Carina Calc Viewer '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@carina-calc-viewer.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);

    TenantRole::findOrCreate('viewer', 'web');

    /** @var User $user */
    $user = UserFactory::new()->createOne([]);
    $user->syncRoles(['viewer']);

    $svc = app(PropertyCalculatorService::class);
    $inputs = [
        'gross_rent' => 2000,
        'mortgage' => 900,
        'management_fee' => 120,
        'insurance' => 40,
        'maintenance' => 100,
        'void_allowance_pct' => 5,
        'ground_service' => 50,
    ];

    expect(fn () => $svc->monthlyCashFlowForUser($user, $inputs))
        ->toThrow(AuthorizationException::class);

    tenancy()->end();
});

it('allows tenant_admin monthlyCashFlowForUser and annualCashFlowForUser', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Carina Calc Admin '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@carina-calc-admin.test',
        'plan' => 'starter',
    ]);

    tenancy()->initialize($tenant);

    TenantRole::findOrCreate('tenant_admin', 'web');

    /** @var User $user */
    $user = UserFactory::new()->createOne([]);
    $user->syncRoles(['tenant_admin']);

    $svc = app(PropertyCalculatorService::class);
    $inputs = [
        'gross_rent' => 2000,
        'mortgage' => 900,
        'management_fee' => 120,
        'insurance' => 40,
        'maintenance' => 100,
        'void_allowance_pct' => 5,
        'ground_service' => 50,
    ];

    $monthly = $svc->monthlyCashFlowForUser($user, $inputs);
    $annual = $svc->annualCashFlowForUser($user, $inputs);

    expect($monthly['monthly_cash_flow'])->toBeFloat()
        ->and($annual['annual_cash_flow'])->toBe(round($monthly['monthly_cash_flow'] * 12, 2));

    tenancy()->end();
});
