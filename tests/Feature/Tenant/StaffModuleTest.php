<?php

declare(strict_types=1);

use App\Models\Central\FeatureFlag;
use App\Models\Tenant\StaffLeaveRequest;
use App\Models\Tenant\User;
use App\Services\Tenancy\TenantCreationService;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Spatie\Permission\PermissionRegistrar;
use Tests\Concerns\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->withoutMiddleware(VerifyCsrfToken::class);
});

it('exposes staff directory leave and payroll for entitled workspace', function (): void {
    $tenant = app(TenantCreationService::class)->createTenant([
        'company_name' => 'Staff '.uniqid(),
        'owner_name' => 'Owner',
        'owner_email' => 'owner-'.uniqid().'@staff.test',
        'plan' => 'starter',
    ]);
    $host = $tenant->slug.'.propreneur.test';

    tenancy()->initialize($tenant);
    FeatureFlag::syncFromCatalogue();
    FeatureFlag::query()->where('key', 'stripe_billing_api')->update(['enabled' => false]);
    FeatureFlag::query()->where('key', 'hr_payroll')->update(['enabled' => true]);
    completeTenantWorkspaceOnboarding();
    app(PermissionRegistrar::class)->forgetCachedPermissions();
    $user = User::query()->firstOrFail();
    tenancy()->end();

    $this->actingAs($user, 'web');

    $this->get('http://'.$host.'/staff')->assertOk()->assertSee('Staff directory', false);

    $this->post('http://'.$host.'/staff/leave', [
        'start_date' => now()->addWeek()->toDateString(),
        'end_date' => now()->addWeek()->addDay()->toDateString(),
        'kind' => 'annual',
        'notes' => 'Test leave',
    ])->assertRedirect(route('tenant.staff.leave.index'));

    tenancy()->initialize($tenant);
    expect(StaffLeaveRequest::query()->count())->toBe(1);
    tenancy()->end();

    $this->get('http://'.$host.'/staff/payroll')->assertOk()->assertSee('Payroll runs', false);

    $this->post('http://'.$host.'/staff/payroll', [
        'period_start' => now()->startOfMonth()->toDateString(),
        'period_end' => now()->endOfMonth()->toDateString(),
        'currency' => 'gbp',
        'total_gross_minor' => 50000,
        'notes' => 'May payroll',
    ])->assertRedirect(route('tenant.staff.payroll.index'));
});
